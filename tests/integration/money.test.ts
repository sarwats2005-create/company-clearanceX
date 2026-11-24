import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, withTx } from "@/db";
import { chargeTypes, containerCharges, expenseCategories, journalEntries, parties, shippingLines, traders, users, vaults } from "@/db/schema";
import { seed } from "@/db/seed";
import * as charges from "@/features/charges/service";
import * as containers from "@/features/containers/service";
import { getBalance } from "@/features/ledger/balances";
import { getMoneyFormOptions, getReceipt, listJournal } from "@/features/money/queries";
import * as money from "@/features/money/service";
import { DomainError } from "@/lib/errors";
import { closeDb, resetDb } from "../helpers/db";

const D = "2026-11-22";
let ownerId: string;
let ahmed: string;
let china: string;
let self: string;
let main: string;
let usd: string;
let shop: string;
let rent: string;

beforeEach(async () => {
    await resetDb();
    await seed(db, { username: "owner", password: "owner-pass-123", name: "أبو علي" });
    ownerId = (await db.select().from(users))[0].id;
    [ahmed] = (
        await db
            .insert(traders)
            .values([{ name: "أحمد كاظم", phone: "07701234567" }])
            .returning()
    ).map((t) => t.id);
    const ps = await db.select().from(parties);
    china = ps.find((p) => p.name === "شركة التخليص - الصين")!.id;
    self = ps.find((p) => p.kind === "self")!.id;
    const vs = await db.select().from(vaults);
    main = vs.find((v) => v.kind === "main")!.id;
    usd = vs.find((v) => v.kind === "usd")!.id;
    shop = (
        await db
            .insert(vaults)
            .values({ name: "صيرفة الأمين", kind: "exchange_shop", allowedCurrencies: ["IQD", "USD"] })
            .returning()
    )[0].id;
    rent = (await db.select().from(expenseCategories).where(eq(expenseCategories.name, "إيجار")))[0].id; // seeded
});
afterAll(closeDb);

const post = (input: money.MoneyInput) => withTx((tx) => money.postMoney(tx, input, ownerId));
const bal = (kind: "trader" | "party" | "vault" | "owner_equity" | "fx" | "general_expense", refId: string | null, currency: "IQD" | "USD") =>
    getBalance(db, { kind, refId }, currency);
const fails = async (p: Promise<unknown>) => {
    try {
        await p;
    } catch (e) {
        return e as DomainError & { issues?: { path: (string | number)[] }[] };
    }
    throw new Error("expected an error");
};
const fieldOf = (e: DomainError & { issues?: { path: (string | number)[] }[] }) => e.field ?? e.issues?.[0]?.path.join(".");

describe("postMoney builds the PRD §6.3 postings", () => {
    it("A8 deposit and A4 receive from a trader: vault up, receipt ق", async () => {
        const dep = await post({ kind: "deposit", date: D, vaultId: main, amount: "1,000,000", currency: "IQD" });
        expect(dep.receiptNo).toBe("ق-000001");
        expect(await bal("vault", main, "IQD")).toBe("1000000");
        expect(await bal("owner_equity", null, "IQD")).toBe("-1000000");

        const rec = await post({ kind: "receive_trader", date: D, traderId: ahmed, vaultId: usd, amount: "2400", currency: "USD", note: "دفعة أولى" });
        expect(rec.receiptNo).toBe("ق-000002");
        expect(await bal("vault", usd, "USD")).toBe("2400.00");
        expect(await bal("trader", ahmed, "USD")).toBe("-2400.00");
        const [e] = await db.select().from(journalEntries).where(eq(journalEntries.id, rec.entryId));
        expect(e.type).toBe("receive_from_trader");
        expect(e.description).toBe("قبض من التاجر أحمد كاظم");
        expect(e.meta).toMatchObject({ note: "دفعة أولى" });
    });

    it("A4x: 3,144,000 IQD at 1,310 clears a 2,400 $ debt through FX", async () => {
        const r = await post({
            kind: "receive_trader",
            date: D,
            traderId: ahmed,
            vaultId: main,
            amount: "3144000",
            currency: "IQD",
            fx: { debtCurrency: "USD", debtAmount: "2400" },
        });
        expect(await bal("vault", main, "IQD")).toBe("3144000");
        expect(await bal("trader", ahmed, "USD")).toBe("-2400.00");
        expect(await bal("trader", ahmed, "IQD")).toBe("0");
        expect(await bal("fx", null, "IQD")).toBe("-3144000");
        expect(await bal("fx", null, "USD")).toBe("2400.00");
        const [e] = await db.select().from(journalEntries).where(eq(journalEntries.id, r.entryId));
        expect(e.fxRate).toBe("1310.0000");
    });

    it("A5 pay a party (also cross-currency), A6 pay a trader, A7 receive from a party", async () => {
        await post({ kind: "deposit", date: D, vaultId: usd, amount: "5000", currency: "USD" });
        const p = await post({ kind: "pay_party", date: D, partyId: china, vaultId: usd, amount: "2000", currency: "USD" });
        expect(p.receiptNo).toBe("ص-000001");
        expect(await bal("party", china, "USD")).toBe("2000.00");
        expect(await bal("vault", usd, "USD")).toBe("3000.00");

        await post({ kind: "deposit", date: D, vaultId: main, amount: "2000000", currency: "IQD" });
        await post({
            kind: "pay_party",
            date: D,
            partyId: china,
            vaultId: main,
            amount: "1310000",
            currency: "IQD",
            fx: { debtCurrency: "USD", debtAmount: "1000" },
        });
        expect(await bal("party", china, "USD")).toBe("3000.00");
        expect(await bal("vault", main, "IQD")).toBe("690000");

        const t = await post({ kind: "pay_trader", date: D, traderId: ahmed, vaultId: usd, amount: "100", currency: "USD", reason: "advance" });
        expect(await bal("trader", ahmed, "USD")).toBe("100.00");
        const [e] = await db.select().from(journalEntries).where(eq(journalEntries.id, t.entryId));
        expect(e.description).toBe("دفع للتاجر أحمد كاظم · سلفة");

        await post({ kind: "receive_party", date: D, partyId: china, vaultId: usd, amount: "50", currency: "USD" });
        expect(await bal("party", china, "USD")).toBe("2950.00");
    });

    it("A9 withdraw, A10 transfer (ت), A11 exchange (ع), A12 general expense (ص)", async () => {
        await post({ kind: "deposit", date: D, vaultId: main, amount: "5000000", currency: "IQD" });
        await post({ kind: "withdraw", date: D, vaultId: main, amount: "100000", currency: "IQD" });
        expect(await bal("owner_equity", null, "IQD")).toBe("-4900000");

        const tr = await post({ kind: "transfer", date: D, fromVaultId: main, toVaultId: shop, amount: "1000000", currency: "IQD" });
        expect(tr.receiptNo).toBe("ت-000001");
        expect(await bal("vault", shop, "IQD")).toBe("1000000");

        const ex = await post({ kind: "exchange", date: D, fromVaultId: shop, fromCurrency: "IQD", fromAmount: "655000", toVaultId: usd, toAmount: "500" });
        expect(ex.receiptNo).toBe("ع-000001");
        expect(await bal("vault", shop, "IQD")).toBe("345000");
        const [e] = await db.select().from(journalEntries).where(eq(journalEntries.id, ex.entryId));
        expect(e.fxRate).toBe("1310.0000");
        expect(await bal("vault", usd, "USD")).toBe("500.00");

        const exp = await post({ kind: "expense", date: D, categoryId: rent, vaultId: main, amount: "500000", currency: "IQD", payee: "صاحب المكتب" });
        expect(exp.receiptNo).toBe("ص-000002");
        expect(await bal("general_expense", rent, "IQD")).toBe("500000");
        expect(await bal("vault", main, "IQD")).toBe("3400000");
    });
});

describe("postMoney refuses mistakes on the right field", () => {
    it("checks vault currency, same vault, same currency, our own company and the amount", async () => {
        const cases: [money.MoneyInput, string][] = [
            [{ kind: "receive_trader", date: D, traderId: ahmed, vaultId: main, amount: "10", currency: "USD" }, "vaultId"],
            [{ kind: "transfer", date: D, fromVaultId: main, toVaultId: main, amount: "10", currency: "IQD" }, "toVaultId"],
            [
                {
                    kind: "receive_trader",
                    date: D,
                    traderId: ahmed,
                    vaultId: main,
                    amount: "10",
                    currency: "IQD",
                    fx: { debtCurrency: "IQD", debtAmount: "10" },
                },
                "fx.debtCurrency",
            ],
            [{ kind: "pay_party", date: D, partyId: self, vaultId: main, amount: "10", currency: "IQD", allowNegative: true }, "partyId"],
            [{ kind: "deposit", date: D, vaultId: main, amount: "0", currency: "IQD" }, "amount"],
            [
                { kind: "exchange", date: D, fromVaultId: main, fromCurrency: "IQD", fromAmount: "1310", toVaultId: main, toAmount: "1", allowNegative: true },
                "toVaultId",
            ],
        ];
        for (const [input, field] of cases) expect(fieldOf(await fails(post(input))), JSON.stringify(input)).toBe(field);
        expect(await db.select().from(journalEntries)).toHaveLength(0);
    });

    it("willGoNegative: warns before a vault goes below zero and saves once confirmed", async () => {
        await post({ kind: "deposit", date: D, vaultId: usd, amount: "100", currency: "USD" });
        const e = await fails(post({ kind: "pay_party", date: D, partyId: china, vaultId: usd, amount: "150", currency: "USD" }));
        expect(e).toBeInstanceOf(DomainError);
        expect(e.field).toBe("allowNegative");
        expect(e.message).toBe("رصيد القاصة سيصبح سالباً. هل تريد المتابعة؟");
        await post({ kind: "pay_party", date: D, partyId: china, vaultId: usd, amount: "150", currency: "USD", allowNegative: true });
        expect(await bal("vault", usd, "USD")).toBe("-50.00");
        expect(await money.willGoNegative(db, { kind: "withdraw", date: D, vaultId: usd, amount: "1", currency: "USD" })).toEqual([
            { vaultId: usd, vaultName: "قاصة الدولار", currency: "USD", balance: "-50.00", after: "-51.00" },
        ]);
        expect(await money.willGoNegative(db, { kind: "deposit", date: D, vaultId: usd, amount: "1", currency: "USD" })).toEqual([]);
    });
});

describe("cancelReceipt", () => {
    it("reverses with the same letter and keeps both visible", async () => {
        const r = await post({ kind: "receive_trader", date: D, traderId: ahmed, vaultId: usd, amount: "2400", currency: "USD" });
        const c = await withTx((tx) => money.cancelReceipt(tx, r.entryId, "رقم خطأ", ownerId));
        expect(c.receiptNo).toBe("ق-000002");
        expect(await bal("trader", ahmed, "USD")).toBe("0.00");
        const [orig] = await db.select().from(journalEntries).where(eq(journalEntries.id, r.entryId));
        expect(orig.cancelReason).toBe("رقم خطأ");
        expect((await fails(withTx((tx) => money.cancelReceipt(tx, r.entryId, "مرة ثانية", ownerId)))).message).toBe("هذا الوصل ملغى مسبقاً");
        expect((await fails(withTx((tx) => money.cancelReceipt(tx, c.entryId, "x", ownerId)))).message).toBe("لا يمكن إلغاء قيد إلغاء");
    });

    it("cancels a container charge's receipt through the charge, so the container stays right", async () => {
        const msc = (await db.select().from(shippingLines).orderBy(asc(shippingLines.sortOrder)))[0].id;
        const ct = await withTx((tx) =>
            containers.createContainer(tx, { containerNumber: "MSCU4829175", shippingLineId: msc, isShared: false, shares: [{ traderId: ahmed }] }, ownerId),
        );
        const customs = (await db.select().from(chargeTypes).where(eq(chargeTypes.name, "كمرك بصرة")))[0].id;
        const res = await withTx((tx) =>
            charges.addCharges(
                tx,
                {
                    containerId: ct.id,
                    date: D,
                    allowNegative: true,
                    rows: [{ chargeTypeId: customs, amount: "2000", currency: "USD", paidByPartyId: self, vaultId: usd }],
                },
                ownerId,
            ),
        );
        await withTx((tx) => money.cancelReceipt(tx, res.charges[0].entryId, "خطأ", ownerId));
        const [row] = await db.select().from(containerCharges);
        expect(row.cancelledAt).not.toBeNull();
        expect(await containers.activeChargeCount(db, ct.id)).toBe(0);
    });
});

describe("journal and receipt", () => {
    it("lists entries newest first with filters and search", async () => {
        await post({ kind: "deposit", date: "2026-11-01", vaultId: main, amount: "1000000", currency: "IQD" });
        const r = await post({ kind: "receive_trader", date: D, traderId: ahmed, vaultId: usd, amount: "2400", currency: "USD" });
        await post({ kind: "pay_party", date: D, partyId: china, vaultId: usd, amount: "100", currency: "USD" });
        await withTx((tx) => money.cancelReceipt(tx, r.entryId, "خطأ", ownerId));
        // A charge a party paid moves no cash and has no receipt: it lives on the container, not in the journal.
        const msc = (await db.select().from(shippingLines).orderBy(asc(shippingLines.sortOrder)))[0].id;
        const ct = await withTx((tx) =>
            containers.createContainer(tx, { containerNumber: "MSCU4829175", shippingLineId: msc, isShared: false, shares: [{ traderId: ahmed }] }, ownerId),
        );
        const customs = (await db.select().from(chargeTypes).where(eq(chargeTypes.name, "كمرك بصرة")))[0].id;
        await withTx((tx) =>
            charges.addCharges(
                tx,
                { containerId: ct.id, date: D, rows: [{ chargeTypeId: customs, amount: "2000", currency: "USD", paidByPartyId: china }] },
                ownerId,
            ),
        );

        const all = await listJournal(db, {});
        expect(all.total).toBe(4);
        expect(all.rows[0].receiptNo).toBe("ق-000003"); // the reversal, newest
        expect(all.rows.find((x) => x.id === r.entryId)!.cancelledAt).not.toBeNull();
        expect((await listJournal(db, { kind: "in" })).total).toBe(3);
        expect((await listJournal(db, { q: "ص-000001" })).rows.map((x) => x.receiptNo)).toEqual(["ص-000001"]);
        expect((await listJournal(db, { q: "أحمد" })).total).toBe(2);
        expect((await listJournal(db, { from: "2026-11-10" })).total).toBe(3);
    });

    it("reads a receipt with the amount in words and the company details", async () => {
        const r = await post({ kind: "receive_trader", date: D, traderId: ahmed, vaultId: usd, amount: "2400", currency: "USD", note: "نقداً" });
        const rc = await getReceipt(db, r.entryId);
        expect(rc!.receiptNo).toBe("ق-000001");
        expect(rc!.title).toBe("وصل قبض");
        expect(rc!.words).toBe("ألفان وأربعمائة دولار أمريكي لا غير");
        expect(rc!.lines).toEqual([
            ["استلمنا من", "التاجر أحمد كاظم"],
            ["إلى قاصة", "قاصة الدولار"],
            ["ملاحظة", "نقداً"],
        ]);
        expect(rc!.company.name).toBe("سرور البصرة");
        expect(rc!.phone).toBe("07701234567");
    });

    it("gives the money forms traders and parties with balances, without our own company", async () => {
        await post({ kind: "deposit", date: D, vaultId: usd, amount: "10", currency: "USD" });
        const o = await getMoneyFormOptions(db);
        expect(o.parties.some((p) => p.id === self)).toBe(false);
        expect(o.traders[0]).toMatchObject({ id: ahmed, name: "أحمد كاظم", balance: { IQD: "0", USD: "0.00" } });
        expect(o.vaults.find((v) => v.id === usd)!.balance.USD).toBe("10.00");
        expect(o.defaultRate).toBe("1310");
        expect(o.categories.map((c) => c.name)).toContain("إيجار");
    });
});
