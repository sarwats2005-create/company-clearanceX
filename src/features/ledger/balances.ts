import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { type AccountKind, type Currency, accounts, journalLines } from "@/db/schema";
import Decimal from "decimal.js";
import { roundTo } from "@/lib/money";
import type { AccountRef } from "./types";

export type Balances = Record<Currency, string>;

/**
 * What a trader owes is the customer's view: what they owe the owner plus what they owe the branch. Lists,
 * totals and statements read both; the trader's page also shows the two parts (getTraderSplit).
 */
export function kindsOf(kind: AccountKind): AccountKind[] {
    return kind === "trader" ? ["trader", "trader_branch"] : [kind];
}

const zero = (): Balances => ({ IQD: roundTo("0", "IQD"), USD: roundTo("0", "USD") });

/** Debit − credit of one account (positive: trader عليه / vault balance; negative: party له / income). */
export async function getBalance(db: DbOrTx, ref: AccountRef, currency: Currency): Promise<string> {
    const [row] = await db
        .select({ balance: sql<string>`coalesce(sum(${journalLines.debit} - ${journalLines.credit}), 0)` })
        .from(journalLines)
        .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
        .where(and(eq(accounts.kind, ref.kind), ref.refId ? eq(accounts.refId, ref.refId) : isNull(accounts.refId), eq(accounts.currency, currency)));
    return roundTo(row?.balance ?? "0", currency);
}

/** Both currencies of one trader / party / vault. */
export async function getBalances(db: DbOrTx, kind: AccountKind, refId: string): Promise<Balances> {
    return (await getBalancesMany(db, kind, [refId])).get(refId) ?? zero();
}

/** Balances for many refs of one kind in one query (lists). */
export async function getBalancesMany(db: DbOrTx, kind: AccountKind, refIds: string[]): Promise<Map<string, Balances>> {
    const out = new Map<string, Balances>(refIds.map((id) => [id, zero()]));
    if (!refIds.length) return out;
    const rows = await db
        .select({ refId: accounts.refId, currency: accounts.currency, balance: sql<string>`coalesce(sum(${journalLines.debit} - ${journalLines.credit}), 0)` })
        .from(accounts)
        .leftJoin(journalLines, eq(journalLines.accountId, accounts.id))
        .where(and(inArray(accounts.kind, kindsOf(kind)), inArray(accounts.refId, refIds)))
        .groupBy(accounts.refId, accounts.currency);
    for (const r of rows) {
        if (!r.refId) continue;
        const b = out.get(r.refId)!;
        b[r.currency] = roundTo(new Decimal(b[r.currency]).plus(r.balance), r.currency);
    }
    return out;
}

/** Totals per currency over every account of a kind (e.g. all traders: what they owe us). */
export async function getKindTotals(db: DbOrTx, kind: AccountKind): Promise<{ positive: Balances; negative: Balances }> {
    const rows = await db.execute<{ currency: Currency; pos: string; neg: string }>(sql`
        SELECT currency,
               coalesce(sum(CASE WHEN bal > 0 THEN bal ELSE 0 END), 0) AS pos,
               coalesce(sum(CASE WHEN bal < 0 THEN bal ELSE 0 END), 0) AS neg
          FROM (SELECT a.currency, sum(l.debit - l.credit) AS bal
                  FROM accounts a JOIN journal_lines l ON l.account_id = a.id
                 WHERE a.kind = ANY(${sql.param(kindsOf(kind))}::account_kind[])
                 GROUP BY a.ref_id, a.currency) t
         GROUP BY currency`);
    const positive = zero();
    const negative = zero();
    for (const r of rows.rows) {
        positive[r.currency] = roundTo(r.pos, r.currency);
        negative[r.currency] = roundTo(r.neg, r.currency);
    }
    return { positive, negative };
}

/** A trader's debt in its two parts: to the owner and to the branch (both currencies; the branch's is dinar). */
export async function getTraderSplit(db: DbOrTx, traderId: string): Promise<{ owner: Balances; branch: Balances }> {
    const [owner, branch] = await Promise.all([exact(db, "trader", traderId), exact(db, "trader_branch", traderId)]);
    return { owner, branch };
}

async function exact(db: DbOrTx, kind: AccountKind, refId: string): Promise<Balances> {
    const out = zero();
    for (const c of ["IQD", "USD"] as Currency[]) out[c] = await getBalance(db, { kind, refId }, c);
    return out;
}
