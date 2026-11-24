import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, withTx } from "@/db";
import { accounts, journalEntries, journalLines } from "@/db/schema";
import { splitAmount } from "@/features/charges/split";
import { resolveAccount } from "@/features/ledger/accounts";
import { getBalance, getBalances } from "@/features/ledger/balances";
import { LedgerError, postEntry } from "@/features/ledger/post-entry";
import * as postings from "@/features/ledger/postings";
import { reverseEntry } from "@/features/ledger/reverse-entry";
import { getStatement } from "@/features/ledger/statements";
import { closeDb, resetDb, seedBasics } from "../helpers/db";

let w: Awaited<ReturnType<typeof seedBasics>>;
const D = "2026-11-22";

beforeEach(async () => {
    await resetDb();
    w = await seedBasics();
});
afterAll(closeDb);

/** Drizzle wraps Postgres errors ("Failed query: …"); the database's own message is in `cause`. */
async function dbError(fn: () => Promise<unknown>): Promise<string> {
    try {
        await fn();
    } catch (e) {
        const err = e as Error & { cause?: Error };
        return err.cause?.message ?? err.message;
    }
    return "no error";
}

function sumsByCurrency(lines: postings.LedgerLine[]) {
    const out: Record<string, { d: number; c: number }> = {};
    for (const l of lines) {
        out[l.currency] ??= { d: 0, c: 0 };
        out[l.currency].d += Math.round(Number(l.debit ?? 0) * 100);
        out[l.currency].c += Math.round(Number(l.credit ?? 0) * 100);
    }
    return out;
}

describe("postings (pure builders)", () => {
    it("every builder returns lines balanced per currency", () => {
        const all = [
            postings.containerCharge({ currency: "USD", amount: "2000", allocations: [{ traderId: "t1", amount: "842.11" }, { traderId: "t2", amount: "1157.89" }], payer: { kind: "party", partyId: "p" } }),
            postings.containerCharge({ currency: "USD", amount: "300", allocations: [{ traderId: "t1", amount: "300" }], payer: { kind: "fee" } }),
            postings.containerCharge({ currency: "IQD", amount: "50000", allocations: [{ traderId: "t1", amount: "50000" }], payer: { kind: "vault", vaultId: "v" } }),
            postings.receiveFromTrader({ traderId: "t", vaultId: "v", currency: "USD", amount: "10" }),
            postings.receiveFromTraderFx({ traderId: "t", vaultId: "v", paidCurrency: "IQD", paidAmount: "3144000", debtCurrency: "USD", debtAmount: "2400" }),
            postings.payParty({ partyId: "p", vaultId: "v", currency: "USD", amount: "10" }),
            postings.payPartyFx({ partyId: "p", vaultId: "v", paidCurrency: "IQD", paidAmount: "1310000", debtCurrency: "USD", debtAmount: "1000" }),
            postings.payTrader({ traderId: "t", vaultId: "v", currency: "IQD", amount: "5000" }),
            postings.receiveFromParty({ partyId: "p", vaultId: "v", currency: "USD", amount: "10" }),
            postings.deposit({ vaultId: "v", currency: "IQD", amount: "1000000" }),
            postings.withdraw({ vaultId: "v", currency: "IQD", amount: "1000" }),
            postings.transfer({ fromVaultId: "a", toVaultId: "b", currency: "USD", amount: "50" }),
            postings.exchange({ fromVaultId: "a", fromCurrency: "USD", fromAmount: "100", toVaultId: "b", toCurrency: "IQD", toAmount: "131000" }),
            postings.generalExpense({ categoryId: "c", vaultId: "v", currency: "IQD", amount: "250000" }),
            postings.opening({ account: { kind: "trader", refId: "t" }, currency: "USD", amount: "500", side: "debit" }),
            postings.opening({ account: { kind: "vault", refId: "v" }, currency: "IQD", amount: "500", side: "credit" }),
            postings.traderPartyOffset({ traderId: "t", partyId: "p", currency: "USD", amount: "70" }),
        ];
        for (const lines of all) {
            for (const [cur, s] of Object.entries(sumsByCurrency(lines))) expect(s.d, cur).toBe(s.c);
        }
    });

    it("skips zero allocations on a shared charge", () => {
        const lines = postings.containerCharge({
            currency: "USD",
            amount: "900",
            allocations: [{ traderId: "t1", amount: "900.00" }, { traderId: "t2", amount: "0.00" }],
            payer: { kind: "party", partyId: "p" },
        });
        expect(lines).toHaveLength(2);
    });
});

describe("PRD §5.5 worked example", () => {
    it("ends with trader 0, parties 0, fee income 300 and 300 $ in the USD vault", async () => {
        const charge = (amount: string, payer: postings.ChargePayer) =>
            withTx((tx) =>
                postEntry(tx, {
                    type: "container_charge",
                    date: D,
                    description: "مصروف حاوية",
                    lines: postings.containerCharge({ currency: "USD", amount, allocations: [{ traderId: w.ahmed.id, amount }], payer }),
                }),
            );
        const c1 = await charge("2000", { kind: "party", partyId: w.china.id });
        await charge("100", { kind: "party", partyId: w.ummQasr.id });
        await charge("300", { kind: "fee" });
        expect(c1.receiptNo).toBeNull();
        expect((await getBalances(db, "trader", w.ahmed.id)).USD).toBe("2400.00");

        const r1 = await withTx((tx) =>
            postEntry(tx, {
                type: "receive_from_trader",
                date: D,
                receiptKind: "in",
                description: "قبض",
                lines: postings.receiveFromTrader({ traderId: w.ahmed.id, vaultId: w.usd.id, currency: "USD", amount: "2400" }),
            }),
        );
        const p1 = await withTx((tx) =>
            postEntry(tx, { type: "pay_party", date: D, receiptKind: "out", description: "دفع", lines: postings.payParty({ partyId: w.china.id, vaultId: w.usd.id, currency: "USD", amount: "2000" }) }),
        );
        const p2 = await withTx((tx) =>
            postEntry(tx, { type: "pay_party", date: D, receiptKind: "out", description: "دفع", lines: postings.payParty({ partyId: w.ummQasr.id, vaultId: w.usd.id, currency: "USD", amount: "100" }) }),
        );
        expect([r1.receiptNo, p1.receiptNo, p2.receiptNo]).toEqual(["ق-000001", "ص-000001", "ص-000002"]);

        expect((await getBalances(db, "trader", w.ahmed.id)).USD).toBe("0.00");
        expect((await getBalances(db, "party", w.china.id)).USD).toBe("0.00");
        expect((await getBalances(db, "party", w.ummQasr.id)).USD).toBe("0.00");
        expect(await getBalance(db, { kind: "fee_income" }, "USD")).toBe("-300.00");
        expect((await getBalances(db, "vault", w.usd.id)).USD).toBe("300.00");
    });
});

describe("PRD §5.6 shared container", () => {
    it("posts one balanced entry per charge with per-trader lines", async () => {
        const shares = [
            { traderId: w.ahmed.id, weight: "4" },
            { traderId: w.haider.id, weight: "5.5" },
        ];
        const post = (currency: "USD" | "IQD", amount: string, payer: postings.ChargePayer, mode: "by_share" | "manual" = "by_share", manual?: Record<string, string>) =>
            withTx((tx) =>
                postEntry(tx, {
                    type: "container_charge",
                    date: D,
                    description: "مصروف حاوية مشتركة",
                    lines: postings.containerCharge({ currency, amount, allocations: splitAmount(amount, currency, shares, mode, { manual }), payer }),
                }),
            );
        await post("USD", "2000", { kind: "party", partyId: w.china.id });
        await post("IQD", "130000", { kind: "party", partyId: w.ummQasr.id });
        await post("USD", "300", { kind: "fee" });
        await post("USD", "900", { kind: "party", partyId: w.china.id }, "manual", { [w.ahmed.id]: "900", [w.haider.id]: "0" });

        expect(await getBalances(db, "trader", w.ahmed.id)).toEqual({ USD: "1868.43", IQD: "54737" });
        expect(await getBalances(db, "trader", w.haider.id)).toEqual({ USD: "1331.57", IQD: "75263" });
        expect((await getBalances(db, "party", w.china.id)).USD).toBe("-2900.00");
        expect((await getBalances(db, "party", w.ummQasr.id)).IQD).toBe("-130000");
    });
});

describe("cross-currency receive (A4x)", () => {
    it("3,144,000 IQD at 1310 clears a 2,400 $ debt", async () => {
        await withTx((tx) =>
            postEntry(tx, {
                type: "container_charge",
                date: D,
                description: "أتعاب",
                lines: postings.containerCharge({ currency: "USD", amount: "2400", allocations: [{ traderId: w.ahmed.id, amount: "2400" }], payer: { kind: "fee" } }),
            }),
        );
        const r = await withTx((tx) =>
            postEntry(tx, {
                type: "receive_from_trader",
                date: D,
                receiptKind: "in",
                description: "قبض بالدينار",
                fxRate: "1310",
                amount: "3144000",
                currency: "IQD",
                lines: postings.receiveFromTraderFx({ traderId: w.ahmed.id, vaultId: w.main.id, paidCurrency: "IQD", paidAmount: "3144000", debtCurrency: "USD", debtAmount: "2400" }),
            }),
        );
        expect(await getBalances(db, "trader", w.ahmed.id)).toEqual({ USD: "0.00", IQD: "0" });
        expect((await getBalances(db, "vault", w.main.id)).IQD).toBe("3144000");
        const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.id, r.entryId));
        expect(entry.fxRate).toBe("1310.0000");
    });
});

describe("reversal (A14)", () => {
    it("restores balances, marks the original cancelled and gets its own number with the same letter", async () => {
        const r = await withTx((tx) =>
            postEntry(tx, {
                type: "receive_from_trader",
                date: D,
                receiptKind: "in",
                description: "قبض",
                lines: postings.receiveFromTrader({ traderId: w.ahmed.id, vaultId: w.usd.id, currency: "USD", amount: "500" }),
            }),
        );
        expect((await getBalances(db, "vault", w.usd.id)).USD).toBe("500.00");
        const rev = await withTx((tx) => reverseEntry(tx, r.entryId, "خطأ في المبلغ", D));
        expect(rev.receiptNo).toBe("ق-000002");
        expect((await getBalances(db, "vault", w.usd.id)).USD).toBe("0.00");
        expect((await getBalances(db, "trader", w.ahmed.id)).USD).toBe("0.00");
        const [orig] = await db.select().from(journalEntries).where(eq(journalEntries.id, r.entryId));
        expect(orig.cancelledAt).not.toBeNull();
        expect(orig.cancelReason).toBe("خطأ في المبلغ");
        const [revEntry] = await db.select().from(journalEntries).where(eq(journalEntries.id, rev.entryId));
        expect(revEntry.type).toBe("reversal");
        expect(revEntry.reversesEntryId).toBe(r.entryId);
    });

    it("refuses to cancel twice", async () => {
        const r = await withTx((tx) =>
            postEntry(tx, { type: "deposit", date: D, receiptKind: "in", description: "إيداع", lines: postings.deposit({ vaultId: w.main.id, currency: "IQD", amount: "1000" }) }),
        );
        await withTx((tx) => reverseEntry(tx, r.entryId, "x", D));
        await expect(withTx((tx) => reverseEntry(tx, r.entryId, "x", D))).rejects.toMatchObject({ code: "already_cancelled" });
    });
});

describe("receipt numbers", () => {
    it("gives 20 concurrent receipts the numbers 1..20 with no duplicates", async () => {
        const results = await Promise.all(
            Array.from({ length: 20 }, () =>
                withTx((tx) =>
                    postEntry(tx, { type: "deposit", date: D, receiptKind: "in", description: "إيداع", lines: postings.deposit({ vaultId: w.main.id, currency: "IQD", amount: "1000" }) }),
                ),
            ),
        );
        const numbers = results.map((r) => r.receiptNo).sort();
        expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => `ق-${String(i + 1).padStart(6, "0")}`));
    });
});

describe("validation and database guards", () => {
    it("postEntry refuses an unbalanced entry with a friendly error", async () => {
        await expect(
            withTx((tx) =>
                postEntry(tx, {
                    type: "deposit",
                    date: D,
                    description: "x",
                    lines: [
                        { account: { kind: "vault", refId: w.main.id }, currency: "IQD", debit: "100" },
                        { account: { kind: "owner_equity" }, currency: "IQD", credit: "90" },
                    ],
                }),
            ),
        ).rejects.toBeInstanceOf(LedgerError);
    });

    it("postEntry refuses USD cents on IQD and lines with two sides", async () => {
        await expect(
            withTx((tx) =>
                postEntry(tx, {
                    type: "deposit",
                    date: D,
                    description: "x",
                    lines: [
                        { account: { kind: "vault", refId: w.main.id }, currency: "IQD", debit: "100.5" },
                        { account: { kind: "owner_equity" }, currency: "IQD", credit: "100.5" },
                    ],
                }),
            ),
        ).rejects.toMatchObject({ code: "invalid_line" });
    });

    it("the database rejects an unbalanced entry at commit", async () => {
        const vaultAcc = await withTx((tx) => resolveAccount(tx, { kind: "vault", refId: w.main.id }, "IQD"));
        expect(
            await dbError(() =>
                withTx(async (tx) => {
                    const [e] = await tx.insert(journalEntries).values({ type: "deposit", entryDate: D, description: "raw" }).returning();
                    await tx.insert(journalLines).values({ entryId: e.id, accountId: vaultAcc, currency: "IQD", debit: "100" });
                }),
            ),
        ).toMatch(/unbalanced/);
    });

    it("the database blocks UPDATE and DELETE on lines", async () => {
        await withTx((tx) =>
            postEntry(tx, { type: "deposit", date: D, description: "x", lines: postings.deposit({ vaultId: w.main.id, currency: "IQD", amount: "1000" }) }),
        );
        expect(await dbError(() => db.execute(sql`UPDATE journal_lines SET debit = debit + 1`))).toMatch(/immutable/);
        expect(await dbError(() => db.execute(sql`DELETE FROM journal_lines`))).toMatch(/immutable/);
        expect(await dbError(() => db.execute(sql`DELETE FROM journal_entries`))).toMatch(/immutable/);
        expect(await dbError(() => db.execute(sql`UPDATE journal_entries SET description = 'changed'`))).toMatch(/cancelled, not edited/);
    });

    it("the database rejects a line whose currency differs from its account", async () => {
        const usdAcc = await withTx((tx) => resolveAccount(tx, { kind: "vault", refId: w.usd.id }, "USD"));
        expect(
            await dbError(() =>
                withTx(async (tx) => {
                    const [e] = await tx.insert(journalEntries).values({ type: "deposit", entryDate: D, description: "raw" }).returning();
                    await tx.insert(journalLines).values({ entryId: e.id, accountId: usdAcc, currency: "IQD", debit: "100" });
                }),
            ),
        ).toMatch(/does not match account currency/);
    });

    it("the database refuses a vault account in a currency the vault does not accept", async () => {
        expect(await dbError(() => withTx((tx) => resolveAccount(tx, { kind: "vault", refId: w.main.id }, "USD")))).toMatch(/does not accept/);
    });

    it("creates each account once, even for accounts without a reference", async () => {
        await withTx((tx) => resolveAccount(tx, { kind: "fee_income" }, "USD"));
        await withTx((tx) => resolveAccount(tx, { kind: "fee_income" }, "USD"));
        const rows = await db.select().from(accounts).where(eq(accounts.kind, "fee_income"));
        expect(rows).toHaveLength(1);
        expect(rows[0].name).toBe("إيرادات الأتعاب");
    });
});

describe("statements", () => {
    it("lists lines with a running balance and opening/closing", async () => {
        const fee = (amount: string, date: string) =>
            withTx((tx) =>
                postEntry(tx, {
                    type: "container_charge",
                    date,
                    description: `أتعاب ${amount}`,
                    lines: postings.containerCharge({ currency: "USD", amount, allocations: [{ traderId: w.ahmed.id, amount }], payer: { kind: "fee" } }),
                }),
            );
        await fee("100", "2026-10-01");
        await fee("300", "2026-11-01");
        await withTx((tx) =>
            postEntry(tx, {
                type: "receive_from_trader",
                date: "2026-11-10",
                receiptKind: "in",
                description: "قبض",
                lines: postings.receiveFromTrader({ traderId: w.ahmed.id, vaultId: w.usd.id, currency: "USD", amount: "250" }),
            }),
        );
        const st = await getStatement(db, { kind: "trader", refId: w.ahmed.id }, "USD", "2026-11-01", "2026-11-30");
        expect(st.opening).toBe("100.00");
        expect(st.rows.map((r) => [r.debit, r.credit, r.balance])).toEqual([
            ["300.00", "0.00", "400.00"],
            ["0.00", "250.00", "150.00"],
        ]);
        expect(st.rows[1].receiptNo).toBe("ق-000001");
        expect(st.closing).toBe("150.00");
        expect(st.totalDebit).toBe("300.00");
        expect(st.totalCredit).toBe("250.00");
    });
});
