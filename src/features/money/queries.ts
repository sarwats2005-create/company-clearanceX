import Decimal from "decimal.js";
import { type SQL, and, asc, count, desc, eq, gte, isNotNull, lte, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import "server-only";
import type { DbOrTx } from "@/db";
import { type Currency, type EntryType, type ReceiptKind, containers, expenseCategories, journalEntries, parties, traders, vaults } from "@/db/schema";
import { folded, likePattern } from "@/db/search";
import { getBranch } from "@/features/branch/service";
import { getBalances, getBalancesMany } from "@/features/ledger/balances";
import { getSettingsRow } from "@/features/settings/service";
import { toArabicWords } from "@/lib/tafqeet";
import { type MoneyMeta, type ReceiptLine, entryFlow, receiptLines, receiptTitle } from "./describe";
import type { MoneyFormOptions } from "./form-model";

export type { MoneyFormOptions };

export const JOURNAL_PAGE_SIZE = 50;

export interface JournalFilter {
    kind?: ReceiptKind;
    type?: EntryType;
    currency?: Currency;
    q?: string;
    from?: string;
    to?: string;
    page?: number;
}

export interface JournalRow {
    id: string;
    receiptNo: string | null;
    receiptKind: ReceiptKind | null;
    type: EntryType;
    /** For a cancellation: the type of the entry it cancels. */
    reversesType: EntryType | null;
    entryDate: string;
    description: string;
    from: string;
    to: string;
    amount: string | null;
    currency: Currency | null;
    note: string | null;
    containerId: string | null;
    cancelledAt: Date | null;
    cancelReason: string | null;
}

/** Every receipt, newest first, with filters and search (PRD §8.7 سجل المعاملات). */
export async function listJournal(db: DbOrTx, f: JournalFilter): Promise<{ rows: JournalRow[]; total: number; pageSize: number }> {
    // Receipts only: every movement of cash. Debts with no cash (a charge a party paid, a fee) live on the container and statements.
    const where: SQL[] = [isNotNull(journalEntries.receiptNo)];
    if (f.kind) where.push(eq(journalEntries.receiptKind, f.kind));
    if (f.type) where.push(eq(journalEntries.type, f.type));
    if (f.currency) where.push(eq(journalEntries.currency, f.currency));
    if (f.from) where.push(gte(journalEntries.entryDate, f.from));
    if (f.to) where.push(lte(journalEntries.entryDate, f.to));
    const like = likePattern(f.q);
    if (like) {
        where.push(
            sql`(${folded(journalEntries.receiptNo)} LIKE ${like}
                 OR ${folded(journalEntries.description)} LIKE ${like}
                 OR ${folded(journalEntries.counterpartyLabel)} LIKE ${like}
                 OR ${folded(sql`${journalEntries.meta}->>'note'`)} LIKE ${like}
                 OR ${folded(sql`${journalEntries.meta}->>'containerNumber'`)} LIKE ${like})`,
        );
    }
    const cond = and(...where);
    const page = Math.max(1, Math.floor(f.page ?? 1));
    const orig = alias(journalEntries, "orig");
    const [rows, [{ n }]] = await Promise.all([
        db
            .select({ e: journalEntries, reversesType: orig.type })
            .from(journalEntries)
            .leftJoin(orig, eq(orig.id, journalEntries.reversesEntryId))
            .where(cond)
            .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
            .limit(JOURNAL_PAGE_SIZE)
            .offset((page - 1) * JOURNAL_PAGE_SIZE),
        db.select({ n: count() }).from(journalEntries).where(cond),
    ]);
    return {
        total: Number(n),
        pageSize: JOURNAL_PAGE_SIZE,
        rows: rows.map(({ e, reversesType }) => {
            const meta = e.meta as MoneyMeta;
            return {
                id: e.id,
                receiptNo: e.receiptNo,
                receiptKind: e.receiptKind,
                type: e.type,
                reversesType: reversesType ?? null,
                entryDate: e.entryDate,
                description: e.description,
                ...entryFlow(e.type, meta, reversesType ?? null),
                amount: e.amount,
                currency: e.currency,
                note: meta.note ?? null,
                containerId: e.containerId,
                cancelledAt: e.cancelledAt,
                cancelReason: e.cancelReason,
            };
        }),
    };
}

export interface ReceiptView {
    id: string;
    receiptNo: string;
    receiptKind: ReceiptKind;
    type: EntryType;
    title: string;
    date: string;
    description: string;
    amount: string;
    currency: Currency;
    words: string;
    lines: ReceiptLine[];
    company: { name: string; phone: string | null; address: string | null; footer: string | null };
    /** The trader's or party's phone, for WhatsApp. */
    phone: string | null;
    containerId: string | null;
    containerNumber: string | null;
    isCancellation: boolean;
    /** For a cancellation: the receipt it cancels. */
    reverses: { id: string; receiptNo: string | null } | null;
    cancelledAt: Date | null;
    cancelReason: string | null;
    /** For a cancelled receipt: the cancellation's own receipt. */
    cancelledBy: { id: string; receiptNo: string | null } | null;
}

/** A receipt as printed (PRD §6.5). Null for a missing entry or one without a receipt number. */
export async function getReceipt(db: DbOrTx, entryId: string): Promise<ReceiptView | null> {
    const [e] = await db.select().from(journalEntries).where(eq(journalEntries.id, entryId));
    if (!e || !e.receiptNo || !e.receiptKind || !e.amount || !e.currency) return null;
    const meta = e.meta as MoneyMeta;
    const isCancellation = e.type === "reversal";
    const [reverses, cancelledBy, settings, container] = await Promise.all([
        e.reversesEntryId
            ? db
                  .select({ id: journalEntries.id, receiptNo: journalEntries.receiptNo, type: journalEntries.type })
                  .from(journalEntries)
                  .where(eq(journalEntries.id, e.reversesEntryId))
                  .then((r) => r[0] ?? null)
            : null,
        e.cancelledAt
            ? db
                  .select({ id: journalEntries.id, receiptNo: journalEntries.receiptNo })
                  .from(journalEntries)
                  .where(eq(journalEntries.reversesEntryId, e.id))
                  .then((r) => r[0] ?? null)
            : null,
        getSettingsRow(db),
        e.containerId
            ? db
                  .select({ n: containers.containerNumber })
                  .from(containers)
                  .where(eq(containers.id, e.containerId))
                  .then((r) => r[0]?.n ?? null)
            : null,
    ]);
    const origType = isCancellation ? (reverses?.type ?? meta.reversesType ?? e.type) : e.type;
    const lines: ReceiptLine[] = isCancellation
        ? [["يلغي الوصل", reverses?.receiptNo ?? meta.reversesReceiptNo ?? "—"], ...(meta.reason ? [["سبب الإلغاء", meta.reason] as ReceiptLine] : [])]
        : [];
    lines.push(...receiptLines(origType, meta, e.fxRate));

    let phone: string | null = null;
    if (meta.traderId) phone = (await db.select({ p: traders.phone }).from(traders).where(eq(traders.id, meta.traderId)))[0]?.p ?? null;
    else if (meta.partyId) phone = (await db.select({ p: parties.phone }).from(parties).where(eq(parties.id, meta.partyId)))[0]?.p ?? null;

    return {
        id: e.id,
        receiptNo: e.receiptNo,
        receiptKind: e.receiptKind,
        type: origType,
        title: receiptTitle(e.receiptKind, isCancellation),
        date: e.entryDate,
        description: e.description,
        amount: e.amount,
        currency: e.currency,
        words: toArabicWords(e.amount, e.currency),
        lines,
        company: { name: settings.name, phone: settings.phone, address: settings.address, footer: settings.receiptFooter },
        phone,
        containerId: e.containerId,
        containerNumber: container,
        isCancellation,
        reverses: reverses ? { id: reverses.id, receiptNo: reverses.receiptNo } : null,
        cancelledAt: e.cancelledAt,
        cancelReason: e.cancelReason,
        cancelledBy,
    };
}

export async function getMoneyFormOptions(db: DbOrTx): Promise<MoneyFormOptions> {
    const [ts, ps, vs, cats, settings, [lastFx]] = await Promise.all([
        db.select({ id: traders.id, name: traders.name, phone: traders.phone }).from(traders).where(eq(traders.isActive, true)).orderBy(asc(traders.name)),
        db
            .select({ id: parties.id, name: parties.name })
            .from(parties)
            .where(and(eq(parties.isActive, true), ne(parties.kind, "self"), eq(parties.isBranch, false)))
            .orderBy(asc(parties.createdAt)),
        db
            .select({ id: vaults.id, name: vaults.name, kind: vaults.kind, allowedCurrencies: vaults.allowedCurrencies, partyId: vaults.partyId })
            .from(vaults)
            .where(eq(vaults.isActive, true))
            .orderBy(asc(vaults.createdAt)),
        db
            .select({ id: expenseCategories.id, name: expenseCategories.name })
            .from(expenseCategories)
            .where(eq(expenseCategories.isActive, true))
            .orderBy(asc(expenseCategories.sortOrder), asc(expenseCategories.name)),
        getSettingsRow(db),
        db
            .select({ rate: journalEntries.fxRate, at: journalEntries.createdAt })
            .from(journalEntries)
            .where(and(isNotNull(journalEntries.fxRate), ne(journalEntries.type, "reversal")))
            .orderBy(desc(journalEntries.createdAt))
            .limit(1),
    ]);
    const branch = await getBranch(db);
    const [tb, bb, pb, vb, branchBal] = await Promise.all([
        getBalancesMany(
            db,
            "trader",
            ts.map((x) => x.id),
        ),
        getBalancesMany(
            db,
            "trader_branch",
            ts.map((x) => x.id),
        ),
        getBalancesMany(
            db,
            "party",
            ps.map((x) => x.id),
        ),
        getBalancesMany(
            db,
            "vault",
            vs.map((x) => x.id),
        ),
        branch ? getBalances(db, "party", branch.id) : null,
    ]);
    const useLast = lastFx?.rate && (!settings.rateUpdatedAt || lastFx.at > settings.rateUpdatedAt);
    return {
        traders: ts.map((x) => ({ ...x, balance: tb.get(x.id)!, branchBalance: bb.get(x.id)! })),
        branch: branch && branchBal ? { id: branch.id, name: branch.name, vaultId: branch.vaultId, balance: branchBal } : null,
        parties: ps.map((x) => ({ ...x, balance: pb.get(x.id)! })),
        vaults: vs.map((x) => ({ ...x, balance: vb.get(x.id)! })),
        categories: cats,
        defaultVaults: {
            ...(settings.defaultVaultIqdId ? { IQD: settings.defaultVaultIqdId } : {}),
            ...(settings.defaultVaultUsdId ? { USD: settings.defaultVaultUsdId } : {}),
        },
        defaultRate: new Decimal(useLast ? lastFx.rate! : settings.defaultUsdIqdRate).toString(),
    };
}

/** Vault balances for the money landing page (main vault first, as created). */
export async function listVaultBalances(db: DbOrTx) {
    const vs = await db
        .select({ id: vaults.id, name: vaults.name, kind: vaults.kind, allowedCurrencies: vaults.allowedCurrencies })
        .from(vaults)
        .where(eq(vaults.isActive, true))
        .orderBy(asc(vaults.createdAt));
    const b = await getBalancesMany(
        db,
        "vault",
        vs.map((v) => v.id),
    );
    return vs.map((v) => ({ ...v, balance: b.get(v.id)! }));
}
