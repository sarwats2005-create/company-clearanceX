import Decimal from "decimal.js";
import { inArray } from "drizzle-orm";
import "server-only";
import type { DbOrTx } from "@/db";
import { type Currency, vaults } from "@/db/schema";
import { roundTo } from "@/lib/money";
import { getBalance } from "./balances";

export interface VaultOutflow {
    vaultId: string;
    currency: Currency;
    amount: string;
}

export interface VaultShortfall {
    vaultId: string;
    vaultName: string;
    currency: Currency;
    balance: string;
    after: string;
}

/** Vaults that would go below zero if these amounts left them (PRD §6.4: warn, then allow). */
export async function vaultShortfalls(db: DbOrTx, outflows: VaultOutflow[]): Promise<VaultShortfall[]> {
    const totals = new Map<string, { vaultId: string; currency: Currency; amount: Decimal }>();
    for (const o of outflows) {
        const key = `${o.vaultId}:${o.currency}`;
        const cur = totals.get(key) ?? { vaultId: o.vaultId, currency: o.currency, amount: new Decimal(0) };
        cur.amount = cur.amount.plus(o.amount);
        totals.set(key, cur);
    }
    if (!totals.size) return [];
    const names = new Map(
        (
            await db
                .select({ id: vaults.id, name: vaults.name })
                .from(vaults)
                .where(inArray(vaults.id, [...new Set(outflows.map((o) => o.vaultId))]))
        ).map((v) => [v.id, v.name]),
    );
    const out: VaultShortfall[] = [];
    for (const t of totals.values()) {
        const balance = await getBalance(db, { kind: "vault", refId: t.vaultId }, t.currency);
        const after = new Decimal(balance).minus(t.amount);
        if (after.isNeg())
            out.push({ vaultId: t.vaultId, vaultName: names.get(t.vaultId) ?? "", currency: t.currency, balance, after: roundTo(after, t.currency) });
    }
    return out;
}
