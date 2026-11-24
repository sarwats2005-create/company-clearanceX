/** Forgiving text matching for Arabic names: أ/إ/آ → ا, ة → ه, ى → ي, no tashkeel, Latin digits, lower case. */
import { normalizeDigits } from "@/lib/money";

export function normalizeArabic(input: string): string {
    return normalizeDigits(input)
        .normalize("NFKC")
        .replace(/[ً-ٰٟـ]/g, "")
        .replace(/[أإآٱ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي")
        .replace(/ؤ/g, "و")
        .replace(/ئ/g, "ي")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

export function arabicIncludes(text: string, query: string): boolean {
    const q = normalizeArabic(query);
    return !q || normalizeArabic(text).includes(q);
}
