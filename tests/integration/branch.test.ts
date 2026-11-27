import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, withTx } from "@/db";
import { chargeTypes, containerCharges, containerSizes, parties, shippingLines, traders, users, vaults } from "@/db/schema";
import { seed } from "@/db/seed";
import { getBranch } from "@/features/branch/service";
import * as charges from "@/features/charges/service";
import * as containers from "@/features/containers/service";
import { getBalance, getBalances } from "@/features/ledger/balances";
import * as money from "@/features/money/service";
import { closeDb, resetDb } from "../helpers/db";

/**
 * The owner's example (2026-11-27): a container with 10,000,000 IQD of expenses paid by the Umm Qasr partnership
 * (his branch, with its own vault) and a 1,150,000 company fee. The customer owes the branch 10,000,000 and the
 * owner 1,150,000.
 */
const D = "2026-11-27";
let ownerId: string;
let ahmed: string;
let containerId: string;
let branchId: string;
let branchVault: string;
let mainVault: string;
const type: Record<string, string> = {};

const bal = (kind: "trader" | "trader_branch" | "party" | "vault" | "fee_income", refId: string | null) => getBalance(db, { kind, refId }, "IQD");

beforeEach(async () => {
    await resetDb();
    await seed(db, { username: "owner", password: "owner-pass-123", name: "أبو علي" });
    ownerId = (await db.select().from(users))[0].id;
    const msc = (await db.select().from(shippingLines).orderBy(asc(shippingLines.sortOrder)))[0].id;
    const size40 = (await db.select().from(containerSizes).where(eq(containerSizes.code, "40ft")))[0].id;
    ahmed = (await db.insert(traders).values({ name: "أحمد كاظم" }).returning())[0].id;
    const branch = (await getBranch(db))!;
    branchId = branch.id;
    branchVault = branch.vaultId!;
    mainVault = (await db.select().from(vaults).where(eq(vaults.kind, "main")))[0].id;
    for (const ct of await db.select().from(chargeTypes)) type[ct.name] = ct.id;
    containerId = await withTx((tx) =>
        containers.createContainer(
            tx,
            { containerNumber: "MSCU4829175", shippingLineId: msc, containerSizeId: size40, isShared: false, shares: [{ traderId: ahmed }] },
            ownerId,
        ),
    ).then((r) => r.id);
    // The branch starts with cash in its own vault.
    await withTx((tx) => money.postMoney(tx, { kind: "deposit", date: D, vaultId: branchVault, amount: "20000000", currency: "IQD" }, ownerId));
});
afterAll(closeDb);

const addExpenses = (vaultId: string, extra: Partial<{ currency: "IQD" | "USD"; amount: string; fxRate: string }> = {}) =>
    withTx((tx) =>
        charges.addCharges(
            tx,
            {
                containerId,
                date: D,
                rows: [
                    { chargeTypeId: type["غرامة ميناء"], amount: "10000000", currency: "IQD", paidByPartyId: branchId, vaultId, ...extra },
                    { chargeTypeId: type["أتعاب شركة"], amount: "1150000", currency: "IQD" },
                ],
            },
            ownerId,
        ),
    );

describe("the Umm Qasr partnership is the owner's branch", () => {
    it("is set up with its own dinar vault", async () => {
        const [p] = await db.select().from(parties).where(eq(parties.id, branchId));
        expect(p.name).toBe("شراكة تخليص أم قصر");
        const [v] = await db.select().from(vaults).where(eq(vaults.id, branchVault));
        expect(v.partyId).toBe(branchId);
        expect(v.allowedCurrencies).toEqual(["IQD"]);
    });

    it("expenses paid from its vault are owed to the branch; the fee is owed to the owner", async () => {
        await addExpenses(branchVault);
        expect(await bal("trader_branch", ahmed)).toBe("10000000");
        expect(await bal("trader", ahmed)).toBe("1150000");
        expect(await bal("vault", branchVault)).toBe("10000000"); // 20,000,000 − 10,000,000
        expect(await bal("vault", mainVault)).toBe("0");
        expect(await bal("fee_income", null)).toBe("-1150000");
        expect(await bal("party", branchId)).toBe("0"); // nothing between the owner and the branch
        // The customer's view adds both: 11,150,000.
        expect((await getBalances(db, "trader", ahmed)).IQD).toBe("11150000");
    });

    it("when the owner pays for the branch from his vault, the customer still owes the branch and the branch owes the owner", async () => {
        await withTx((tx) => money.postMoney(tx, { kind: "deposit", date: D, vaultId: mainVault, amount: "15000000", currency: "IQD" }, ownerId));
        await addExpenses(mainVault);
        expect(await bal("trader_branch", ahmed)).toBe("10000000");
        expect(await bal("vault", mainVault)).toBe("5000000");
        expect(await bal("vault", branchVault)).toBe("20000000");
        expect(await bal("party", branchId)).toBe("10000000"); // the branch owes the owner
        const [c] = await db.select().from(containerCharges).where(eq(containerCharges.paidByPartyId, branchId));
        expect(c.paidFromVaultId).toBe(mainVault);
    });

    it("a dollar expense paid by the branch is turned into dinar at the typed rate", async () => {
        await expect(addExpenses(branchVault, { currency: "USD", amount: "500" })).rejects.toThrow("سعر الدولار");
        await addExpenses(branchVault, { currency: "USD", amount: "500", fxRate: "1,320" });
        expect(await bal("trader_branch", ahmed)).toBe("660000");
        const [c] = await db.select().from(containerCharges).where(eq(containerCharges.paidByPartyId, branchId));
        expect(c.currency).toBe("IQD");
        expect(c.amount).toBe("660000.00");
        expect(c.note).toContain("1,320");
    });

    it("the customer pays the owner everything; the owner picks the split and then holds the branch's part", async () => {
        await addExpenses(branchVault);
        await withTx((tx) =>
            money.postMoney(
                tx,
                { kind: "receive_trader", date: D, traderId: ahmed, vaultId: mainVault, amount: "11150000", currency: "IQD", branchAmount: "10000000" },
                ownerId,
            ),
        );
        expect(await bal("trader", ahmed)).toBe("0");
        expect(await bal("trader_branch", ahmed)).toBe("0");
        expect(await bal("vault", mainVault)).toBe("11150000");
        expect(await bal("party", branchId)).toBe("-10000000"); // the owner holds 10,000,000 for the branch

        // Handover: the owner moves it to the branch's vault, and they're square.
        await withTx((tx) =>
            money.postMoney(
                tx,
                { kind: "transfer", date: D, fromVaultId: mainVault, toVaultId: branchVault, amount: "10000000", currency: "IQD", settleBranch: true },
                ownerId,
            ),
        );
        expect(await bal("party", branchId)).toBe("0");
        expect(await bal("vault", branchVault)).toBe("20000000");
        expect(await bal("vault", mainVault)).toBe("1150000");
    });

    it("the customer pays the branch directly into its vault", async () => {
        await addExpenses(branchVault);
        await withTx((tx) =>
            money.postMoney(
                tx,
                { kind: "receive_trader", date: D, traderId: ahmed, vaultId: branchVault, amount: "10000000", currency: "IQD", branchAmount: "10000000" },
                ownerId,
            ),
        );
        expect(await bal("trader_branch", ahmed)).toBe("0");
        expect(await bal("trader", ahmed)).toBe("1150000");
        expect(await bal("vault", branchVault)).toBe("20000000");
        expect(await bal("party", branchId)).toBe("0");
    });

    it("the customer pays the owner's fee to the branch: the branch then owes it to the owner", async () => {
        await addExpenses(branchVault);
        await withTx((tx) =>
            money.postMoney(tx, { kind: "receive_trader", date: D, traderId: ahmed, vaultId: branchVault, amount: "1150000", currency: "IQD" }, ownerId),
        );
        expect(await bal("trader", ahmed)).toBe("0");
        expect(await bal("party", branchId)).toBe("1150000");
    });

    it("moving cash without settling (profit taken out) leaves their account alone", async () => {
        await withTx((tx) =>
            money.postMoney(
                tx,
                { kind: "transfer", date: D, fromVaultId: branchVault, toVaultId: mainVault, amount: "3000000", currency: "IQD", settleBranch: false },
                ownerId,
            ),
        );
        expect(await bal("party", branchId)).toBe("0");
        expect(await bal("vault", mainVault)).toBe("3000000");
    });

    it("refuses a split bigger than the payment, and the branch's vault for the owner's dealings with outside parties", async () => {
        await expect(
            withTx((tx) =>
                money.postMoney(tx, { kind: "receive_trader", date: D, traderId: ahmed, vaultId: mainVault, amount: "100", currency: "IQD", branchAmount: "200" }, ownerId),
            ),
        ).rejects.toThrow();
        const china = (await db.select().from(parties).where(eq(parties.name, "شركة التخليص - الصين")))[0].id;
        await expect(
            withTx((tx) => money.postMoney(tx, { kind: "pay_party", date: D, partyId: china, vaultId: branchVault, amount: "100", currency: "IQD" }, ownerId)),
        ).rejects.toThrow("قاصة الشراكة");
        await expect(
            withTx((tx) => money.postMoney(tx, { kind: "pay_party", date: D, partyId: branchId, vaultId: mainVault, amount: "100", currency: "IQD" }, ownerId)),
        ).rejects.toThrow("تحويل");
    });

    it("cancelling a branch expense puts every balance back", async () => {
        await withTx((tx) => money.postMoney(tx, { kind: "deposit", date: D, vaultId: mainVault, amount: "15000000", currency: "IQD" }, ownerId));
        const {
            charges: [first],
        } = await addExpenses(mainVault, {});
        await withTx((tx) => charges.cancelCharge(tx, first.chargeId, "خطأ", ownerId));
        expect(await bal("trader_branch", ahmed)).toBe("0");
        expect(await bal("party", branchId)).toBe("0");
    });
});
