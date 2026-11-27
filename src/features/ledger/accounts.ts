import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { type AccountKind, type Currency, accounts, expenseCategories, parties, traders, vaults } from "@/db/schema";
import type { AccountRef } from "./types";

const SYSTEM_NAMES: Partial<Record<AccountKind, string>> = {
    fee_income: "إيرادات الأتعاب",
    owner_equity: "رأس مال المالك",
    fx: "فرق تصريف العملة",
    opening: "أرصدة افتتاحية",
};

async function nameFor(tx: DbOrTx, ref: AccountRef): Promise<string> {
    if (!ref.refId) return SYSTEM_NAMES[ref.kind] ?? ref.kind;
    const table = { trader: traders, party: parties, vault: vaults, general_expense: expenseCategories }[ref.kind as string];
    if (!table) return SYSTEM_NAMES[ref.kind] ?? ref.kind;
    const [row] = await tx.select({ name: table.name }).from(table).where(eq(table.id, ref.refId));
    return row?.name ?? ref.kind;
}

function whereRef(ref: AccountRef, currency: Currency) {
    return and(eq(accounts.kind, ref.kind), ref.refId ? eq(accounts.refId, ref.refId) : isNull(accounts.refId), eq(accounts.currency, currency));
}

/** Returns the id of the account for (kind, refId, currency), creating it the first time. */
export async function resolveAccount(tx: DbOrTx, ref: AccountRef, currency: Currency): Promise<string> {
    const [found] = await tx.select({ id: accounts.id }).from(accounts).where(whereRef(ref, currency));
    if (found) return found.id;
    const name = await nameFor(tx, ref);
    const [created] = await tx
        .insert(accounts)
        .values({ kind: ref.kind, refId: ref.refId ?? null, currency, name })
        .onConflictDoNothing()
        .returning({ id: accounts.id });
    if (created) return created.id;
    const [again] = await tx.select({ id: accounts.id }).from(accounts).where(whereRef(ref, currency));
    return again.id;
}

/** Looks an account up without creating it (null when nothing was ever posted to it). */
export async function findAccount(tx: DbOrTx, ref: AccountRef, currency: Currency): Promise<string | null> {
    const [found] = await tx.select({ id: accounts.id }).from(accounts).where(whereRef(ref, currency));
    return found?.id ?? null;
}

