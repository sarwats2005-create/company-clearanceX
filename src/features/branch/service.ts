import "server-only";
import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { parties, vaults } from "@/db/schema";

/**
 * The owner's branch (the Umm Qasr partnership): a party marked is_branch with its own vault. Customers owe it
 * directly for the expenses it pays; it and the owner keep an account with each other (its party account:
 * negative = the owner holds money for the branch, positive = the branch owes the owner).
 */
export interface Branch {
    id: string;
    name: string;
    phone: string | null;
    vaultId: string | null;
    vaultName: string | null;
}

export async function getBranch(db: DbOrTx): Promise<Branch | null> {
    const [row] = await db
        .select({ id: parties.id, name: parties.name, phone: parties.phone, vaultId: vaults.id, vaultName: vaults.name })
        .from(parties)
        .leftJoin(vaults, and(eq(vaults.partyId, parties.id), eq(vaults.isActive, true)))
        .where(and(eq(parties.isBranch, true), eq(parties.isActive, true)))
        .limit(1);
    return row ?? null;
}
