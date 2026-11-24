import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, withTx } from "@/db";
import { containers, parties, shippingLines, traders, users, vaults } from "@/db/schema";
import { seed } from "@/db/seed";
import {
    balancesAsOf,
    getPartyAccount,
    getTraderAccount,
    getVaultAccount,
    listPartyAccounts,
    listTraderAccounts,
    listVaultAccounts,
} from "@/features/accounts/queries";
import * as accounts from "@/features/accounts/service";
import * as containersSvc from "@/features/containers/service";
import { getStatement } from "@/features/ledger/statements";
import * as money from "@/features/money/service";
import { DomainError } from "@/lib/errors";
import { closeDb, resetDb } from "../helpers/db";

const D = "2026-11-22";
let ownerId: string;
let ahmed: string;
let haider: string;
let ali: string;
let zaid: string;
let self: string;
let china: string;
let ummQasr: string;
let main: string;
let usd: string;
let msc: string;

beforeEach(async () => {
    await resetDb();
    await seed(db, { username: "owner", password: "owner-pass-123", name: "أبو علي" });
    ownerId = (await db.select().from(users))[0].id;
    [ahmed, haider, ali, zaid] = (
        await db
            .insert(traders)
            .values([{ name: "أحمد كاظم", phone: "07701234567", city: "بغداد" }, { name: "حيدر عبد الله" }, { name: "علي حسن" }, { name: "زيد محمد" }])
            .returning()
    ).map((t) => t.id);
    const ps = await db.select().from(parties);
    self = ps.find((p) => p.kind === "self")!.id;
    china = ps.find((p) => p.name === "شركة التخليص - الصين")!.id;
    ummQasr = ps.find((p) => p.name === "شراكة تخليص أم قصر")!.id;
    const vs = await db.select().from(vaults);
    main = vs.find((v) => v.kind === "main")!.id;
    usd = vs.find((v) => v.kind === "usd")!.id;
    msc = (await db.select().from(shippingLines).orderBy(asc(shippingLines.sortOrder)))[0].id;
});
afterAll(closeDb);

const post = (input: money.MoneyInput) => withTx((tx) => money.postMoney(tx, { allowNegative: true, ...input }, ownerId));
const fails = async (p: Promise<unknown>) => {
    try {
        await p;
    } catch (e) {
        return e as DomainError & { issues?: { path: (string | number)[] }[] };
    }
    throw new Error("expected an error");
};
const fieldOf = (e: DomainError & { issues?: { path: (string | number)[] }[] }) => e.field ?? e.issues?.[0]?.path.join(".");

describe("listTraderAccounts (US-16)", () => {
    beforeEach(async () => {
        await post({ kind: "pay_trader", date: D, traderId: ahmed, vaultId: usd, amount: "2400", currency: "USD", reason: "advance" }); // عليه 2,400 $
        await post({ kind: "pay_trader", date: D, traderId: haider, vaultId: main, amount: "1000000", currency: "IQD", reason: "advance" }); // عليه ≈ 763 $
        await post({ kind: "receive_trader", date: D, traderId: ali, vaultId: usd, amount: "50", currency: "USD" }); // له 50 $
    });

    it("shows both balances and puts the largest debt first (USD counted at the rate)", async () => {
        const rows = await listTraderAccounts(db, {});
        expect(rows.map((r) => r.name)).toEqual(["أحمد كاظم", "حيدر عبد الله", "زيد محمد", "علي حسن"]);
        expect(rows[0]).toMatchObject({ phone: "07701234567", city: "بغداد", balance: { USD: "2400.00", IQD: "0" } });
        expect(rows[1].balance).toEqual({ USD: "0.00", IQD: "1000000" });
        expect(rows[3].balance.USD).toBe("-50.00");
    });

    it("filters to traders who owe us, and searches name and phone ignoring hamza", async () => {
        expect((await listTraderAccounts(db, { debtsOnly: true })).map((r) => r.name)).toEqual(["أحمد كاظم", "حيدر عبد الله"]);
        expect((await listTraderAccounts(db, { q: "احمد" })).map((r) => r.name)).toEqual(["أحمد كاظم"]);
        expect((await listTraderAccounts(db, { q: "0770" })).map((r) => r.name)).toEqual(["أحمد كاظم"]);
        expect(await listTraderAccounts(db, { q: "لا يوجد" })).toEqual([]);
    });

    it("counts only containers still in progress", async () => {
        const a = await withTx((tx) =>
            containersSvc.createContainer(tx, { containerNumber: "MSCU4829175", shippingLineId: msc, isShared: false, shares: [{ traderId: ahmed }] }, ownerId),
        );
        await withTx((tx) =>
            containersSvc.createContainer(tx, { containerNumber: "MSCU1234565", shippingLineId: msc, isShared: false, shares: [{ traderId: ahmed }] }, ownerId),
        );
        await db.update(containers).set({ status: "delivered", deliveredOn: D }).where(eq(containers.id, a.id));
        const rows = await listTraderAccounts(db, {});
        expect(rows.find((r) => r.id === ahmed)!.activeContainers).toBe(1);
        expect(rows.find((r) => r.id === zaid)!.activeContainers).toBe(0);

        const acc = await getTraderAccount(db, ahmed);
        expect(acc).toMatchObject({ trader: { name: "أحمد كاظم" }, balance: { USD: "2400.00", IQD: "0" }, activeContainers: 1 });
        expect(await getTraderAccount(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
    });
});

describe("listPartyAccounts (US-18)", () => {
    it("leaves out our own company and puts what we owe most first", async () => {
        await post({ kind: "receive_party", date: D, partyId: china, vaultId: usd, amount: "500", currency: "USD" }); // له 500 $
        await post({ kind: "receive_party", date: D, partyId: ummQasr, vaultId: main, amount: "1310000", currency: "IQD" }); // له ≈ 1,000 $
        const rows = await listPartyAccounts(db);
        expect(rows.map((r) => r.id)).toEqual([ummQasr, china]);
        expect(rows.map((r) => r.id)).not.toContain(self);
        expect(rows[1].balance).toEqual({ USD: "-500.00", IQD: "0" });
        expect(await getPartyAccount(db, self)).toBeNull();
        expect((await getPartyAccount(db, china))!.balance.USD).toBe("-500.00");
    });
});

describe("vaults (US-19)", () => {
    const save = (input: accounts.VaultInput) => withTx((tx) => accounts.saveVault(tx, input, ownerId));

    it("lists the main vault first, then the dollar vault, then custom vaults", async () => {
        const shop = await save({ name: "صيرفة الأمين", kind: "exchange_shop", allowedCurrencies: ["IQD", "USD"], notes: "شارع الكويت" });
        await post({ kind: "deposit", date: D, vaultId: shop, amount: "100", currency: "USD" });
        const rows = await listVaultAccounts(db);
        expect(rows.map((r) => r.id)).toEqual([main, usd, shop]);
        expect(rows[2]).toMatchObject({ kind: "exchange_shop", allowedCurrencies: ["IQD", "USD"], notes: "شارع الكويت", balance: { USD: "100.00", IQD: "0" } });
        expect((await getVaultAccount(db, shop))!.vault.name).toBe("صيرفة الأمين");
    });

    it("needs a name and at least one currency, and refuses a duplicate name", async () => {
        expect(fieldOf(await fails(save({ name: "خزنة", kind: "person", allowedCurrencies: [] })))).toBe("allowedCurrencies");
        expect(fieldOf(await fails(save({ name: " ", kind: "person", allowedCurrencies: ["IQD"] })))).toBe("name");
        expect(fieldOf(await fails(save({ name: "القاصة الرئيسية", kind: "person", allowedCurrencies: ["IQD"] })))).toBe("name");
    });

    it("lets the owner add a currency but not remove one the vault already used", async () => {
        const box = await save({ name: "أبو حسن", kind: "person", allowedCurrencies: ["IQD"] });
        await post({ kind: "deposit", date: D, vaultId: box, amount: "5000", currency: "IQD" });
        await save({ id: box, name: "أبو حسن", kind: "person", allowedCurrencies: ["IQD", "USD"] });
        expect((await getVaultAccount(db, box))!.vault.allowedCurrencies).toEqual(["IQD", "USD"]);
        const e = await fails(save({ id: box, name: "أبو حسن", kind: "person", allowedCurrencies: ["USD"] }));
        expect(fieldOf(e)).toBe("allowedCurrencies");
    });

    it("keeps the main vault's kind and never stops it", async () => {
        await save({ id: main, name: "القاصة الرئيسية - المكتب", kind: "other", allowedCurrencies: ["IQD"] });
        const v = (await getVaultAccount(db, main))!.vault;
        expect(v).toMatchObject({ name: "القاصة الرئيسية - المكتب", kind: "main" });
        await expect(withTx((tx) => accounts.setVaultActive(tx, main, false, ownerId))).rejects.toBeInstanceOf(DomainError);
    });

    it("stops a vault only when it is empty", async () => {
        const box = await save({ name: "أبو حسن", kind: "person", allowedCurrencies: ["IQD"] });
        await post({ kind: "deposit", date: D, vaultId: box, amount: "5000", currency: "IQD" });
        await expect(withTx((tx) => accounts.setVaultActive(tx, box, false, ownerId))).rejects.toThrow("حوّل");
        await post({ kind: "withdraw", date: D, vaultId: box, amount: "5000", currency: "IQD" });
        await withTx((tx) => accounts.setVaultActive(tx, box, false, ownerId));
        expect((await getVaultAccount(db, box))!.vault.isActive).toBe(false);
    });
});

describe("updateTrader (trader info tab)", () => {
    const update = (input: accounts.TraderUpdateInput) => withTx((tx) => accounts.updateTrader(tx, input, ownerId));

    it("saves name, phone, city and notes", async () => {
        await update({ id: ahmed, name: "أحمد كاظم جواد", phone: "07801112222", city: "البصرة", notes: "يدفع بالدولار" });
        expect((await getTraderAccount(db, ahmed))!.trader).toMatchObject({
            name: "أحمد كاظم جواد",
            phone: "07801112222",
            city: "البصرة",
            notes: "يدفع بالدولار",
        });
        await update({ id: ahmed, name: "أحمد كاظم جواد", phone: "", city: "", notes: "" });
        expect((await getTraderAccount(db, ahmed))!.trader).toMatchObject({ phone: null, city: null, notes: null });
    });

    it("refuses a name another trader already has", async () => {
        const e = await fails(update({ id: ahmed, name: "حيدر عبد الله" }));
        expect(e).toBeInstanceOf(DomainError);
        expect(fieldOf(e)).toBe("name");
    });
});

describe("statement running balance (PRD §8.8)", () => {
    it("opens the range with the earlier balance, runs through every movement, and keeps cancelled rows", async () => {
        await post({ kind: "pay_trader", date: "2026-10-05", traderId: ahmed, vaultId: usd, amount: "1000", currency: "USD", reason: "advance" });
        await post({ kind: "pay_trader", date: "2026-11-03", traderId: ahmed, vaultId: usd, amount: "500", currency: "USD", reason: "advance" });
        await post({ kind: "receive_trader", date: "2026-11-10", traderId: ahmed, vaultId: usd, amount: "1200", currency: "USD" });
        const wrong = await post({ kind: "receive_trader", date: "2026-11-12", traderId: ahmed, vaultId: usd, amount: "100", currency: "USD" });
        await withTx((tx) => money.cancelReceipt(tx, wrong.entryId, "المبلغ خطأ", ownerId, "2026-11-12"));
        await post({ kind: "receive_trader", date: "2026-12-01", traderId: ahmed, vaultId: usd, amount: "50", currency: "USD" });

        const st = await getStatement(db, { kind: "trader", refId: ahmed }, "USD", "2026-11-01", "2026-11-30");
        expect(st.opening).toBe("1000.00");
        expect(st.rows.map((r) => [r.date, r.debit, r.credit, r.balance, r.cancelled])).toEqual([
            ["2026-11-03", "500.00", "0.00", "1500.00", false],
            ["2026-11-10", "0.00", "1200.00", "300.00", false],
            ["2026-11-12", "0.00", "100.00", "200.00", true],
            ["2026-11-12", "100.00", "0.00", "300.00", true],
        ]);
        expect(st.rows[2].receiptNo).toBe(wrong.receiptNo);
        expect(st.closing).toBe("300.00");
        expect(st.totalDebit).toBe("600.00");
        expect(st.totalCredit).toBe("1300.00");

        expect(await balancesAsOf(db, "trader", ahmed, "2026-11-30")).toEqual({ USD: "300.00", IQD: "0" });
        expect(await balancesAsOf(db, "trader", ahmed)).toEqual({ USD: "250.00", IQD: "0" });
    });

    it("names the container on charge rows", async () => {
        const ct = await withTx((tx) =>
            containersSvc.createContainer(tx, { containerNumber: "MSCU4829175", shippingLineId: msc, isShared: false, shares: [{ traderId: ahmed }] }, ownerId),
        );
        const { addCharges } = await import("@/features/charges/service");
        const { chargeTypes } = await import("@/db/schema");
        const customs = (await db.select().from(chargeTypes).where(eq(chargeTypes.name, "كمرك بصرة")))[0].id;
        await withTx((tx) =>
            addCharges(tx, { containerId: ct.id, date: D, rows: [{ chargeTypeId: customs, amount: "2000", currency: "USD", paidByPartyId: china }] }, ownerId),
        );
        const st = await getStatement(db, { kind: "trader", refId: ahmed }, "USD");
        expect(st.rows[0]).toMatchObject({ containerId: ct.id, containerNumber: "MSCU4829175", debit: "2000.00", balance: "2000.00" });
    });
});
