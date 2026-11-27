/** Shared-container math (PRD §5.3). Pure, used on the server and in the form preview. */
import Decimal from "decimal.js";
import type { SplitUnit } from "@/db/schema";

export interface ShareValue {
    traderId: string;
    shareValue: string | null;
}

const dec = (v: string | null | undefined) => {
    try {
        return v ? new Decimal(v) : new Decimal(0);
    } catch {
        return new Decimal(0);
    }
};

/** Weights for splitAmount: the typed shares, or 1 each for "equal" and for a normal (one-trader) container. */
export function shareWeights(unit: SplitUnit | null, shares: ShareValue[]): { traderId: string; weight: string }[] {
    if (!unit || unit === "equal") return shares.map((s) => ({ traderId: s.traderId, weight: "1" }));
    return shares.map((s) => ({ traderId: s.traderId, weight: dec(s.shareValue).toString() }));
}

/** Each trader's part of the total, as a percentage with one decimal ("42.1"). */
export function sharePercents(unit: SplitUnit | null, shares: ShareValue[]): { traderId: string; percent: string }[] {
    const weights = shareWeights(unit, shares);
    const total = weights.reduce((s, w) => s.plus(w.weight), new Decimal(0));
    return weights.map((w) => ({
        traderId: w.traderId,
        percent: total.isZero() ? "0" : new Decimal(w.weight).div(total).times(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toString(),
    }));
}

/** How much fits in the container for the chosen unit; null when unknown or not meaningful. */
export function capacityFor(size: { lengthM: string | null; volumeM3: string | null } | null, unit: SplitUnit | null): string | null {
    if (unit === "percent") return "100";
    if (!size || !unit || unit === "equal") return null;
    const v = unit === "meters" ? size.lengthM : size.volumeM3;
    return v ? dec(v).toString() : null;
}

/** Used and free space for the fill bar. */
export function fillSummary(unit: SplitUnit | null, shares: ShareValue[], capacity: string | null): { used: string; free: string | null; over: boolean } {
    const used = shareWeights(unit, shares).reduce((s, w) => s.plus(w.weight), new Decimal(0));
    if (capacity === null) return { used: used.toString(), free: null, over: false };
    const cap = new Decimal(capacity);
    return { used: used.toString(), free: Decimal.max(cap.minus(used), 0).toString(), over: used.gt(cap) };
}
