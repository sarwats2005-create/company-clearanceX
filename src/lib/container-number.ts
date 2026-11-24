/** Container numbers (PRD §5.2): the unique key of a container. */
import { normalizeDigits } from "@/lib/money";

/** " mscu 482917-5 " → "MSCU4829175": trim, Latin digits, uppercase, no spaces or dashes. */
export function normalizeContainerNumber(input: string): string {
    return normalizeDigits(input)
        .toUpperCase()
        .replace(/[\s\-_.\/ ‎‏]/g, "");
}

/** The usual shape: 4 letters + 7 digits (a soft warning only when it doesn't match). */
export function isIso6346(value: string): boolean {
    return /^[A-Z]{4}\d{7}$/.test(value);
}

/** ISO 6346 check digit (the 11th character). Letters skip multiples of 11. */
export function hasValidCheckDigit(value: string): boolean {
    if (!isIso6346(value)) return false;
    const letterValue = (ch: string) => {
        let v = 10;
        for (let c = 65; c < ch.charCodeAt(0); c++) {
            v++;
            if (v % 11 === 0) v++;
        }
        return v;
    };
    let sum = 0;
    for (let i = 0; i < 10; i++) {
        const ch = value[i];
        const v = i < 4 ? letterValue(ch) : Number(ch);
        sum += v * 2 ** i;
    }
    return (sum % 11) % 10 === Number(value[10]);
}
