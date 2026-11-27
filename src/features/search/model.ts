/** Global search helpers (PRD §8.2). Pure: used by the server query and the search dialog. */
import { TIME_ZONE } from "@/lib/format";
import { normalizeDigits } from "@/lib/money";

/** "ق-123", "ص 000045", "ع١٢" or just "123" → the receipt letter (if any) and its number. */
export function parseReceiptQuery(q: string): { prefix?: string; number: number } | null {
    const m = /^([ء-ي])?\s*-?\s*(\d{1,9})$/.exec(normalizeDigits(q).trim());
    if (!m) return null;
    const number = Number(m[2]);
    if (!number) return null;
    return m[1] ? { prefix: m[1], number } : { number };
}

/** The last searches, newest first, no repeats, at most `max`. */
export function pushRecent(list: string[], q: string, max = 5): string[] {
    const s = q.trim();
    if (!s) return list;
    return [s, ...list.filter((x) => x !== s)].slice(0, max);
}

/** صباح الخير before noon in Baghdad, مساء الخير after. */
export function greeting(now: Date = new Date()): string {
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(now));
    return hour < 12 ? "صباح الخير" : "مساء الخير";
}
