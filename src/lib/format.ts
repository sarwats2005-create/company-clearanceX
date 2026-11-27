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
    const text = `${negative ? "\u200E-" : ""}${groupThousands(int)}${frac ? `.${frac}` : ""}`;
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

/** "منذ" column: 0 → اليوم, 1 → يوم واحد, 2 → يومان, 3–10 → n أيام, 11–99 → n يوماً, 100 → n يوم. */
/** Arabic counted noun: 1 and 2 have their own words, 3–10 take the plural, 11–99 the accusative singular, the rest the singular. */
export function countAr(n: number, f: { one: string; two: string; few: string; many: string; other: string }): string {
    if (n === 1) return f.one;
    if (n === 2) return f.two;
    const r = n % 100;
    const num = formatNumber(n);
    if (r >= 3 && r <= 10) return `${num} ${f.few}`;
    if (r >= 11) return `${num} ${f.many}`;
    return `${num} ${f.other}`;
}

export function daysText(n: number): string {
    if (n <= 0) return "اليوم";
    return countAr(n, { one: "يوم واحد", two: "يومان", few: "أيام", many: "يوماً", other: "يوم" });
}

export const containersText = (n: number) => countAr(n, { one: "حاوية واحدة", two: "حاويتان", few: "حاويات", many: "حاوية", other: "حاوية" });

export const tradersText = (n: number) => countAr(n, { one: "تاجر واحد", two: "تاجران", few: "تجار", many: "تاجراً", other: "تاجر" });

/** How a debit − credit balance reads to the owner (PRD §6.1): عليه (owes us), له (we owe), مسدد. Rounded first. */
export function balanceSide(balance: string | Decimal, currency: Currency): "owesUs" | "weOwe" | "settled" {
    const d = new Decimal(balance).toDecimalPlaces(currency === "IQD" ? 0 : 2, Decimal.ROUND_HALF_UP);
    return d.isZero() ? "settled" : d.isPos() ? "owesUs" : "weOwe";
}
