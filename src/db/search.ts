import { type SQL, sql } from "drizzle-orm";
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
