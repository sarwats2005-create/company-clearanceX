/** Text size setting (PRD §10.4): stored per device in a cookie, applied as data-text-size on <html>. */
export const TEXT_SIZE_COOKIE = "cc_text_size";
export type TextSize = "sm" | "md" | "lg";
export const TEXT_SIZES: readonly TextSize[] = ["sm", "md", "lg"];

/** md (112.5%) is the default. */
export function parseTextSize(value: string | undefined): TextSize {
    return value === "sm" || value === "lg" ? value : "md";
}
