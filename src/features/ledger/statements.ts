import "server-only";
import Decimal from "decimal.js";
import { and, asc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { type Currency, type EntryType, accounts, journalEntries, journalLines } from "@/db/schema";
import { roundTo } from "@/lib/money";
import type { AccountRef } from "./types";

export interface StatementRow {
    lineId: string;
    entryId: string;
    date: string;
    type: EntryType;
    receiptNo: string | null;
    description: string;
    memo: string | null;
    containerId: string | null;
    cancelled: boolean;
    debit: string;
    credit: string;
    /** Running debit − credit after this row. */
    balance: string;
}

export interface Statement {
    opening: string;
    rows: StatementRow[];
    closing: string;
    totalDebit: string;
    totalCredit: string;
}

/** Account statement with opening balance, running balance and totals (PRD §8.8). */
export async function getStatement(db: DbOrTx, ref: AccountRef, currency: Currency, from?: string, to?: string): Promise<Statement> {
    const accountWhere = and(eq(accounts.kind, ref.kind), ref.refId ? eq(accounts.refId, ref.refId) : isNull(accounts.refId), eq(accounts.currency, currency));

    let opening = new Decimal(0);
    if (from) {
        const [row] = await db
            .select({ v: sql<string>`coalesce(sum(${journalLines.debit} - ${journalLines.credit}), 0)` })
            .from(journalLines)
            .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
            .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
            .where(and(accountWhere, lt(journalEntries.entryDate, from)));
        opening = new Decimal(row?.v ?? 0);
    }

    const lines = await db
        .select({
            lineId: journalLines.id,
            entryId: journalEntries.id,
            date: journalEntries.entryDate,
            type: journalEntries.type,
            receiptNo: journalEntries.receiptNo,
            description: journalEntries.description,
            memo: journalLines.memo,
            containerId: journalEntries.containerId,
            cancelledAt: journalEntries.cancelledAt,
            debit: journalLines.debit,
            credit: journalLines.credit,
        })
        .from(journalLines)
        .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
        .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
        .where(and(accountWhere, from ? gte(journalEntries.entryDate, from) : undefined, to ? lte(journalEntries.entryDate, to) : undefined))
        .orderBy(asc(journalEntries.entryDate), asc(journalEntries.createdAt), asc(journalLines.createdAt));

    let running = opening;
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    const rows: StatementRow[] = lines.map((l) => {
        running = running.plus(l.debit).minus(l.credit);
        totalDebit = totalDebit.plus(l.debit);
        totalCredit = totalCredit.plus(l.credit);
        return {
            lineId: l.lineId,
            entryId: l.entryId,
            date: l.date,
            type: l.type,
            receiptNo: l.receiptNo,
            description: l.description,
            memo: l.memo,
            containerId: l.containerId,
            cancelled: l.cancelledAt !== null || l.type === "reversal",
            debit: roundTo(l.debit, currency),
            credit: roundTo(l.credit, currency),
            balance: roundTo(running, currency),
        };
    });

    return {
        opening: roundTo(opening, currency),
        rows,
        closing: roundTo(running, currency),
        totalDebit: roundTo(totalDebit, currency),
        totalCredit: roundTo(totalCredit, currency),
    };
}
