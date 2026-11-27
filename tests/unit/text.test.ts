import { describe, expect, it } from "vitest";
import { arabicIncludes, normalizeArabic } from "@/lib/text";

describe("normalizeArabic", () => {
    it("folds the letters people type interchangeably", () => {
        expect(normalizeArabic("  أحمد  كاظم ")).toBe("احمد كاظم");
        expect(normalizeArabic("إبراهيم")).toBe("ابراهيم");
        expect(normalizeArabic("شركة البصرة")).toBe("شركه البصره");
        expect(normalizeArabic("مصطفى")).toBe("مصطفي");
        expect(normalizeArabic("مُحَمَّد")).toBe("محمد");
        expect(normalizeArabic("MSC ١٢")).toBe("msc 12");
    });

    it("matches part of a name either way it is spelled", () => {
        expect(arabicIncludes("أحمد كاظم", "احمد")).toBe(true);
        expect(arabicIncludes("شركة التخليص - الصين", "شركه")).toBe(true);
        expect(arabicIncludes("حيدر", "علي")).toBe(false);
        expect(arabicIncludes("حيدر", "")).toBe(true);
    });
});
