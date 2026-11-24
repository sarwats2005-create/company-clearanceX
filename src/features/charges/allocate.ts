/**
 * How one charge lands on the traders of a container (PRD §5.3). Pure: the charges sheet uses it for
 * the live preview and the server uses the very same function to post, so the preview never lies.
 */
import Decimal from "decimal.js";
import type { Currency, SplitUnit } from "@/db/schema";
import { type ShareValue, shareWeights } from "@/features/containers/shares";
import { formatNumber } from "@/lib/format";
import { roundTo } from "@/lib/money";
import { type Allocation, splitAmount } from "./split";

export type ChargeSplit = { mode: "by_share" } | { mode: "single_trader"; traderId: string } | { mode: "manual"; amounts: Record<string, string> };

/** Every trader of the container with their part (zero parts included, callers skip them). Throws SplitError. */
export function allocateCharge(p: { amount: string; currency: Currency; unit: SplitUnit | null; shares: ShareValue[]; split: ChargeSplit }): Allocation[] {
    const weights = shareWeights(p.unit, p.shares);
    if (p.split.mode === "single_trader") return splitAmount(p.amount, p.currency, weights, "single_trader", { traderId: p.split.traderId });
    if (p.split.mode === "manual") return splitAmount(p.amount, p.currency, weights, "manual", { manual: p.split.amounts });
    return splitAmount(p.amount, p.currency, weights, p.unit === "equal" ? "equal" : "by_share");
}

const UNIT_SHORT: Partial<Record<SplitUnit, string>> = { meters: "م", cbm: "م³" };

/** The note on a trader's statement line, e.g. "حصتك 4 م من 9.5 م". Null for a normal container. */
export function chargeMemo(split: ChargeSplit, unit: SplitUnit | null, shares: ShareValue[], traderId: string): string | null {
    if (!unit || shares.length < 2) return null;
    if (split.mode === "manual") return "توزيع يدوي";
    if (split.mode === "single_trader") return "على تاجر واحد";
    if (unit === "equal") return `حصة متساوية (1 من ${shares.length})`;
    const mine = shares.find((s) => s.traderId === traderId)?.shareValue ?? "0";
    if (unit === "percent") return `حصتك ${formatNumber(mine)}%`;
    const total = shares.reduce((s, x) => s.plus(x.shareValue || 0), new Decimal(0));
    return `حصتك ${formatNumber(mine)} ${UNIT_SHORT[unit]} من ${formatNumber(total)} ${UNIT_SHORT[unit]}`;
}

export type PerCurrency = Record<Currency, string>;

export interface ChargeLike {
    amount: string;
    currency: Currency;
    isFee: boolean;
    allocations: Allocation[];
}

/** Container money summary (PRD §5.4a): pass-through costs, fees (profit), total billed, and each trader's part. */
export function summarizeCharges(charges: ChargeLike[]): { costs: PerCurrency; fees: PerCurrency; total: PerCurrency; perTrader: Record<string, PerCurrency> } {
    const zero = () => ({ IQD: new Decimal(0), USD: new Decimal(0) });
    const costs = zero();
    const fees = zero();
    const perTrader: Record<string, ReturnType<typeof zero>> = {};
    for (const c of charges) {
        (c.isFee ? fees : costs)[c.currency] = (c.isFee ? fees : costs)[c.currency].plus(c.amount);
        for (const a of c.allocations) {
            perTrader[a.traderId] ??= zero();
            perTrader[a.traderId][c.currency] = perTrader[a.traderId][c.currency].plus(a.amount);
        }
    }
    const out = (x: ReturnType<typeof zero>): PerCurrency => ({ IQD: roundTo(x.IQD, "IQD"), USD: roundTo(x.USD, "USD") });
    return {
        costs: out(costs),
        fees: out(fees),
        total: out({ IQD: costs.IQD.plus(fees.IQD), USD: costs.USD.plus(fees.USD) }),
        perTrader: Object.fromEntries(Object.entries(perTrader).map(([k, v]) => [k, out(v)])),
    };
}
