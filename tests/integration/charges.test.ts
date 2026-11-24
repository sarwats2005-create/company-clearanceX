import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, withTx } from "@/db";
import {
    chargeTypeDefaults,
    chargeTypes,
    containerChargeAllocations,
    containerCharges,
    containerSizes,
    journalEntries,
    parties,
    shippingLines,
    traders,
    users,
    vaults,
} from "@/db/schema";
import { seed } from "@/db/seed";
import { getChargeSheetData, getContainerCharges, getContainerMoney } from "@/features/charges/queries";
import * as charges from "@/features/charges/service";
import { listContainers } from "@/features/containers/queries";
import * as containers from "@/features/containers/service";
import { getBalance, getBalances } from "@/features/ledger/balances";
import { postEntry } from "@/features/ledger/post-entry";
import * as postings from "@/features/ledger/postings";
import { vaultShortfalls } from "@/features/ledger/vault-check";
import { DomainError } from "@/lib/errors";
import { closeDb, resetDb } from "../helpers/db";

const D = "2026-11-20";
let ownerId: string;
let msc: string;
let ahmed: string;
let haider: string;
let size40: string;
let china: string;
let ummQasr: string;
let self: string;
let mainVault: string;
let usdVault: string;
const type: Record<string, string> = {};

beforeEach(async () => {
    await resetDb();
    await seed(db, { username: "owner", password: "owner-pass-123", name: "أبو علي" });
    ownerId = (await db.select().from(users))[0].id;
    msc = (await db.select().from(shippingLines).orderBy(asc(shippingLines.sortOrder)))[0].id;
    [ahmed, haider] = (
        await db
            .insert(traders)
            .values([{ name: "أحمد كاظم" }, { name: "حيدر عبد الله" }])
            .returning()
    ).map((t) => t.id);
    size40 = (await db.select().from(containerSizes).where(eq(containerSizes.code, "40ft")))[0].id;
    const ps = await db.select().from(parties);
    china = ps.find((p) => p.name === "شركة التخليص - الصين")!.id;
    ummQasr = ps.find((p) => p.kind === "partner")!.id;
    self = ps.find((p) => p.kind === "self")!.id;
    const vs = await db.select().from(vaults);
    mainVault = vs.find((v) => v.kind === "main")!.id;
    usdVault = vs.find((v) => v.kind === "usd")!.id;
    for (const ct of await db.select().from(chargeTypes)) type[ct.name] = ct.id;
});
afterAll(closeDb);

const normal = () =>
    withTx((tx) =>
        containers.createContainer(
            tx,
            { containerNumber: "MSCU4829175", shippingLineId: msc, containerSizeId: size40, isShared: false, shares: [{ traderId: ahmed }] },
            ownerId,
        ),
    );
const shared = () =>
    withTx((tx) =>
        containers.createContainer(
            tx,
            {
                containerNumber: "CMAU3390418",
                shippingLineId: msc,
                containerSizeId: size40,
                isShared: true,
                splitUnit: "meters",
                shares: [
                    { traderId: ahmed, shareValue: "4" },
                    { traderId: haider, shareValue: "5.5" },
                ],
            },
            ownerId,
        ),
    );
const add = (input: charges.AddChargesInput) => withTx((tx) => charges.addCharges(tx, input, ownerId));
const fails = async (p: Promise<unknown>) => {
    try {
        await p;
    } catch (e) {
        expect(e).toBeInstanceOf(DomainError);
        return e as DomainError;
    }
    throw new Error("expected a DomainError");
};
const allocationsOf = async (chargeId: string) =>
    (await db.select().from(containerChargeAllocations).where(eq(containerChargeAllocations.chargeId, chargeId))).map((a) => ({
        traderId: a.traderId,
        amount: a.amount,
    }));

describe("addCharges", () => {
    it("posts one entry per charge on a normal container: trader عليه, party له", async () => {
        const c = await normal();
        const res = await add({
            containerId: c.id,
            date: D,
            rows: [
                { chargeTypeId: type["كمرك بصرة"], amount: "2,000", currency: "USD", paidByPartyId: china },
                { chargeTypeId: type["غرامة ميناء"], amount: "100", currency: "USD", paidByPartyId: ummQasr },
                { chargeTypeId: type["أتعاب شركة"], amount: "300", currency: "USD" },
            ],
        });
        expect(res.charges).toHaveLength(3);
        expect(new Set(res.charges.map((x) => x.entryId)).size).toBe(3);
        expect(res.charges.every((x) => x.receiptNo === null)).toBe(true);

        expect(await getBalance(db, { kind: "trader", refId: ahmed }, "USD")).toBe("2400.00");
        expect(await getBalance(db, { kind: "party", refId: china }, "USD")).toBe("-2000.00");
        expect(await getBalance(db, { kind: "party", refId: ummQasr }, "USD")).toBe("-100.00");
        expect(await getBalance(db, { kind: "fee_income" }, "USD")).toBe("-300.00");

        const rows = await db.select().from(containerCharges).where(eq(containerCharges.containerId, c.id));
        const fee = rows.find((r) => r.chargeTypeId === type["أتعاب شركة"])!;
        expect(fee.isFee).toBe(true);
        expect(fee.paidByPartyId).toBeNull();
        expect(await allocationsOf(fee.id)).toEqual([{ traderId: ahmed, amount: "300.00" }]);

        const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.id, res.charges[0].entryId));
        expect(entry.type).toBe("container_charge");
        expect(entry.entryDate).toBe(D);
        expect(entry.description).toBe("كمرك بصرة · MSCU4829175");
        expect(entry.containerId).toBe(c.id);
    });

    it("reproduces PRD §5.6: allocations add up to each charge and trader totals match", async () => {
        const c = await shared();
        await add({
            containerId: c.id,
            date: D,
            rows: [
                { chargeTypeId: type["كمرك بصرة"], amount: "2000", currency: "USD", paidByPartyId: china },
                { chargeTypeId: type["غرامة ميناء"], amount: "130000", currency: "IQD", paidByPartyId: ummQasr },
                { chargeTypeId: type["أتعاب شركة"], amount: "300", currency: "USD" },
                { chargeTypeId: type["أجور نقل بحري"], amount: "900", currency: "USD", paidByPartyId: china, splitMode: "manual", manual: { [ahmed]: "900" } },
            ],
        });
        const rows = await db.select().from(containerCharges).where(eq(containerCharges.containerId, c.id));
        expect(rows).toHaveLength(4);
        for (const r of rows) {
            const allocs = await allocationsOf(r.id);
            expect(allocs.every((a) => Number(a.amount) > 0)).toBe(true);
            expect(allocs.reduce((s, a) => s + Number(a.amount), 0)).toBeCloseTo(Number(r.amount), 2);
        }
        expect(await getBalances(db, "trader", ahmed)).toEqual({ IQD: "54737", USD: "1868.43" });
        expect(await getBalances(db, "trader", haider)).toEqual({ IQD: "75263", USD: "1331.57" });
        expect(await getBalance(db, { kind: "party", refId: china }, "USD")).toBe("-2900.00");
        const manual = rows.find((r) => r.chargeTypeId === type["أجور نقل بحري"])!;
        expect(manual.splitMode).toBe("manual");
    });

    it("pays from our vault with an out receipt when شركتنا paid", async () => {
        const c = await normal();
        await withTx((tx) =>
            postEntry(tx, { type: "deposit", date: D, description: "إيداع", lines: postings.deposit({ vaultId: usdVault, currency: "USD", amount: "5000" }) }),
        );
        const res = await add({
            containerId: c.id,
            date: D,
            rows: [{ chargeTypeId: type["كمرك بصرة"], amount: "2000", currency: "USD", paidByPartyId: self, vaultId: usdVault }],
        });
        expect(res.charges[0].receiptNo).toBe("ص-000001");
        expect(await getBalance(db, { kind: "vault", refId: usdVault }, "USD")).toBe("3000.00");
        expect(await getBalance(db, { kind: "trader", refId: ahmed }, "USD")).toBe("2000.00");
        const [row] = await db.select().from(containerCharges);
        expect(row.paidFromVaultId).toBe(usdVault);
    });

    it("asks before a vault goes negative, and saves once confirmed", async () => {
        const c = await normal();
        const row = { chargeTypeId: type["كمرك بصرة"], amount: "2000", currency: "USD" as const, paidByPartyId: self, vaultId: usdVault };
        const e = await fails(add({ containerId: c.id, date: D, rows: [row] }));
        expect(e.field).toBe("allowNegative");
        expect(await db.select().from(containerCharges)).toHaveLength(0);
        await add({ containerId: c.id, date: D, rows: [row], allowNegative: true });
        expect(await getBalance(db, { kind: "vault", refId: usdVault }, "USD")).toBe("-2000.00");
    });

    it("refuses bad rows with a message on the right field, saving nothing", async () => {
        const c = await normal();
        const s = await shared();
        const cases: [charges.AddChargesInput, string][] = [
            [{ containerId: c.id, date: D, rows: [] }, "rows"],
            [{ containerId: c.id, date: D, rows: [{ chargeTypeId: type["كمرك بصرة"], amount: "0", currency: "USD", paidByPartyId: china }] }, "rows.0.amount"],
            [{ containerId: c.id, date: D, rows: [{ chargeTypeId: type["كمرك بصرة"], amount: "2000", currency: "USD" }] }, "rows.0.paidByPartyId"],
            [
                { containerId: c.id, date: D, rows: [{ chargeTypeId: type["كمرك بصرة"], amount: "2000", currency: "USD", paidByPartyId: self }] },
                "rows.0.vaultId",
            ],
            [
                {
                    containerId: c.id,
                    date: D,
                    rows: [{ chargeTypeId: type["كمرك بصرة"], amount: "2000", currency: "USD", paidByPartyId: self, vaultId: mainVault }],
                },
                "rows.0.vaultId",
            ],
            [
                {
                    containerId: s.id,
                    date: D,
                    rows: [
                        {
                            chargeTypeId: type["كمرك بصرة"],
                            amount: "900",
                            currency: "USD",
                            paidByPartyId: china,
                            splitMode: "manual",
                            manual: { [ahmed]: "500", [haider]: "300" },
                        },
                    ],
                },
                "rows.0.manual",
            ],
        ];
        for (const [input, field] of cases) {
            let err: { field?: string; issues?: { path: (string | number)[] }[] } | undefined;
            try {
                await add(input);
            } catch (e) {
                err = e as never;
            }
            const got = err?.field ?? err?.issues?.[0]?.path.join(".");
            expect(got, JSON.stringify(input.rows)).toBe(field);
        }
        const manual = await fails(
            add({
                containerId: s.id,
                date: D,
                rows: [
                    {
                        chargeTypeId: type["كمرك بصرة"],
                        amount: "900",
                        currency: "USD",
                        paidByPartyId: china,
                        splitMode: "manual",
                        manual: { [ahmed]: "500", [haider]: "300" },
                    },
                ],
            }),
        );
        expect(manual.message).toContain("100 $");
        expect(await db.select().from(containerCharges)).toHaveLength(0);
    });

    it("refuses charges on a cancelled container", async () => {
        const c = await normal();
        await withTx((tx) => containers.archiveContainer(tx, c.id, ownerId));
        await fails(add({ containerId: c.id, date: D, rows: [{ chargeTypeId: type["أتعاب شركة"], amount: "300", currency: "USD" }] }));
    });
});

describe("cancelCharge", () => {
    it("reverses the entry, restores balances and keeps both visible", async () => {
        const c = await normal();
        const res = await add({
            containerId: c.id,
            date: D,
            rows: [{ chargeTypeId: type["كمرك بصرة"], amount: "2000", currency: "USD", paidByPartyId: china }],
        });
        const chargeId = res.charges[0].chargeId;
        await withTx((tx) => charges.cancelCharge(tx, chargeId, "مبلغ خطأ", ownerId));

        expect(await getBalance(db, { kind: "trader", refId: ahmed }, "USD")).toBe("0.00");
        expect(await getBalance(db, { kind: "party", refId: china }, "USD")).toBe("0.00");
        const [row] = await db.select().from(containerCharges).where(eq(containerCharges.id, chargeId));
        expect(row.cancelledAt).not.toBeNull();
        expect(row.cancelReason).toBe("مبلغ خطأ");
        const entries = await db.select().from(journalEntries);
        expect(entries).toHaveLength(2);
        expect(entries.find((e) => e.id === res.charges[0].entryId)!.cancelledAt).not.toBeNull();
        expect(await containers.activeChargeCount(db, c.id)).toBe(0);
    });

    it("needs a reason and refuses to cancel twice", async () => {
        const c = await normal();
        const res = await add({ containerId: c.id, date: D, rows: [{ chargeTypeId: type["أتعاب شركة"], amount: "300", currency: "USD" }] });
        const chargeId = res.charges[0].chargeId;
        expect((await fails(withTx((tx) => charges.cancelCharge(tx, chargeId, "  ", ownerId)))).field).toBe("reason");
        await withTx((tx) => charges.cancelCharge(tx, chargeId, "خطأ", ownerId));
        await fails(withTx((tx) => charges.cancelCharge(tx, chargeId, "خطأ", ownerId)));
    });
});

describe("re-split after shares change", () => {
    it("lists the affected charges with old and new parts, then cancels and re-posts them", async () => {
        const c = await shared();
        await add({
            containerId: c.id,
            date: D,
            rows: [
                { chargeTypeId: type["كمرك بصرة"], amount: "2000", currency: "USD", paidByPartyId: china },
                { chargeTypeId: type["أجور نقل بحري"], amount: "900", currency: "USD", paidByPartyId: china, splitMode: "manual", manual: { [ahmed]: "900" } },
            ],
        });
        expect(await charges.planResplit(db, c.id)).toEqual([]);

        await withTx((tx) =>
            containers.updateContainer(
                tx,
                c.id,
                {
                    containerNumber: "CMAU3390418",
                    shippingLineId: msc,
                    containerSizeId: size40,
                    isShared: true,
                    splitUnit: "meters",
                    shares: [
                        { traderId: ahmed, shareValue: "6" },
                        { traderId: haider, shareValue: "4" },
                    ],
                },
                ownerId,
            ),
        );
        const plan = await charges.planResplit(db, c.id);
        expect(plan).toHaveLength(1); // the manual charge stays as typed
        expect(plan[0].chargeTypeName).toBe("كمرك بصرة");
        expect(plan[0].before.map((a) => a.amount)).toEqual(["842.11", "1157.89"]);
        expect(plan[0].after.map((a) => a.amount)).toEqual(["1200.00", "800.00"]);

        await withTx((tx) => charges.resplitCharges(tx, c.id, ownerId));
        expect(await getBalance(db, { kind: "trader", refId: ahmed }, "USD")).toBe("2100.00");
        expect(await getBalance(db, { kind: "trader", refId: haider }, "USD")).toBe("800.00");
        expect(await getBalance(db, { kind: "party", refId: china }, "USD")).toBe("-2900.00");
        expect(await containers.activeChargeCount(db, c.id)).toBe(2);
        expect(await charges.planResplit(db, c.id)).toEqual([]);
    });
});

describe("vaultShortfalls", () => {
    it("names each vault that would go below zero", async () => {
        await withTx((tx) =>
            postEntry(tx, { type: "deposit", date: D, description: "إيداع", lines: postings.deposit({ vaultId: usdVault, currency: "USD", amount: "1000" }) }),
        );
        expect(await vaultShortfalls(db, [{ vaultId: usdVault, currency: "USD", amount: "600" }])).toEqual([]);
        const out = await vaultShortfalls(db, [
            { vaultId: usdVault, currency: "USD", amount: "600" },
            { vaultId: usdVault, currency: "USD", amount: "600" },
        ]);
        expect(out).toEqual([{ vaultId: usdVault, vaultName: "قاصة الدولار", currency: "USD", balance: "1000.00", after: "-200.00" }]);
    });
});

describe("container charges view", () => {
    it("prefills amounts for the container size and lists our company first", async () => {
        const c = await normal();
        await db.insert(chargeTypeDefaults).values([
            { chargeTypeId: type["أتعاب شركة"], containerSizeId: null, amount: "250" },
            { chargeTypeId: type["أتعاب شركة"], containerSizeId: size40, amount: "300" },
            { chargeTypeId: type["غرامة ميناء"], containerSizeId: null, amount: "50000" },
        ]);
        const data = await getChargeSheetData(db, c.id);
        expect(data!.chargeTypes.map((t) => t.name)).toEqual([
            "كمرك بصرة",
            "غرامة شركة الشحن",
            "غرامة ميناء",
            "أجور نقل بحري",
            "أتعاب شركة",
            "أجور نقل الجوي",
            "أتعاب أجور نقل",
        ]);
        expect(data!.chargeTypes.find((t) => t.id === type["أتعاب شركة"])!.defaultAmount).toBe("300.00");
        expect(data!.chargeTypes.find((t) => t.id === type["غرامة ميناء"])!.defaultAmount).toBe("50000");
        expect(data!.chargeTypes.find((t) => t.id === type["كمرك بصرة"])!.defaultAmount).toBeNull();
        expect(data!.parties[0].id).toBe(self);
        expect(data!.defaultVaults).toEqual({ IQD: mainVault, USD: usdVault });
        expect(data!.container.shares).toEqual([{ traderId: ahmed, name: "أحمد كاظم", shareValue: null }]);
    });

    it("summarizes costs, fees, what we owe each party and each trader's part", async () => {
        const c = await shared();
        await add({
            containerId: c.id,
            date: D,
            rows: [
                { chargeTypeId: type["كمرك بصرة"], amount: "2000", currency: "USD", paidByPartyId: china },
                { chargeTypeId: type["غرامة ميناء"], amount: "130000", currency: "IQD", paidByPartyId: ummQasr },
                { chargeTypeId: type["أتعاب شركة"], amount: "300", currency: "USD" },
            ],
        });
        const res = await add({
            containerId: c.id,
            date: D,
            rows: [{ chargeTypeId: type["غرامة شركة الشحن"], amount: "50", currency: "USD", paidByPartyId: china }],
        });
        await withTx((tx) => charges.cancelCharge(tx, res.charges[0].chargeId, "مكرر", ownerId));

        const list = await getContainerCharges(db, c.id);
        expect(list).toHaveLength(4);
        expect(list.filter((x) => x.cancelledAt)).toHaveLength(1);
        const customs = list.find((x) => x.chargeTypeName === "كمرك بصرة")!;
        expect(customs.payerLabel).toBe("شركة التخليص - الصين");
        expect(customs.allocations.map((a) => [a.traderName, a.amount])).toEqual([
            ["أحمد كاظم", "842.11"],
            ["حيدر عبد الله", "1157.89"],
        ]);
        expect(list.find((x) => x.isFee)!.payerLabel).toBe("ربح الشركة");

        const money = await getContainerMoney(db, c.id);
        expect(money.costs).toEqual({ IQD: "130000", USD: "2000.00" });
        expect(money.fees).toEqual({ IQD: "0", USD: "300.00" });
        expect(money.total).toEqual({ IQD: "130000", USD: "2300.00" });
        expect(money.owedToParties).toEqual([
            { partyId: china, name: "شركة التخليص - الصين", amounts: { IQD: "0", USD: "2000.00" } },
            { partyId: ummQasr, name: "شراكة تخليص أم قصر", amounts: { IQD: "130000", USD: "0.00" } },
        ]);
        expect(money.traders.map((t) => [t.name, t.part, t.balance])).toEqual([
            ["أحمد كاظم", { IQD: "54737", USD: "968.43" }, { IQD: "54737", USD: "968.43" }],
            ["حيدر عبد الله", { IQD: "75263", USD: "1331.57" }, { IQD: "75263", USD: "1331.57" }],
        ]);
    });
});

describe("a trader's containers tab (PRD §8.8)", () => {
    it("shows the trader's own part of each container's charges, not the whole container", async () => {
        const c = await shared();
        await add({
            containerId: c.id,
            date: "2026-11-20",
            rows: [{ chargeTypeId: type["كمرك بصرة"], amount: "2000", currency: "USD", paidByPartyId: china }],
        });
        const fine = await add({
            containerId: c.id,
            date: "2026-11-20",
            rows: [{ chargeTypeId: type["غرامة ميناء"], amount: "190000", currency: "IQD", paidByPartyId: ummQasr }],
        });

        const whole = await listContainers(db, { traderId: ahmed });
        expect(whole.rows[0].totals).toEqual({ USD: "2000.00", IQD: "190000.00" });

        const mine = await listContainers(db, { traderId: ahmed, totalsOf: ahmed });
        const theirs = await listContainers(db, { traderId: haider, totalsOf: haider });
        expect(mine.rows[0].totals).toEqual({ USD: "842.11", IQD: "80000.00" }); // shares 4 : 5.5
        expect(theirs.rows[0].totals).toEqual({ USD: "1157.89", IQD: "110000.00" });

        await withTx((tx) => charges.cancelCharge(tx, fine.charges[0].chargeId, "خطأ", ownerId));
        expect((await listContainers(db, { traderId: ahmed, totalsOf: ahmed })).rows[0].totals).toEqual({ USD: "842.11" });
    });
});
