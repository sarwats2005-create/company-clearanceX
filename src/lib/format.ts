/**
 * Display formatting (PRD §10.5 item 9): thousands separators, symbol after the number,
 * no decimals for IQD, Latin digits, dd/MM/yyyy, Iraqi month names.
 */
import Decimal from "decimal.js";
import type { Currency } from "@/db/schema";
import { messages } from "@/lib/i18n";

export const TIME_ZONE = "Asia/Baghdad";

const SYMBOL: Record<Currency, string> = { IQD: messages.currency.symbol.IQD, USD: messages.currency.symbol.USD };

function groupThousands(intPart: string) {
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "3144000","IQD" → "3,144,000 د.ع"; "2400.00","USD" → "2,400 $"; "2400.5","USD" → "2,400.50 $". */
export function formatMoney(amount: string | Decimal, currency: Currency, opts: { symbol?: boolean } = {}): string {
    const d = new Decimal(amount);
    const dp = currency === "IQD" ? 0 : 2;
    let fixed = d.abs().toDecimalPlaces(dp, Decimal.ROUND_HALF_UP).toFixed(dp);
    if (currency === "USD" && fixed.endsWith(".00")) fixed = fixed.slice(0, -3);
    const [int, frac] = fixed.split(".");
    const negative = d.isNeg() && !d.toDecimalPlaces(dp).isZero();
    const text = `${negative ? "-" : ""}${groupThousands(int)}${frac ? `.${frac}` : ""}`;
    return opts.symbol === false ? text : `${text} ${SYMBOL[currency]}`;
}

/** Plain numbers (shares, weights): up to 3 decimals, trailing zeros dropped. */
export function formatNumber(value: string | number | Decimal): string {
    const d = new Decimal(value).toDecimalPlaces(3);
    const [int, frac] = d.abs().toFixed().split(".");
    return `${d.isNeg() ? "-" : ""}${groupThousands(int)}${frac ? `.${frac}` : ""}`;
}

/** Calendar parts of a Date as seen in Baghdad. */
function baghdadParts(d: Date) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)!.value;
    return { y: get("year"), m: get("month"), d: get("day") };
}

/** Accepts "yyyy-mm-dd" (a calendar day) or a Date (an instant, read in Baghdad time). */
function toYmd(value: Date | string) {
    if (typeof value === "string") {
        const [y, m, d] = value.slice(0, 10).split("-");
        return { y, m, d };
    }
    return baghdadParts(value);
}

/** Today's calendar date in Baghdad as "yyyy-mm-dd". */
export function todayISO(now: Date = new Date()): string {
    const { y, m, d } = baghdadParts(now);
    return `${y}-${m}-${d}`;
}

/** "2026-11-24" → "24/11/2026". */
export function formatDate(value: Date | string): string {
    const { y, m, d } = toYmd(value);
    return `${d}/${m}/${y}`;
}

/** Iraqi month name for month number 1..12 (1 = كانون الثاني). */
export function iraqiMonth(month: number): string {
    return messages.months[month - 1];
}

/** "24 تشرين الثاني 2026", optionally with the weekday first. */
export function formatDateLong(value: Date | string, opts: { weekday?: boolean } = {}): string {
    const { y, m, d } = toYmd(value);
    const text = `${Number(d)} ${iraqiMonth(Number(m))} ${y}`;
    if (!opts.weekday) return text;
    const weekday = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).getUTCDay();
    return `${messages.weekdays[weekday]} ${text}`;
}

/** "24/11/2026 · 14:05" for timestamps (Baghdad time). */
export function formatDateTime(value: Date): string {
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(value);
    return `${formatDate(value)} · ${time}`;
}

/** Whole days between two calendar dates (b − a). */
export function daysBetween(a: string, b: string): number {
    return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
