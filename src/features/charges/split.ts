/**
 * Splitting one charge between the traders of a shared container (PRD §5.3).
 * Each share is rounded for the currency (half up); the rounding leftover goes to the
 * largest share (first row on a tie) so the parts always add up exactly to the total.
 */
import Decimal from "decimal.js";
import type { Currency } from "@/db/schema";
import { DECIMALS, normalizeDigits, parseAmount, roundTo } from "@/lib/money";

export type SplitMode = "by_share" | "single_trader" | "manual" | "equal";
export type SplitErrorCode = "zero_weight" | "manual_mismatch" | "unknown_trader";

export interface ShareWeight {
    traderId: string;
    /** Share in the container's unit (meters, m³, %). Ignored for "equal". */
    weight: string;
}

export interface Allocation {
    traderId: string;
    amount: string;
}

export class SplitError extends Error {
    constructor(
        public readonly code: SplitErrorCode,
        /** For manual_mismatch: total − sum of typed amounts. */
        public readonly remaining?: string,
    ) {
        super(code);
        this.name = "SplitError";
    }
}

function weightOf(raw: string): Decimal | null {
    const s = normalizeDigits(raw ?? "")
        .replace(/[\s,٬]/g, "")
        .replace(/٫/g, ".");
    if (!/^-?\d+(\.\d+)?$|^-?\.\d+$/.test(s)) return null;
    return new Decimal(s);
}

export function splitAmount(
    total: string,
    currency: Currency,
    shares: ShareWeight[],
    mode: SplitMode,
    opts: { traderId?: string; manual?: Record<string, string> } = {},
): Allocation[] {
    const dp = DECIMALS[currency];
    const totalD = new Decimal(roundTo(total, currency));
    const out = (amounts: Decimal[]) => shares.map((s, i) => ({ traderId: s.traderId, amount: amounts[i].toFixed(dp) }));
    const known = new Set(shares.map((s) => s.traderId));

    if (mode === "single_trader") {
        if (!opts.traderId || !known.has(opts.traderId)) throw new SplitError("unknown_trader");
        return out(shares.map((s) => (s.traderId === opts.traderId ? totalD : new Decimal(0))));
    }

    if (mode === "manual") {
        const manual = opts.manual ?? {};
        for (const id of Object.keys(manual)) if (!known.has(id)) throw new SplitError("unknown_trader");
        const amounts = shares.map((s) => {
            const raw = manual[s.traderId];
            if (raw === undefined || raw.trim() === "") return new Decimal(0);
            const parsed = parseAmount(raw, currency);
            if (parsed === null) throw new SplitError("manual_mismatch", totalD.toFixed(dp));
            return new Decimal(parsed);
        });
        const remaining = totalD.minus(Decimal.sum(...amounts, 0));
        if (!remaining.isZero()) throw new SplitError("manual_mismatch", remaining.toFixed(dp));
        return out(amounts);
    }

    const weights = shares.map((s) => (mode === "equal" ? new Decimal(1) : weightOf(s.weight)));
    if (weights.some((w) => w === null || w.isNeg())) throw new SplitError("zero_weight");
    const ws = weights as Decimal[];
    const sum = Decimal.sum(...ws, 0);
    if (shares.length === 0 || sum.lte(0)) throw new SplitError("zero_weight");

    const amounts = ws.map((w) => totalD.times(w).div(sum).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP));
    const leftover = totalD.minus(Decimal.sum(...amounts));
    if (!leftover.isZero()) {
        let largest = 0;
        ws.forEach((w, i) => {
            if (w.gt(ws[largest])) largest = i;
        });
        amounts[largest] = amounts[largest].plus(leftover);
    }
    return out(amounts);
}
