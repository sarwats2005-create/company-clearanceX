/**
 * Money helpers (PRD §6.3, §10.5). Amounts are decimal strings; never JS numbers.
 * IQD has 0 decimals, USD has 2.
 */
import Decimal from "decimal.js";
import type { Currency } from "@/db/schema";

export type { Currency };
export const CURRENCIES: readonly Currency[] = ["IQD", "USD"];

/** Decimal places kept for each currency. */
export const DECIMALS: Record<Currency, number> = { IQD: 0, USD: 2 };

/** numeric(18,2) holds at most 16 digits before the point. */
const MAX_AMOUNT = new Decimal("9999999999999999.99");

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

/** Converts Arabic-Indic (٠-٩) and Persian (۰-۹) digits to Latin. */
export function normalizeDigits(input: string): string {
    return input.replace(/[٠-٩۰-۹]/g, (ch) => {
        const i = ARABIC_INDIC.indexOf(ch);
        return String(i >= 0 ? i : PERSIAN.indexOf(ch));
    });
}

/**
 * Parses what the owner typed into a money field. Accepts "2400", "2,400", "٢٬٤٠٠", "١٢٫٥", "1 250 $".
 * Returns the amount rounded for the currency ("2400.00" for USD, "2400" for IQD), or null when
 * the text is not a non-negative number.
 */
export function parseAmount(input: string, currency: Currency): string | null {
    let s = normalizeDigits(input)
        .replace(/[\s ‎‏]/g, "")
        .replace(/\$|د\.ع|USD|IQD/gi, "")
        .replace(/[,٬،]/g, "")
        .replace(/٫/g, ".");
    if (s.startsWith("+")) s = s.slice(1);
    if (!/^\d+(\.\d*)?$|^\.\d+$/.test(s)) return null;
    const d = new Decimal(s);
    if (d.isNeg() || d.gt(MAX_AMOUNT)) return null;
    return d.toDecimalPlaces(DECIMALS[currency], Decimal.ROUND_HALF_UP).toFixed(DECIMALS[currency]);
}

/** Rounds an amount for its currency (half up) and returns it with fixed decimals. */
export function roundTo(amount: string | Decimal, currency: Currency): string {
    return new Decimal(amount).toDecimalPlaces(DECIMALS[currency], Decimal.ROUND_HALF_UP).toFixed(DECIMALS[currency]);
}

export const toDecimal = (a: string | Decimal) => new Decimal(a);
export const addMoney = (...xs: (string | Decimal)[]) => xs.reduce<Decimal>((s, x) => s.plus(x), new Decimal(0)).toString();
export const subMoney = (a: string | Decimal, b: string | Decimal) => new Decimal(a).minus(b).toString();
export const negate = (a: string | Decimal) => new Decimal(a).neg().toString();
export const compareMoney = (a: string | Decimal, b: string | Decimal) => new Decimal(a).cmp(b);
export const isPositive = (a: string | Decimal) => new Decimal(a).gt(0);
export const isZero = (a: string | Decimal) => new Decimal(a).isZero();
export const absMoney = (a: string | Decimal) => new Decimal(a).abs().toString();

export { Decimal };
