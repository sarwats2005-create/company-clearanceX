import "server-only";
import type { DbOrTx } from "@/db";
import { auditLog } from "@/db/schema";

type AuditAction = (typeof auditLog.$inferInsert)["action"];

/** One row per change (PRD §12.2 audit_log; viewer in Phase 2). */
export async function audit(
    tx: DbOrTx,
    entry: { table: string; recordId?: string | null; action: AuditAction; before?: unknown; after?: unknown; userId?: string | null },
) {
    await tx.insert(auditLog).values({
        tableName: entry.table,
        recordId: entry.recordId ?? null,
        action: entry.action,
        before: (entry.before ?? null) as never,
        after: (entry.after ?? null) as never,
        userId: entry.userId ?? null,
    });
}
