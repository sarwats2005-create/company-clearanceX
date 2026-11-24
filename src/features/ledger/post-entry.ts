import "server-only";
import Decimal from "decimal.js";
import type { DbOrTx } from "@/db";
import { entryContainers, journalEntries, journalLines } from "@/db/schema";
import { DECIMALS } from "@/lib/money";
import { resolveAccount } from "./accounts";
import { nextReceiptNo } from "./receipt-numbers";
import type { LedgerLine, PostEntryInput, PostEntryResult } from "./types";

export type LedgerErrorCode = "unbalanced" | "invalid_line" | "empty" | "not_found" | "already_cancelled" | "cannot_reverse";

export class LedgerError extends Error {
    constructor(
        public readonly code: LedgerErrorCode,
        message?: string,
    ) {
        super(message ?? code);
        this.name = "LedgerError";
    }
}

function checkLine(l: LedgerLine) {
    const d = new Decimal(l.debit ?? 0);
    const c = new Decimal(l.credit ?? 0);
    const dp = DECIMALS[l.currency];
    const ok = d.gte(0) && c.gte(0) && (d.isZero() !== c.isZero()) && d.decimalPlaces() <= dp && c.decimalPlaces() <= dp;
    if (!ok) throw new LedgerError("invalid_line", `invalid line ${JSON.stringify(l)}`);
    return { d, c };
}

/** Throws unless every line has one positive side and debits = credits per currency. */
export function assertBalanced(lines: LedgerLine[]) {
    if (lines.length < 2) throw new LedgerError("empty");
    const sums = new Map<string, Decimal>();
    for (const l of lines) {
        const { d, c } = checkLine(l);
        sums.set(l.currency, (sums.get(l.currency) ?? new Decimal(0)).plus(d).minus(c));
    }
    for (const [currency, diff] of sums) if (!diff.isZero()) throw new LedgerError("unbalanced", `unbalanced in ${currency}: ${diff}`);
}

/** The single entry point for money (PRD §13.4). Call inside withTx. */
export async function postEntry(tx: DbOrTx, input: PostEntryInput): Promise<PostEntryResult> {
    assertBalanced(input.lines);
    const receiptNo = input.receiptKind ? await nextReceiptNo(tx, input.receiptKind) : null;

    const [entry] = await tx
        .insert(journalEntries)
        .values({
            type: input.type,
            receiptKind: input.receiptKind ?? null,
            receiptNo,
            entryDate: input.date,
            description: input.description,
            counterpartyLabel: input.counterpartyLabel ?? null,
            amount: input.amount ?? null,
            currency: input.currency ?? null,
            containerId: input.containerId ?? null,
            fxRate: input.fxRate ?? null,
            meta: input.meta ?? {},
            userId: input.userId ?? null,
            reversesEntryId: input.reversesEntryId ?? null,
        })
        .returning({ id: journalEntries.id });

    const rows = [];
    for (const l of input.lines) {
        rows.push({
            entryId: entry.id,
            accountId: await resolveAccount(tx, l.account, l.currency),
            currency: l.currency,
            debit: new Decimal(l.debit ?? 0).toFixed(2),
            credit: new Decimal(l.credit ?? 0).toFixed(2),
            memo: l.memo ?? null,
        });
    }
    await tx.insert(journalLines).values(rows);

    const tags = [...new Set([...(input.containerTags ?? []), ...(input.containerId ? [input.containerId] : [])])];
    if (tags.length) await tx.insert(entryContainers).values(tags.map((containerId) => ({ entryId: entry.id, containerId })));

    return { entryId: entry.id, receiptNo };
}
