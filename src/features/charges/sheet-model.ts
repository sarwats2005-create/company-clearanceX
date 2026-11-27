/**
 * State helpers of the "إضافة مصاريف" sheet (PRD §5.4). Pure: the sheet renders them live and the
 * server re-checks everything with the same allocateCharge.
 */
import type { Currency } from "@/db/schema";
import { formatMoney } from "@/lib/format";
import Decimal from "decimal.js";
import { parseAmount, parseTypedDecimal, roundTo } from "@/lib/money";
import { type ChargeSplit, type PerCurrency, allocateCharge, summarizeCharges } from "./allocate";
import type { ChargeSheetData } from "./queries";
import type { AddChargesInput } from "./schemas";
import { type Allocation, SplitError } from "./split";

export type SplitModeValue = ChargeSplit["mode"];

export interface SheetRow {
    amount: string;
    currency: Currency;
    paidByPartyId: string | null;
    vaultId: string | null;
    /** Dollar rate when the branch (dinar vault only) paid a dollar expense. */
    fxRate: string;
    splitMode: SplitModeValue;
    splitTraderId: string | null;
    manual: Record<string, string>;
    note: string;
}

type ChargeType = ChargeSheetData["chargeTypes"][number];

const isSelf = (d: ChargeSheetData, partyId: string | null) => !!partyId && d.parties.some((p) => p.id === partyId && p.isSelf);
export const isBranch = (d: ChargeSheetData, partyId: string | null) => !!partyId && d.parties.some((p) => p.id === partyId && p.isBranch);
/** Our company and our branch pay from a vault (and get a payment receipt); outside parties don't. */
export const paysFromVault = (d: ChargeSheetData, partyId: string | null) => isSelf(d, partyId) || isBranch(d, partyId);

/** A vault of the owner that accepts the currency: the Settings default first, else the first one that fits. */
export function vaultFor(d: ChargeSheetData, currency: Currency, current: string | null = null): string | null {
    const fits = (id: string | null | undefined) => !!id && d.vaults.some((v) => v.id === id && !v.partyId && v.allowedCurrencies.includes(currency));
    if (fits(current)) return current;
    if (fits(d.defaultVaults[currency])) return d.defaultVaults[currency]!;
    return d.vaults.find((v) => !v.partyId && v.allowedCurrencies.includes(currency))?.id ?? null;
}

/** The branch's own vault (its expenses are paid from it unless the owner paid for it). */
export const branchVaultOf = (d: ChargeSheetData, partyId: string | null) => d.vaults.find((v) => !!partyId && v.partyId === partyId)?.id ?? null;

/** Where a payer's expense is paid from by default. */
export function payerVault(d: ChargeSheetData, partyId: string | null, currency: Currency, current: string | null = null): string | null {
    if (isBranch(d, partyId)) {
        const ok = d.vaults.some((v) => v.id === current && (v.partyId === partyId || (!v.partyId && v.allowedCurrencies.includes("IQD"))));
        return ok ? current : branchVaultOf(d, partyId);
    }
    return isSelf(d, partyId) ? vaultFor(d, currency, current) : null;
}

/** A branch-paid dollar expense becomes dinar at the typed rate (the branch's vault is dinar only). */
export function branchDinar(d: ChargeSheetData, row: SheetRow): string | null {
    if (!isBranch(d, row.paidByPartyId) || row.currency !== "USD") return null;
    const usd = parseAmount(row.amount, "USD");
    const rate = parseTypedDecimal(row.fxRate);
    if (usd === null || rate === null || Number(rate) <= 0) return null;
    return roundTo(new Decimal(usd).times(rate), "IQD");
}

/** A ticked tile's row, prefilled from the charge type and the container size (PRD §5.4 step 3). */
export function newRow(type: ChargeType, d: ChargeSheetData): SheetRow {
    const paidByPartyId = type.isFee ? null : type.defaultPartyId;
    return {
        amount: type.defaultAmount ? type.defaultAmount.replace(/\.00$/, "") : "",
        currency: type.defaultCurrency,
        paidByPartyId,
        vaultId: payerVault(d, paidByPartyId, type.defaultCurrency),
        fxRate: "",
        splitMode: "by_share",
        splitTraderId: null,
        manual: {},
        note: "",
    };
}

const splitOf = (row: SheetRow): ChargeSplit =>
    row.splitMode === "single_trader"
        ? { mode: "single_trader", traderId: row.splitTraderId ?? "" }
        : row.splitMode === "manual"
          ? { mode: "manual", amounts: row.manual }
          : { mode: "by_share" };

export type RowPreview = { kind: "none" } | { kind: "parts"; parts: Allocation[] } | { kind: "remaining"; remaining: string };

/** Each trader's part under a row, or what is left to type in a manual split. */
export function rowPreview(row: SheetRow, d: ChargeSheetData): RowPreview {
    const amount = parseAmount(row.amount, row.currency);
    if (amount === null || Number(amount) <= 0) return { kind: "none" };
    try {
        const parts = allocateCharge({
            amount,
            currency: row.currency,
            unit: d.container.splitUnit,
            shares: d.container.shares,
            split: d.container.isShared ? splitOf(row) : { mode: "by_share" },
        });
        return { kind: "parts", parts };
    } catch (e) {
        if (e instanceof SplitError && e.code === "manual_mismatch") return { kind: "remaining", remaining: e.remaining ?? "0" };
        return { kind: "none" };
    }
}

/**
 * Live totals at the bottom of the sheet: per currency, the fee part, each trader's part. Every row with a valid
 * amount counts in the totals; a row whose split isn't finished yet (manual, amounts don't add up) is left out of
 * the traders' parts and counted in `unsplit`.
 */
export function sheetSummary(d: ChargeSheetData, order: string[], rows: Record<string, SheetRow>) {
    const isFee = new Map(d.chargeTypes.map((t) => [t.id, t.isFee]));
    let unsplit = 0;
    const charges = order.flatMap((id) => {
        const row = rows[id];
        const amount = row ? parseAmount(row.amount, row.currency) : null;
        if (!row || amount === null || Number(amount) <= 0) return [];
        const p = rowPreview(row, d);
        if (p.kind !== "parts") unsplit++;
        return [{ amount, currency: row.currency, isFee: !!isFee.get(id), allocations: p.kind === "parts" ? p.parts : [] }];
    });
    const s = summarizeCharges(charges);
    return { ...s, count: charges.length, unsplit };
}

const moneyList = (x: PerCurrency) =>
    (["USD", "IQD"] as Currency[])
        .filter((c) => Number(x[c]) !== 0)
        .map((c) => formatMoney(x[c], c))
        .join(" و ");

/** The confirmation sentence (PRD §5.4 step 6). */
export function confirmSentence(d: ChargeSheetData, order: string[], rows: Record<string, SheetRow>): string {
    const s = sheetSummary(d, order, rows);
    const c = d.container;
    if (!c.isShared) {
        const fees = moneyList(s.fees);
        return `سيتم تسجيل ${moneyList(s.total)} على التاجر ${c.shares[0]?.name ?? ""} عن الحاوية ${c.containerNumber}${fees ? `، منها ${fees} أتعاب` : ""}`;
    }
    const parts = c.shares
        .map((sh) => ({ name: sh.name, money: s.perTrader[sh.traderId] ? moneyList(s.perTrader[sh.traderId]) : "" }))
        .filter((p) => p.money)
        .map((p) => `${p.name} ${p.money}`)
        .join(" · ");
    return `سيتم تسجيل ${moneyList(s.total)} عن الحاوية ${c.containerNumber}: ${parts}`;
}

/** What leaves each of our vaults (charges paid by شركتنا), for the negative-balance warning. */
export function vaultOutflows(d: ChargeSheetData, order: string[], rows: Record<string, SheetRow>) {
    return order.flatMap((id) => {
        const row = rows[id];
        const type = d.chargeTypes.find((t) => t.id === id);
        if (!row || !type || type.isFee || !paysFromVault(d, row.paidByPartyId) || !row.vaultId) return [];
        const dinar = branchDinar(d, row);
        const amount = dinar ?? (isBranch(d, row.paidByPartyId) && row.currency === "USD" ? null : parseAmount(row.amount, row.currency));
        if (amount === null || Number(amount) <= 0) return [];
        return [{ vaultId: row.vaultId, currency: dinar ? ("IQD" as Currency) : row.currency, amount }];
    });
}

/** The server action's input. Fields that don't apply to a row are sent empty. */
export function toInput(d: ChargeSheetData, date: string, order: string[], rows: Record<string, SheetRow>, allowNegative = false): AddChargesInput {
    return {
        containerId: d.container.id,
        date,
        allowNegative,
        rows: order.map((id) => {
            const row = rows[id];
            const type = d.chargeTypes.find((t) => t.id === id);
            const fee = !!type?.isFee;
            const mode = d.container.isShared ? row.splitMode : "by_share";
            return {
                chargeTypeId: id,
                amount: row.amount,
                currency: row.currency,
                paidByPartyId: fee ? null : row.paidByPartyId,
                vaultId: !fee && paysFromVault(d, row.paidByPartyId) ? row.vaultId : null,
                fxRate: !fee && isBranch(d, row.paidByPartyId) && row.currency === "USD" ? row.fxRate : null,
                splitMode: mode,
                splitTraderId: mode === "single_trader" ? row.splitTraderId : null,
                manual: mode === "manual" ? Object.fromEntries(Object.entries(row.manual).filter(([, v]) => v.trim() !== "")) : undefined,
                note: row.note.trim() || null,
            };
        }),
    };
}
