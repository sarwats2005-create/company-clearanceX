import { and, eq, ne, sql } from "drizzle-orm";
import "server-only";
import type { DbOrTx } from "@/db";
import { type Currency, accounts, companySettings, journalLines, traders, vaults } from "@/db/schema";
import { audit } from "@/features/audit/log";
import { getBalances } from "@/features/ledger/balances";
import { DomainError } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { type TraderUpdateInput, type VaultInput, traderUpdateSchema, vaultSchema } from "./schemas";

export type { TraderUpdateInput, VaultInput };

/** Trader info tab: name, phone, city, notes. The name stays unique among active traders. */
export async function updateTrader(tx: DbOrTx, input: TraderUpdateInput, userId: string): Promise<void> {
    const data = traderUpdateSchema.parse(input);
    const [before] = await tx.select().from(traders).where(eq(traders.id, data.id));
    if (!before) throw new DomainError("لم نجد هذا التاجر");
    const [hit] = await tx
        .select({ id: traders.id })
        .from(traders)
        .where(and(sql`lower(${traders.name}) = lower(${data.name})`, eq(traders.isActive, true), ne(traders.id, data.id)));
    if (hit) throw new DomainError("يوجد تاجر آخر بهذا الاسم", "name");
    const after = { name: data.name, phone: data.phone, city: data.city, notes: data.notes };
    await tx.update(traders).set(after).where(eq(traders.id, data.id));
    await audit(tx, { table: "traders", recordId: data.id, action: "update", before, after, userId });
}

/** Currencies a vault has already moved money in (they can't be taken away). */
async function usedCurrencies(tx: DbOrTx, vaultId: string): Promise<Currency[]> {
    const rows = await tx
        .selectDistinct({ currency: accounts.currency })
        .from(accounts)
        .innerJoin(journalLines, eq(journalLines.accountId, accounts.id))
        .where(and(eq(accounts.kind, "vault"), eq(accounts.refId, vaultId)));
    return rows.map((r) => r.currency);
}

const CURRENCY_WORD: Record<Currency, string> = { IQD: "الدينار", USD: "الدولار" };

/** Vault form (PRD §8.8): name, kind, allowed currencies, notes. System vaults keep their kind. */
export async function saveVault(tx: DbOrTx, input: VaultInput, userId: string): Promise<string> {
    const data = vaultSchema.parse(input);
    const [clash] = await tx
        .select({ id: vaults.id })
        .from(vaults)
        .where(and(sql`lower(${vaults.name}) = lower(${data.name})`, data.id ? ne(vaults.id, data.id) : undefined));
    if (clash) throw new DomainError("توجد قاصة بهذا الاسم", "name");

    if (!data.id) {
        if (data.kind === "main" || data.kind === "usd") throw new DomainError("اختر نوع القاصة", "kind");
        const [row] = await tx
            .insert(vaults)
            .values({ name: data.name, kind: data.kind, allowedCurrencies: data.allowedCurrencies, notes: data.notes })
            .returning({ id: vaults.id });
        await audit(tx, { table: "vaults", recordId: row.id, action: "create", after: data, userId });
        return row.id;
    }

    const [before] = await tx.select().from(vaults).where(eq(vaults.id, data.id));
    if (!before) throw new DomainError("لم نجد هذه القاصة");
    const kind = before.isSystem || before.kind === "main" || before.kind === "usd" ? before.kind : data.kind;
    if (kind !== before.kind && (kind === "main" || kind === "usd")) throw new DomainError("اختر نوع القاصة", "kind");

    const removed = (before.allowedCurrencies as Currency[]).filter((c) => !data.allowedCurrencies.includes(c));
    if (removed.length) {
        const used = await usedCurrencies(tx, data.id);
        const blocked = removed.find((c) => used.includes(c));
        if (blocked) throw new DomainError(`لا يمكن إزالة ${CURRENCY_WORD[blocked]} لأن القاصة استعملته في معاملات سابقة`, "allowedCurrencies");
        const [s] = await tx.select().from(companySettings).where(eq(companySettings.id, 1));
        const isDefault = (c: Currency) => (c === "IQD" ? s?.defaultVaultIqdId : s?.defaultVaultUsdId) === data.id;
        const dflt = removed.find(isDefault);
        if (dflt) throw new DomainError(`هذه القاصة هي الافتراضية لـ${CURRENCY_WORD[dflt]}، فلا يمكن إزالته منها`, "allowedCurrencies");
    }

    const after = { name: data.name, kind, allowedCurrencies: data.allowedCurrencies, notes: data.notes };
    await tx.update(vaults).set(after).where(eq(vaults.id, data.id));
    await audit(tx, { table: "vaults", recordId: data.id, action: "update", before, after, userId });
    return data.id;
}

/** Records in use are never deleted, only stopped (PRD §8.10). A vault must be empty first. */
export async function setVaultActive(tx: DbOrTx, id: string, isActive: boolean, userId: string): Promise<void> {
    const [v] = await tx.select().from(vaults).where(eq(vaults.id, id));
    if (!v) throw new DomainError("لم نجد هذه القاصة");
    if (!isActive) {
        if (v.isSystem || v.kind === "main" || v.kind === "usd") throw new DomainError("لا يمكن إيقاف هذه القاصة لأنها من قاصات البرنامج الأساسية");
        const [s] = await tx.select().from(companySettings).where(eq(companySettings.id, 1));
        if (s && (s.defaultVaultIqdId === id || s.defaultVaultUsdId === id)) throw new DomainError("هذه القاصة افتراضية في الإعدادات، فلا يمكن إيقافها");
        const b = await getBalances(tx, "vault", id);
        const left = (["IQD", "USD"] as Currency[]).filter((c) => Number(b[c]) !== 0);
        if (left.length) throw new DomainError(`حوّل رصيد القاصة أولاً ثم أوقفها (فيها ${left.map((c) => formatMoney(b[c], c)).join(" و ")})`);
    }
    await tx.update(vaults).set({ isActive }).where(eq(vaults.id, id));
    await audit(tx, { table: "vaults", recordId: id, action: "update", before: { isActive: v.isActive }, after: { isActive }, userId });
}
