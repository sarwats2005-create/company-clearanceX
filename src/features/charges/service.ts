import Decimal from "decimal.js";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import "server-only";
import type { DbOrTx } from "@/db";
import {
    type Currency,
    type SplitUnit,
    chargeTypes,
    containerChargeAllocations,
    containerCharges,
    containerShares,
    containers,
    parties,
    traders,
    vaults,
} from "@/db/schema";
import { audit } from "@/features/audit/log";
import { postEntry } from "@/features/ledger/post-entry";
import * as postings from "@/features/ledger/postings";
import { reverseEntry } from "@/features/ledger/reverse-entry";
import { vaultShortfalls } from "@/features/ledger/vault-check";
import { DomainError } from "@/lib/errors";
import { formatMoney, formatNumber, todayISO } from "@/lib/format";
import { roundTo } from "@/lib/money";
import { t } from "@/lib/i18n";
import { type ChargeSplit, allocateCharge, chargeMemo } from "./allocate";
import { type AddChargesInput, type ChargeRow, addChargesSchema } from "./schemas";
import { type Allocation, SplitError } from "./split";

export type { AddChargesInput };

const RESPLIT_REASON = "إعادة توزيع المصاريف بعد تعديل الحصص";

interface ContainerCtx {
    id: string;
    containerNumber: string;
    isShared: boolean;
    splitUnit: SplitUnit | null;
    shares: { traderId: string; shareValue: string | null }[];
}

async function loadContainer(tx: DbOrTx, containerId: string, lock: boolean): Promise<ContainerCtx> {
    const q = tx.select().from(containers).where(eq(containers.id, containerId));
    const [c] = lock ? await q.for("update") : await q;
    if (!c) throw new DomainError("لم يُعثر على الحاوية");
    if (c.archivedAt) throw new DomainError("هذه الحاوية ملغاة، لا يمكن تسجيل مصاريف عليها");
    const shares = await tx
        .select({ traderId: containerShares.traderId, shareValue: containerShares.shareValue })
        .from(containerShares)
        .where(eq(containerShares.containerId, containerId))
        .orderBy(asc(containerShares.sortOrder));
    return { id: c.id, containerNumber: c.containerNumber, isShared: c.isShared, splitUnit: c.isShared ? c.splitUnit : null, shares };
}

type Payer =
    | { kind: "party"; partyId: string; label: string }
    | { kind: "vault"; vaultId: string; label: string; vaultName: string }
    | { kind: "fee"; label: string }
    | { kind: "branch_vault"; vaultId: string; branchId: string; label: string; vaultName: string }
    | { kind: "branch_on_behalf"; vaultId: string; branchId: string; label: string; vaultName: string };

/** Cash left one of the vaults for this charge (it gets a payment receipt and counts for the negative-vault warning). */
const vaultOf = (p: Payer) => (p.kind === "vault" || p.kind === "branch_vault" || p.kind === "branch_on_behalf" ? p : null);

/**
 * Who paid an expense that the branch paid, or the owner paid for it. The branch's vault holds dinar only, so a
 * dollar expense is turned into dinar at the rate typed on the row (the traders then owe the branch in dinar).
 */
async function branchPayer(
    tx: DbOrTx,
    branch: { id: string; name: string },
    row: ChargeRow,
    f: (name: string) => string,
): Promise<{ payer: Payer; row: ChargeRow }> {
    if (!row.vaultId) throw new DomainError("اختر القاصة التي دُفع منها", f("vaultId"));
    const [vault] = await tx.select().from(vaults).where(eq(vaults.id, row.vaultId));
    if (!vault || !vault.isActive) throw new DomainError("اختر القاصة التي دُفع منها", f("vaultId"));
    if (vault.partyId && vault.partyId !== branch.id) throw new DomainError("اختر القاصة التي دُفع منها", f("vaultId"));
    let out = row;
    if (row.currency === "USD") {
        const rate = row.fxRate ? new Decimal(row.fxRate) : null;
        if (!rate || rate.lte(0)) throw new DomainError("اكتب سعر الدولار: قاصة الشراكة بالدينار فقط", f("fxRate"));
        if (row.split.mode === "manual") throw new DomainError("للتقسيم اليدوي اكتب المبلغ بالدينار مباشرة", f("amount"));
        const iqd = roundTo(new Decimal(row.amount).times(rate), "IQD");
        const was = `${formatMoney(row.amount, "USD")} × ${formatNumber(rate.toString())}`;
        out = { ...row, amount: iqd, currency: "IQD", note: row.note ? `${row.note} · ${was}` : was };
    }
    if (!vault.allowedCurrencies.includes(out.currency)) throw new DomainError(t("error.vaultCurrency"), f("vaultId"));
    const payer: Payer = vault.partyId
        ? { kind: "branch_vault", vaultId: vault.id, branchId: branch.id, label: `${branch.name} · ${vault.name}`, vaultName: vault.name }
        : { kind: "branch_on_behalf", vaultId: vault.id, branchId: branch.id, label: `${vault.name} · عن ${branch.name}`, vaultName: vault.name };
    return { payer, row: out };
}

interface PreparedCharge {
    row: ChargeRow;
    typeName: string;
    isFee: boolean;
    payer: Payer;
    split: ChargeSplit;
    allocations: Allocation[];
}

/** Checks one row against the database and computes its allocations. Throws DomainError on the row's field. */
async function prepareRow(tx: DbOrTx, ctx: ContainerCtx, input: ChargeRow, i: number): Promise<PreparedCharge> {
    let row = input;
    const f = (name: string) => `rows.${i}.${name}`;
    const [type] = await tx.select().from(chargeTypes).where(eq(chargeTypes.id, row.chargeTypeId));
    if (!type || !type.isActive) throw new DomainError("نوع المصروف غير موجود أو موقوف", f("chargeTypeId"));

    let payer: Payer;
    if (type.isFee) {
        payer = { kind: "fee", label: "ربح الشركة" };
    } else {
        if (!row.paidByPartyId) throw new DomainError("اختر من دفع المبلغ", f("paidByPartyId"));
        const [party] = await tx.select().from(parties).where(eq(parties.id, row.paidByPartyId));
        if (!party || !party.isActive) throw new DomainError("اختر من دفع المبلغ", f("paidByPartyId"));
        if (party.isBranch) {
            ({ payer, row } = await branchPayer(tx, party, row, f));
        } else if (party.kind === "self") {
            if (!row.vaultId) throw new DomainError("اختر القاصة التي دُفع منها", f("vaultId"));
            const [vault] = await tx.select().from(vaults).where(eq(vaults.id, row.vaultId));
            if (!vault || !vault.isActive || vault.partyId) throw new DomainError("اختر القاصة التي دُفع منها", f("vaultId"));
            if (!vault.allowedCurrencies.includes(row.currency)) throw new DomainError(t("error.vaultCurrency"), f("vaultId"));
            payer = { kind: "vault", vaultId: vault.id, label: `${party.name} · ${vault.name}`, vaultName: vault.name };
        } else {
            payer = { kind: "party", partyId: party.id, label: party.name };
        }
    }

    // A normal container has one trader: anything but "by share" makes no sense there.
    const split: ChargeSplit = ctx.isShared ? row.split : { mode: "by_share" };
    let allocations: Allocation[];
    try {
        allocations = allocateCharge({ amount: row.amount, currency: row.currency, unit: ctx.splitUnit, shares: ctx.shares, split });
    } catch (e) {
        if (!(e instanceof SplitError)) throw e;
        if (e.code === "manual_mismatch") {
            throw new DomainError(
                t("error.manualSplitTotal", { total: formatMoney(row.amount, row.currency), remaining: formatMoney(e.remaining ?? "0", row.currency) }),
                f("manual"),
            );
        }
        if (e.code === "unknown_trader") throw new DomainError("اختر التاجر", f("splitTraderId"));
        throw new DomainError(t("error.shareZero"), f("amount"));
    }
    return { row, typeName: type.name, isFee: type.isFee, payer, split, allocations };
}

/** Posts one prepared charge: one journal entry, one container_charges row, its allocations. */
async function postCharge(tx: DbOrTx, ctx: ContainerCtx, p: PreparedCharge, date: string, userId: string) {
    const names = new Map(
        (
            await tx
                .select({ id: traders.id, name: traders.name })
                .from(traders)
                .where(
                    inArray(
                        traders.id,
                        p.allocations.map((a) => a.traderId),
                    ),
                )
        ).map((x) => [x.id, x.name]),
    );
    const lines = postings.containerCharge({
        currency: p.row.currency,
        amount: p.row.amount,
        allocations: p.allocations.map((a) => ({ ...a, memo: chargeMemo(p.split, ctx.splitUnit, ctx.shares, a.traderId) })),
        payer:
            p.payer.kind === "party"
                ? { kind: "party", partyId: p.payer.partyId }
                : p.payer.kind === "vault" || p.payer.kind === "branch_vault"
                  ? { kind: p.payer.kind, vaultId: p.payer.vaultId }
                  : p.payer.kind === "branch_on_behalf"
                    ? { kind: "branch_on_behalf", vaultId: p.payer.vaultId, branchId: p.payer.branchId }
                    : { kind: "fee" },
        memo: p.row.note,
    });
    const paidFrom = vaultOf(p.payer);
    const { entryId, receiptNo } = await postEntry(tx, {
        type: "container_charge",
        date,
        receiptKind: paidFrom ? "out" : null,
        description: `${p.typeName} · ${ctx.containerNumber}`,
        counterpartyLabel: p.payer.label,
        amount: p.row.amount,
        currency: p.row.currency,
        containerId: ctx.id,
        meta: {
            chargeType: p.typeName,
            containerNumber: ctx.containerNumber,
            payer: p.payer.label,
            ...(paidFrom ? { vaultName: paidFrom.vaultName } : {}),
            ...(p.payer.kind === "branch_vault" || p.payer.kind === "branch_on_behalf" ? { owedTo: "branch", branchId: p.payer.branchId } : {}),
            traders: p.allocations.filter((a) => Number(a.amount) > 0).map((a) => ({ name: names.get(a.traderId) ?? "", amount: a.amount })),
        },
        userId,
        lines,
    });
    const [charge] = await tx
        .insert(containerCharges)
        .values({
            containerId: ctx.id,
            chargeTypeId: p.row.chargeTypeId,
            amount: p.row.amount,
            currency: p.row.currency,
            paidByPartyId: p.payer.kind === "fee" ? null : (p.row.paidByPartyId ?? null),
            paidFromVaultId: paidFrom?.vaultId ?? null,
            isFee: p.isFee,
            splitMode: p.split.mode,
            journalEntryId: entryId,
            note: p.row.note,
            userId,
        })
        .returning();
    const parts = p.allocations.filter((a) => Number(a.amount) > 0);
    if (parts.length) await tx.insert(containerChargeAllocations).values(parts.map((a) => ({ chargeId: charge.id, traderId: a.traderId, amount: a.amount })));
    await audit(tx, { table: "container_charges", recordId: charge.id, action: "create", after: { ...charge, allocations: parts }, userId });
    return { chargeId: charge.id, entryId, receiptNo };
}

/**
 * Adds the rows of the charges sheet in one transaction (PRD §5.4). A vault that would go
 * below zero needs `allowNegative` (the owner confirmed the warning).
 */
export async function addCharges(
    tx: DbOrTx,
    input: AddChargesInput,
    userId: string,
): Promise<{ charges: { chargeId: string; entryId: string; receiptNo: string | null }[] }> {
    const data = addChargesSchema.parse(input);
    const ctx = await loadContainer(tx, data.containerId, true);
    const prepared: PreparedCharge[] = [];
    for (const [i, row] of data.rows.entries()) prepared.push(await prepareRow(tx, ctx, row, i));

    if (!data.allowNegative) {
        const short = await vaultShortfalls(
            tx,
            prepared.flatMap((p) => {
                const v = vaultOf(p.payer);
                return v ? [{ vaultId: v.vaultId, currency: p.row.currency, amount: p.row.amount }] : [];
            }),
        );
        if (short.length) throw new DomainError(t("warn.negativeVault"), "allowNegative");
    }

    const out = [];
    for (const p of prepared) out.push(await postCharge(tx, ctx, p, data.date, userId));
    return { charges: out };
}

/** Cancels a charge (A14): reverses its entry and marks it cancelled with the reason. Both stay visible. */
export async function cancelCharge(tx: DbOrTx, chargeId: string, reason: string, userId: string, date: string = todayISO()) {
    const why = reason.trim();
    if (!why) throw new DomainError("اكتب سبب الإلغاء", "reason");
    const [charge] = await tx.select().from(containerCharges).where(eq(containerCharges.id, chargeId)).for("update");
    if (!charge) throw new DomainError("لم يُعثر على المصروف");
    if (charge.cancelledAt) throw new DomainError("هذا المصروف ملغى مسبقاً");
    const result = await reverseEntry(tx, charge.journalEntryId, why, date, userId);
    await tx.update(containerCharges).set({ cancelledAt: new Date(), cancelReason: why }).where(eq(containerCharges.id, chargeId));
    await audit(tx, {
        table: "container_charges",
        recordId: chargeId,
        action: "cancel",
        before: charge,
        after: { cancelReason: why, reversalEntryId: result.entryId },
        userId,
    });
    return result;
}

export interface ResplitItem {
    chargeId: string;
    chargeTypeName: string;
    amount: string;
    currency: Currency;
    newMode: ChargeSplit["mode"];
    before: (Allocation & { traderName: string })[];
    after: (Allocation & { traderName: string })[];
}

const sameParts = (a: Allocation[], b: Allocation[]) => {
    const key = (xs: Allocation[]) =>
        xs
            .filter((x) => Number(x.amount) > 0)
            .map((x) => `${x.traderId}:${Number(x.amount)}`)
            .sort()
            .join("|");
    return key(a) === key(b);
};

/**
 * Active charges whose saved parts no longer match the container's shares (PRD §5.3 "changing shares later").
 * By-share charges follow the shares; one-trader and manual charges keep their parts while those traders are still
 * on the container, otherwise they fall back to the shares.
 */
export async function planResplit(db: DbOrTx, containerId: string): Promise<ResplitItem[]> {
    const ctx = await loadContainer(db, containerId, false);
    const active = await db
        .select({
            id: containerCharges.id,
            amount: containerCharges.amount,
            currency: containerCharges.currency,
            splitMode: containerCharges.splitMode,
            typeName: chargeTypes.name,
        })
        .from(containerCharges)
        .innerJoin(chargeTypes, eq(chargeTypes.id, containerCharges.chargeTypeId))
        .where(and(eq(containerCharges.containerId, containerId), isNull(containerCharges.cancelledAt)))
        .orderBy(asc(containerCharges.createdAt));
    if (!active.length) return [];

    const allocs = await db
        .select({ chargeId: containerChargeAllocations.chargeId, traderId: containerChargeAllocations.traderId, amount: containerChargeAllocations.amount })
        .from(containerChargeAllocations)
        .where(
            inArray(
                containerChargeAllocations.chargeId,
                active.map((c) => c.id),
            ),
        );
    const traderIds = [...new Set([...allocs.map((a) => a.traderId), ...ctx.shares.map((s) => s.traderId)])];
    const names = new Map(
        (await db.select({ id: traders.id, name: traders.name }).from(traders).where(inArray(traders.id, traderIds))).map((x) => [x.id, x.name]),
    );
    const onContainer = new Set(ctx.shares.map((s) => s.traderId));
    const named = (xs: Allocation[]) => xs.map((x) => ({ ...x, traderName: names.get(x.traderId) ?? "" }));

    const out: ResplitItem[] = [];
    for (const c of active) {
        const before = allocs.filter((a) => a.chargeId === c.id).map((a) => ({ traderId: a.traderId, amount: a.amount }));
        const keepsParts = c.splitMode !== "by_share" && before.every((a) => Number(a.amount) === 0 || onContainer.has(a.traderId));
        if (keepsParts) continue;
        let after: Allocation[];
        try {
            after = allocateCharge({ amount: c.amount, currency: c.currency, unit: ctx.splitUnit, shares: ctx.shares, split: { mode: "by_share" } });
        } catch {
            continue;
        }
        if (sameParts(before, after)) continue;
        out.push({
            chargeId: c.id,
            chargeTypeName: c.typeName,
            amount: c.amount,
            currency: c.currency,
            newMode: "by_share",
            before: named(before),
            after: named(after.filter((a) => Number(a.amount) > 0)),
        });
    }
    return out;
}

/** Cancels and re-posts every charge planResplit lists, in one transaction. The cash side is unchanged. */
export async function resplitCharges(tx: DbOrTx, containerId: string, userId: string, date: string = todayISO()): Promise<{ count: number }> {
    const ctx = await loadContainer(tx, containerId, true);
    const plan = await planResplit(tx, containerId);
    for (const item of plan) {
        const [old] = await tx.select().from(containerCharges).where(eq(containerCharges.id, item.chargeId));
        await cancelCharge(tx, item.chargeId, RESPLIT_REASON, userId, date);
        const [type] = await tx.select({ name: chargeTypes.name }).from(chargeTypes).where(eq(chargeTypes.id, old.chargeTypeId));
        const payer = await savedPayer(tx, old);
        await postCharge(
            tx,
            ctx,
            {
                row: {
                    chargeTypeId: old.chargeTypeId,
                    amount: old.amount,
                    currency: old.currency,
                    paidByPartyId: old.paidByPartyId,
                    vaultId: old.paidFromVaultId,
                    fxRate: null,
                    split: { mode: "by_share" },
                    note: old.note,
                },
                typeName: type.name,
                isFee: old.isFee,
                payer,
                split: { mode: "by_share" },
                allocations: allocateCharge({
                    amount: old.amount,
                    currency: old.currency,
                    unit: ctx.splitUnit,
                    shares: ctx.shares,
                    split: { mode: "by_share" },
                }),
            },
            date,
            userId,
        );
    }
    return { count: plan.length };
}

async function partyName(tx: DbOrTx, id: string) {
    const [p] = await tx.select({ name: parties.name }).from(parties).where(eq(parties.id, id));
    return p?.name ?? "";
}

/** Who paid a saved charge, rebuilt to post it again (re-split). Before branches existed, the partnership was a plain party. */
async function savedPayer(tx: DbOrTx, old: { isFee: boolean; paidByPartyId: string | null; paidFromVaultId: string | null }): Promise<Payer> {
    if (old.isFee) return { kind: "fee", label: "ربح الشركة" };
    if (!old.paidFromVaultId) return { kind: "party", partyId: old.paidByPartyId!, label: await partyName(tx, old.paidByPartyId!) };
    const [party] = old.paidByPartyId ? await tx.select().from(parties).where(eq(parties.id, old.paidByPartyId)) : [];
    if (party?.isBranch) {
        const [v] = await tx.select().from(vaults).where(eq(vaults.id, old.paidFromVaultId));
        return v.partyId
            ? { kind: "branch_vault", vaultId: v.id, branchId: party.id, label: `${party.name} · ${v.name}`, vaultName: v.name }
            : { kind: "branch_on_behalf", vaultId: v.id, branchId: party.id, label: `${v.name} · عن ${party.name}`, vaultName: v.name };
    }
    return vaultPayer(tx, old.paidByPartyId, old.paidFromVaultId);
}

async function vaultPayer(tx: DbOrTx, partyId: string | null, vaultId: string): Promise<Payer> {
    const [v] = await tx.select({ name: vaults.name }).from(vaults).where(eq(vaults.id, vaultId));
    const who = partyId ? await partyName(tx, partyId) : "شركتنا";
    return { kind: "vault", vaultId, label: `${who} · ${v?.name ?? ""}`, vaultName: v?.name ?? "" };
}
