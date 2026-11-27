import "server-only";
import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import type { ReceiptKind } from "@/db/schema";

export const DEFAULT_PREFIX: Record<ReceiptKind, string> = { in: "ق", out: "ص", transfer: "ت", exchange: "ع" };

export function formatReceiptNo(prefix: string, n: number) {
    return `${prefix}-${String(n).padStart(6, "0")}`;
}

/**
 * Takes the next receipt number of a kind. The UPDATE row-locks the sequence until the
 * surrounding transaction ends, so concurrent receipts get consecutive unique numbers (PRD §6.5).
 */
export async function nextReceiptNo(tx: DbOrTx, kind: ReceiptKind): Promise<string> {
    const result = await tx.execute<{ prefix: string; n: number }>(sql`
        INSERT INTO receipt_sequences (kind, prefix, next_number)
        VALUES (${kind}, ${DEFAULT_PREFIX[kind]}, 2)
        ON CONFLICT (kind) DO UPDATE SET next_number = receipt_sequences.next_number + 1
        RETURNING prefix, next_number - 1 AS n
    `);
    const row = result.rows[0];
    return formatReceiptNo(row.prefix, Number(row.n));
}
