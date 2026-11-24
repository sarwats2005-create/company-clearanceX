import { describe, expect, it } from "vitest";
import { hasValidCheckDigit, isIso6346, normalizeContainerNumber } from "@/lib/container-number";

describe("normalizeContainerNumber", () => {
    it("trims, uppercases and strips spaces and dashes", () => {
        expect(normalizeContainerNumber(" mscu 482917-5 ")).toBe("MSCU4829175");
    });
    it("converts Arabic-Indic digits", () => {
        expect(normalizeContainerNumber("mscu ٤٨٢٩١٧٥")).toBe("MSCU4829175");
    });
});

describe("isIso6346", () => {
    it("accepts 4 letters + 7 digits", () => {
        expect(isIso6346("MSCU4829175")).toBe(true);
    });
    it("rejects other shapes", () => {
        expect(isIso6346("MSC4829175")).toBe(false);
        expect(isIso6346("MSCU482917")).toBe(false);
        expect(isIso6346("")).toBe(false);
    });
});

describe("hasValidCheckDigit", () => {
    it("validates the ISO 6346 check digit", () => {
        expect(hasValidCheckDigit("CSQU3054383")).toBe(true);
        expect(hasValidCheckDigit("CSQU3054384")).toBe(false);
    });
});
