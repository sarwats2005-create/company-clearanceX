/**
 * تفقيط: writes an amount in Arabic words for receipts (PRD §6.5).
 * Cheque style: groups joined with "و", the currency name stays singular, ends with "لا غير".
 *   toArabicWords("2400", "USD") → "ألفان وأربعمائة دولار أمريكي لا غير"
 */
import Decimal from "decimal.js";
import type { Currency } from "@/db/schema";
import { roundTo } from "@/lib/money";

const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة"];
const TEENS: Record<number, string> = { 11: "أحد عشر", 12: "اثنا عشر" };
const TENS = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

/** Scale words: [singular, dual, plural (3–10)]. */
const SCALES: [string, string, string][] = [
    ["ألف", "ألفان", "آلاف"],
    ["مليون", "مليونان", "ملايين"],
    ["مليار", "ملياران", "مليارات"],
    ["تريليون", "تريليونان", "تريليونات"],
];

const CURRENCY_NAME: Record<Currency, string> = { IQD: "دينار عراقي", USD: "دولار أمريكي" };

/** 1..999 in words. `beforeNoun` turns "مائتان" into the construct form "مائتا" (e.g. مائتا ألف). */
function underThousand(n: number, beforeNoun = false): string {
    const parts: string[] = [];
    const h = Math.floor(n / 100);
    const rest = n % 100;
    if (h) parts.push(h === 2 && rest === 0 && beforeNoun ? "مائتا" : HUNDREDS[h]);
    if (rest) {
        if (rest <= 10) parts.push(ONES[rest]);
        else if (rest < 20) parts.push(TEENS[rest] ?? `${ONES[rest - 10]} عشر`);
        else {
            const u = rest % 10;
            const t = Math.floor(rest / 10);
            parts.push(u ? `${ONES[u]} و${TENS[t]}` : TENS[t]);
        }
    }
    return parts.join(" و");
}

/** A whole number (as a string of digits) in words. */
function integerWords(digits: string): string {
    let n = BigInt(digits);
    if (n === 0n) return "صفر";
    const groups: number[] = [];
    while (n > 0n) {
        groups.push(Number(n % 1000n));
        n /= 1000n;
    }
    const parts: string[] = [];
    for (let i = groups.length - 1; i >= 0; i--) {
        const g = groups[i];
        if (!g) continue;
        if (i === 0) {
            parts.push(underThousand(g));
            continue;
        }
        const [one, two, many] = SCALES[i - 1];
        if (g === 1) parts.push(one);
        else if (g === 2) parts.push(two);
        else if (g <= 10) parts.push(`${ONES[g]} ${many}`);
        else parts.push(`${underThousand(g, true)} ${one}`);
    }
    return parts.join(" و");
}

function centsWords(cents: number): string {
    if (cents === 1) return "سنت واحد";
    if (cents === 2) return "سنتان";
    if (cents <= 10) return `${ONES[cents]} سنتات`;
    return `${underThousand(cents)} سنتاً`;
}

export function toArabicWords(amount: string, currency: Currency): string {
    const fixed = roundTo(new Decimal(amount).abs(), currency);
    const [int, frac] = fixed.split(".");
    let text = `${integerWords(int)} ${CURRENCY_NAME[currency]}`;
    const cents = frac ? Number(frac) : 0;
    if (cents) text += ` و${centsWords(cents)}`;
    return `${text} لا غير`;
}
