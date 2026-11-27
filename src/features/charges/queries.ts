import Decimal from "decimal.js";
import { asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import "server-only";
import type { DbOrTx } from "@/db";
import {
    type Currency,
    type SplitUnit,
    chargeTypeDefaults,
    chargeTypes,
    companySettings,
    containerChargeAllocations,
    containerCharges,
    containerShares,
    containers,
    journalEntries,
    parties,
    traders,
    vaults,
} from "@/db/schema";
import { getBalancesMany } from "@/features/ledger/balances";
import { roundTo } from "@/lib/money";
import { type PerCurrency, summarizeCharges } from "./allocate";

export interface ChargeSheetData {
    container: {
        id: string;
        containerNumber: string;
        isShared: boolean;
        splitUnit: SplitUnit | null;
        shares: { traderId: string; name: string; shareValue: string | null }[];
    };
    chargeTypes: {
        id: string;
        name: string;
        defaultCurrency: Currency;
        defaultPartyId: string | null;
        isFee: boolean;
        /** Already on the expenses page when it opens. */
        isDefaultLine: boolean;
        defaultAmount: string | null;
    }[];
    /** Active parties, our own company first. */
    parties: { id: string; name: string; isSelf: boolean }[];
    vaults: { id: string; name: string; allowedCurrencies: Currency[] }[];
    defaultVaults: Partial<Record<Currency, string>>;
}

/** Everything the charges sheet needs for one container (PRD §5.4). Null when the container is missing or cancelled. */
export async function getChargeSheetData(db: DbOrTx, containerId: string): Promise<ChargeSheetData | null> {
    const [c] = await db.select().from(containers).where(eq(containers.id, containerId));
    if (!c || c.archivedAt) return null;
    const [shares, types, defaults, ps, vs, [settings]] = await Promise.all([
        db
            .select({ traderId: containerShares.traderId, name: traders.name, shareValue: containerShares.shareValue })
            .from(containerShares)
            .innerJoin(traders, eq(traders.id, containerShares.traderId))
            .where(eq(containerShares.containerId, containerId))
            .orderBy(asc(containerShares.sortOrder)),
        db.select().from(chargeTypes).where(eq(chargeTypes.isActive, true)).orderBy(asc(chargeTypes.sortOrder), asc(chargeTypes.name)),
        db
            .select()
            .from(chargeTypeDefaults)
            .where(
                c.containerSizeId
                    ? or(isNull(chargeTypeDefaults.containerSizeId), eq(chargeTypeDefaults.containerSizeId, c.containerSizeId))
                    : isNull(chargeTypeDefaults.containerSizeId),
            ),
        db.select().from(parties).where(eq(parties.isActive, true)).orderBy(asc(parties.name)),
        db.select().from(vaults).where(eq(vaults.isActive, true)).orderBy(desc(vaults.isSystem), asc(vaults.name)),
        db.select().from(companySettings),
    ]);
    const defaultFor = (typeId: string) =>
        defaults.find((d) => d.chargeTypeId === typeId && d.containerSizeId) ?? defaults.find((d) => d.chargeTypeId === typeId && !d.containerSizeId);
    return {
        container: {
            id: c.id,
            containerNumber: c.containerNumber,
            isShared: c.isShared,
            splitUnit: c.isShared ? c.splitUnit : null,
            shares: shares.map((s) => ({ traderId: s.traderId, name: s.name, shareValue: s.shareValue })),
        },
        chargeTypes: types.map((ct) => {
            const d = defaultFor(ct.id);
            return {
                id: ct.id,
                name: ct.name,
                defaultCurrency: ct.defaultCurrency,
                defaultPartyId: ct.defaultPartyId,
                isFee: ct.isFee,
                isDefaultLine: ct.isDefaultLine,
                defaultAmount: d ? roundTo(d.amount, ct.defaultCurrency) : null,
            };
        }),
        parties: [...ps.filter((p) => p.kind === "self"), ...ps.filter((p) => p.kind !== "self")].map((p) => ({
            id: p.id,
            name: p.name,
            isSelf: p.kind === "self",
        })),
        vaults: vs.map((v) => ({ id: v.id, name: v.name, allowedCurrencies: v.allowedCurrencies })),
        defaultVaults: {
            ...(settings?.defaultVaultIqdId ? { IQD: settings.defaultVaultIqdId } : {}),
            ...(settings?.defaultVaultUsdId ? { USD: settings.defaultVaultUsdId } : {}),
        },
    };
}

export interface ContainerChargeRow {
    id: string;
    chargeTypeId: string;
    chargeTypeName: string;
    amount: string;
    currency: Currency;
    isFee: boolean;
    splitMode: "by_share" | "single_trader" | "manual";
    paidByPartyId: string | null;
    paidFromVaultId: string | null;
    /** "شركة التخليص - الصين", "شركتنا · قاصة الدولار" or "ربح الشركة". */
    payerLabel: string;
    entryDate: string;
    receiptNo: string | null;
    note: string | null;
    cancelledAt: Date | null;
    cancelReason: string | null;
    createdAt: Date;
    allocations: { traderId: string; traderName: string; amount: string }[];
}

/** Charges of one container, oldest first, cancelled ones included (they stay visible). */
export async function getContainerCharges(db: DbOrTx, containerId: string): Promise<ContainerChargeRow[]> {
    const rows = await db
        .select({
            c: containerCharges,
            typeName: chargeTypes.name,
            entryDate: journalEntries.entryDate,
            receiptNo: journalEntries.receiptNo,
            counterpartyLabel: journalEntries.counterpartyLabel,
        })
        .from(containerCharges)
        .innerJoin(chargeTypes, eq(chargeTypes.id, containerCharges.chargeTypeId))
        .innerJoin(journalEntries, eq(journalEntries.id, containerCharges.journalEntryId))
        .where(eq(containerCharges.containerId, containerId))
        .orderBy(asc(journalEntries.entryDate), asc(containerCharges.createdAt));
    if (!rows.length) return [];
    const allocs = await db
        .select({
            chargeId: containerChargeAllocations.chargeId,
            traderId: containerChargeAllocations.traderId,
            traderName: traders.name,
            amount: containerChargeAllocations.amount,
        })
        .from(containerChargeAllocations)
        .innerJoin(traders, eq(traders.id, containerChargeAllocations.traderId))
        .where(
            inArray(
                containerChargeAllocations.chargeId,
                rows.map((r) => r.c.id),
            ),
        );
    const shareOrder = new Map(
        (
            await db
                .select({ traderId: containerShares.traderId, sortOrder: containerShares.sortOrder })
                .from(containerShares)
                .where(eq(containerShares.containerId, containerId))
        ).map((s) => [s.traderId, s.sortOrder]),
    );
    const order = (id: string) => shareOrder.get(id) ?? Number.MAX_SAFE_INTEGER;
    return rows.map(({ c, typeName, entryDate, receiptNo, counterpartyLabel }) => ({
        id: c.id,
        chargeTypeId: c.chargeTypeId,
        chargeTypeName: typeName,
        amount: roundTo(c.amount, c.currency),
        currency: c.currency,
        isFee: c.isFee,
        splitMode: c.splitMode,
        paidByPartyId: c.paidByPartyId,
        paidFromVaultId: c.paidFromVaultId,
        payerLabel: counterpartyLabel ?? "",
        entryDate,
        receiptNo,
        note: c.note,
        cancelledAt: c.cancelledAt,
        cancelReason: c.cancelReason,
        createdAt: c.createdAt,
        allocations: allocs
            .filter((a) => a.chargeId === c.id)
            .sort((a, b) => order(a.traderId) - order(b.traderId))
            .map((a) => ({ traderId: a.traderId, traderName: a.traderName, amount: roundTo(a.amount, c.currency) })),
    }));
}

export interface ContainerMoney {
    costs: PerCurrency;
    fees: PerCurrency;
    total: PerCurrency;
    owedToParties: { partyId: string; name: string; amounts: PerCurrency }[];
    /** One row per trader on the container: their part of this container's charges and their overall balance. */
    traders: { traderId: string; name: string; part: PerCurrency; balance: PerCurrency }[];
}

/** Container money summary (PRD §5.4a), from active charges only. */
export async function getContainerMoney(db: DbOrTx, containerId: string, charges?: ContainerChargeRow[]): Promise<ContainerMoney> {
    const list = (charges ?? (await getContainerCharges(db, containerId))).filter((c) => !c.cancelledAt);
    const sum = summarizeCharges(list);
    const owed = new Map<string, { partyId: string; name: string; IQD: Decimal; USD: Decimal }>();
    for (const c of list) {
        if (c.isFee || c.paidFromVaultId || !c.paidByPartyId) continue;
        const cur = owed.get(c.paidByPartyId) ?? { partyId: c.paidByPartyId, name: c.payerLabel, IQD: new Decimal(0), USD: new Decimal(0) };
        cur[c.currency] = cur[c.currency].plus(c.amount);
        owed.set(c.paidByPartyId, cur);
    }
    const shares = await db
        .select({ traderId: containerShares.traderId, name: traders.name })
        .from(containerShares)
        .innerJoin(traders, eq(traders.id, containerShares.traderId))
        .where(eq(containerShares.containerId, containerId))
        .orderBy(asc(containerShares.sortOrder));
    // Traders removed from the container but still carrying charges (before a re-split) are listed too.
    const extra = new Map<string, string>();
    for (const c of list) for (const a of c.allocations) if (!shares.some((s) => s.traderId === a.traderId)) extra.set(a.traderId, a.traderName);
    const people = [...shares, ...[...extra].map(([traderId, name]) => ({ traderId, name }))];
    const balances = await getBalancesMany(
        db,
        "trader",
        people.map((p) => p.traderId),
    );
    const zero: PerCurrency = { IQD: roundTo("0", "IQD"), USD: roundTo("0", "USD") };
    return {
        costs: sum.costs,
        fees: sum.fees,
        total: sum.total,
        // In the order the charges were entered.
        owedToParties: [...owed.values()].map((o) => ({
            partyId: o.partyId,
            name: o.name,
            amounts: { IQD: roundTo(o.IQD, "IQD"), USD: roundTo(o.USD, "USD") },
        })),
        traders: people.map((p) => ({
            traderId: p.traderId,
            name: p.name,
            part: sum.perTrader[p.traderId] ?? zero,
            balance: balances.get(p.traderId) ?? zero,
        })),
    };
}
