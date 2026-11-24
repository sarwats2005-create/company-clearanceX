import { eq } from "drizzle-orm";
import "server-only";
import type { DbOrTx } from "@/db";
import { accounts, entryContainers, journalEntries, journalLines } from "@/db/schema";
import { LedgerError, postEntry } from "./post-entry";
import type { PostEntryResult } from "./types";

/**
 * Cancels an entry (A14): posts the exact reverse with its own receipt number of the same letter,
 * and marks the original cancelled with the reason. Both stay visible.
 */
export async function reverseEntry(tx: DbOrTx, entryId: string, reason: string, date: string, userId?: string | null): Promise<PostEntryResult> {
    const [orig] = await tx.select().from(journalEntries).where(eq(journalEntries.id, entryId)).for("update");
    if (!orig) throw new LedgerError("not_found");
    if (orig.cancelledAt) throw new LedgerError("already_cancelled");
    if (orig.type === "reversal") throw new LedgerError("cannot_reverse");

    const lines = await tx
        .select({
            kind: accounts.kind,
            refId: accounts.refId,
            currency: journalLines.currency,
            debit: journalLines.debit,
            credit: journalLines.credit,
            memo: journalLines.memo,
        })
        .from(journalLines)
        .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
        .where(eq(journalLines.entryId, entryId));
    const tags = await tx.select({ containerId: entryContainers.containerId }).from(entryContainers).where(eq(entryContainers.entryId, entryId));

    const result = await postEntry(tx, {
        type: "reversal",
        date,
        receiptKind: orig.receiptKind,
        description: `إلغاء: ${orig.description}`,
        counterpartyLabel: orig.counterpartyLabel,
        amount: orig.amount,
        currency: orig.currency,
        containerId: orig.containerId,
        containerTags: tags.map((t) => t.containerId),
        fxRate: orig.fxRate,
        meta: { ...orig.meta, reason, reversesReceiptNo: orig.receiptNo, reversesType: orig.type },
        userId,
        reversesEntryId: orig.id,
        lines: lines.map((l) => ({
            account: { kind: l.kind, refId: l.refId },
            currency: l.currency,
            debit: Number(l.credit) > 0 ? l.credit : undefined,
            credit: Number(l.debit) > 0 ? l.debit : undefined,
            memo: l.memo,
        })),
    });

    await tx.update(journalEntries).set({ cancelledAt: new Date(), cancelReason: reason }).where(eq(journalEntries.id, entryId));
    return result;
}
