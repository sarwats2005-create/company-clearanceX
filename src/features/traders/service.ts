import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { traders } from "@/db/schema";
import { audit } from "@/features/audit/log";
import { type TraderInput, traderSchema } from "@/features/containers/schemas";
import { DomainError } from "@/lib/errors";

/** Quick add from the trader picker (PRD §5.2): name required, phone optional. */
export async function createTrader(tx: DbOrTx, input: TraderInput, userId: string): Promise<string> {
    const data = traderSchema.parse(input);
    const [hit] = await tx
        .select({ id: traders.id })
        .from(traders)
        .where(and(sql`lower(${traders.name}) = lower(${data.name})`, eq(traders.isActive, true)));
    if (hit) throw new DomainError("هذا التاجر موجود مسبقاً", "name");
    const [row] = await tx.insert(traders).values(data).returning({ id: traders.id });
    await audit(tx, { table: "traders", recordId: row.id, action: "create", after: data, userId });
    return row.id;
}
