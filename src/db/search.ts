import { type SQL, sql } from "drizzle-orm";
import { normalizeDigits } from "@/lib/money";
import { normalizeArabic } from "@/lib/text";

/** Arabic-forgiving lower-case text for search (same letters folded as normalizeArabic). */
export const folded = (col: SQL | unknown) => sql`translate(lower(coalesce(${col}, '')), 'أإآٱةىؤئ', 'ااااهيوي')`;

/** "%q%" for LIKE against folded(): typed text folded the same way, wildcards escaped. Empty when nothing to search. */
export function likePattern(q: string | undefined): string {
    const s = q
        ? normalizeArabic(q)
              .trim()
              .replace(/[\\%_]/g, (c) => `\\${c}`)
        : "";
    return s ? `%${s}%` : "";
}

/** A code or phone without its separators, upper-cased: B/L "cosu-6012 3456" → "COSU60123456", "0780 111-2233" → "07801112233". */
export const compact = (col: SQL | unknown) => sql`regexp_replace(upper(coalesce(${col}, '')), '[[:space:]_./()+-]', '', 'g')`;

/** "%Q%" for LIKE against compact(): the typed text without separators, only when it is a code or a number. Empty otherwise. */
export function compactPattern(q: string | undefined): string {
    const s = q
        ? normalizeDigits(q)
              .toUpperCase()
              .replace(/[\s\u00a0\u200e\u200f_./()+-]/g, "")
        : "";
    return /^[A-Z0-9]{2,}$/.test(s) ? `%${s}%` : "";
}
