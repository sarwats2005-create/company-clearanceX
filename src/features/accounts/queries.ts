import { and, asc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import "server-only";
import type { DbOrTx } from "@/db";
import { type AccountKind, type Currency, type PartyKind, type VaultKind, accounts, journalEntries, journalLines, parties, traders, vaults } from "@/db/schema";
import { compact, compactPattern, folded, likePattern } from "@/db/search";
import { type Balances, getBalances, getBalancesMany, kindsOf } from "@/features/ledger/balances";
import { getSettingsRow } from "@/features/settings/service";
import { balanceSide } from "@/lib/format";
import { roundTo } from "@/lib/money";
import { type AccountSegment, debtWeight } from "./model";

export interface TraderAccountRow {
    id: string;
    name: string;
    phone: string | null;
    city: string | null;
    activeContainers: number;
    balance: Balances;
}

export interface PartyAccountRow {
    id: string;
    name: string;
    kind: PartyKind;
    phone: string | null;
    isActive: boolean;
    balance: Balances;
}

export interface VaultAccountRow {
    id: string;
    /** Set on the branch's own vault. */
    partyId: string | null;
    name: string;
    kind: VaultKind;
    allowedCurrencies: Currency[];
    notes: string | null;
    isSystem: boolean;
    isActive: boolean;
    balance: Balances;
}

/** Containers a trader has a share in that are still being worked on (not delivered, not cancelled). */
const activeContainersSql = sql<number>`(
    select count(distinct c.id)::int from container_shares s
      join containers c on c.id = s.container_id
     where s.trader_id = "traders"."id" and c.archived_at is null and c.status <> 'delivered')`;

const hasMoney = (b: Balances) => (["IQD", "USD"] as Currency[]).some((c) => balanceSide(b[c], c) !== "settled");

async function rateOf(db: DbOrTx) {
    return (await getSettingsRow(db)).defaultUsdIqdRate;
}

/** Traders with both balances, largest debt first (US-16, PRD §8.8). USD is weighed at the default rate. */
export async function listTraderAccounts(db: DbOrTx, f: { q?: string; debtsOnly?: boolean }): Promise<TraderAccountRow[]> {
    const like = likePattern(f.q);
    const phone = compactPattern(f.q);
    const rows = await db
        .select({ id: traders.id, name: traders.name, phone: traders.phone, city: traders.city, activeContainers: activeContainersSql })
        .from(traders)
        .where(
            and(
                eq(traders.isActive, true),
                like
                    ? sql`(${folded(traders.name)} LIKE ${like} OR ${folded(traders.phone)} LIKE ${like} OR ${folded(traders.city)} LIKE ${like}${phone ? sql` OR ${compact(traders.phone)} LIKE ${phone}` : sql``})`
                    : undefined,
            ),
        );
    const [balances, rate] = await Promise.all([
        getBalancesMany(
            db,
            "trader",
            rows.map((r) => r.id),
        ),
        rateOf(db),
    ]);
    const out = rows
        .map((r) => ({ ...r, activeContainers: Number(r.activeContainers), balance: balances.get(r.id)! }))
        .filter((r) => !f.debtsOnly || (["IQD", "USD"] as Currency[]).some((c) => balanceSide(r.balance[c], c) === "owesUs"));
    const w = new Map(out.map((r) => [r.id, debtWeight(r.balance, rate)]));
    return out.sort((a, b) => w.get(b.id)! - w.get(a.id)! || a.name.localeCompare(b.name, "ar"));
}

/** Parties except our own company, what we owe most first (US-18). Stopped parties show only while they hold a balance. */
export async function listPartyAccounts(db: DbOrTx): Promise<PartyAccountRow[]> {
    const rows = await db
        .select({ id: parties.id, name: parties.name, kind: parties.kind, phone: parties.phone, isActive: parties.isActive })
        .from(parties)
        .where(ne(parties.kind, "self"));
    const [balances, rate] = await Promise.all([
        getBalancesMany(
            db,
            "party",
            rows.map((r) => r.id),
        ),
        rateOf(db),
    ]);
    const out = rows.map((r) => ({ ...r, balance: balances.get(r.id)! })).filter((r) => r.isActive || hasMoney(r.balance));
    const w = new Map(out.map((r) => [r.id, debtWeight(r.balance, rate)]));
    return out.sort((a, b) => w.get(a.id)! - w.get(b.id)! || a.name.localeCompare(b.name, "ar"));
}

const VAULT_ORDER: Partial<Record<VaultKind, number>> = { main: 0, usd: 1 };

/** Every vault with its balances: main first, then the dollar vault, then the owner's own (stopped ones last). */
export async function listVaultAccounts(db: DbOrTx): Promise<VaultAccountRow[]> {
    const rows = await db
        .select({
            id: vaults.id,
            name: vaults.name,
            kind: vaults.kind,
            allowedCurrencies: vaults.allowedCurrencies,
            partyId: vaults.partyId,
            notes: vaults.notes,
            isSystem: vaults.isSystem,
            isActive: vaults.isActive,
        })
        .from(vaults)
        .orderBy(asc(vaults.createdAt));
    const balances = await getBalancesMany(
        db,
        "vault",
        rows.map((r) => r.id),
    );
    // The branch's vault comes right after the owner's two (it's the other cash box the owner watches).
    const rank = (v: (typeof rows)[number]) => (v.isActive ? (VAULT_ORDER[v.kind] ?? (v.partyId ? 2 : 3)) : 4);
    return rows.map((r) => ({ ...r, allowedCurrencies: r.allowedCurrencies as Currency[], balance: balances.get(r.id)! })).sort((a, b) => rank(a) - rank(b));
}

export async function getTraderAccount(db: DbOrTx, id: string) {
    const [trader] = await db
        .select({
            id: traders.id,
            name: traders.name,
            phone: traders.phone,
            city: traders.city,
            notes: traders.notes,
            isActive: traders.isActive,
            activeContainers: activeContainersSql,
        })
        .from(traders)
        .where(eq(traders.id, id));
    if (!trader) return null;
    const { activeContainers, ...rest } = trader;
    return { trader: rest, activeContainers: Number(activeContainers), balance: await getBalances(db, "trader", id) };
}

/** A party's page. Our own company has no page: its money is the vaults. */
export async function getPartyAccount(db: DbOrTx, id: string) {
    const [party] = await db.select().from(parties).where(eq(parties.id, id));
    if (!party || party.kind === "self") return null;
    return { party, balance: await getBalances(db, "party", id) };
}

export async function getVaultAccount(db: DbOrTx, id: string) {
    const [vault] = await db.select().from(vaults).where(eq(vaults.id, id));
    if (!vault) return null;
    return { vault: { ...vault, allowedCurrencies: vault.allowedCurrencies as Currency[] }, balance: await getBalances(db, "vault", id) };
}

/** Both balances at the end of a day (inclusive), or today when no date (WhatsApp summary of a range). */
export async function balancesAsOf(db: DbOrTx, kind: AccountKind, refId: string, to?: string): Promise<Balances> {
    const rows = await db
        .select({ currency: accounts.currency, v: sql<string>`coalesce(sum(${journalLines.debit} - ${journalLines.credit}), 0)` })
        .from(journalLines)
        .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
        .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
        .where(and(inArray(accounts.kind, kindsOf(kind)), eq(accounts.refId, refId), to ? lte(journalEntries.entryDate, to) : undefined))
        .groupBy(accounts.currency);
    const out: Balances = { IQD: roundTo("0", "IQD"), USD: roundTo("0", "USD") };
    for (const r of rows) out[r.currency] = roundTo(r.v, r.currency);
    return out;
}

export interface StatementTarget {
    segment: AccountSegment;
    id: string;
    name: string;
    /** Heading of the printed/shared statement, e.g. "كشف حساب التاجر أحمد كاظم". */
    title: string;
    phone: string | null;
    currencies: Currency[];
    balance: Balances;
}

/** Whose statement this is, for the account pages and the printed statement. Null when there is no such account. */
export async function getStatementTarget(db: DbOrTx, segment: AccountSegment, id: string): Promise<StatementTarget | null> {
    if (segment === "traders") {
        const a = await getTraderAccount(db, id);
        return (
            a && {
                segment,
                id,
                name: a.trader.name,
                title: `كشف حساب التاجر ${a.trader.name}`,
                phone: a.trader.phone,
                currencies: ["USD", "IQD"],
                balance: a.balance,
            }
        );
    }
    if (segment === "parties") {
        const a = await getPartyAccount(db, id);
        return (
            a && { segment, id, name: a.party.name, title: `كشف حساب ${a.party.name}`, phone: a.party.phone, currencies: ["USD", "IQD"], balance: a.balance }
        );
    }
    const a = await getVaultAccount(db, id);
    return a && { segment, id, name: a.vault.name, title: `كشف حركة ${a.vault.name}`, phone: null, currencies: a.vault.allowedCurrencies, balance: a.balance };
}
