import "server-only";
import Decimal from "decimal.js";
import { and, asc, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { type Currency, type EntryType, accounts, containers, journalEntries, journalLines } from "@/db/schema";
import { roundTo } from "@/lib/money";
import { kindsOf } from "./balances";
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
    containerNumber: string | null;
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
    // A trader's statement is the customer's view: what they owe the owner and the branch, as one running balance.
    const accountWhere = and(inArray(accounts.kind, kindsOf(ref.kind)), ref.refId ? eq(accounts.refId, ref.refId) : isNull(accounts.refId), eq(accounts.currency, currency));

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
            containerNumber: containers.containerNumber,
            cancelledAt: journalEntries.cancelledAt,
            debit: journalLines.debit,
            credit: journalLines.credit,
        })
        .from(journalLines)
        .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
        .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
        .leftJoin(containers, eq(containers.id, journalEntries.containerId))
        .where(and(accountWhere, from ? gte(journalEntries.entryDate, from) : undefined, to ? lte(journalEntries.entryDate, to) : undefined))
        .orderBy(asc(journalEntries.entryDate), asc(journalEntries.createdAt), asc(journalLines.createdAt));

    // One payment can pay both parts (owner's and branch's): show it as one row, as the customer sees it.
    const merged: typeof lines = [];
    for (const l of lines) {
        const prev = merged.at(-1);
        if (prev && prev.entryId === l.entryId) {
            const net = new Decimal(prev.debit).minus(prev.credit).plus(l.debit).minus(l.credit);
            prev.debit = net.gt(0) ? net.toFixed(2) : "0";
            prev.credit = net.lt(0) ? net.neg().toFixed(2) : "0";
            prev.memo = prev.memo ?? l.memo;
        } else merged.push({ ...l });
    }

    let running = opening;
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    const rows: StatementRow[] = merged.map((l) => {
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
            containerNumber: l.containerNumber,
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
