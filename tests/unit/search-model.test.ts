import { describe, expect, it } from "vitest";
import { greeting, parseReceiptQuery, pushRecent } from "@/features/search/model";

describe("parseReceiptQuery (PRD §8.2: ق-123 or just 123)", () => {
    it("reads a number with or without the letter, in any digits", () => {
        expect(parseReceiptQuery("ق-123")).toEqual({ prefix: "ق", number: 123 });
        expect(parseReceiptQuery("ص 000045")).toEqual({ prefix: "ص", number: 45 });
        expect(parseReceiptQuery("ع١٢")).toEqual({ prefix: "ع", number: 12 });
        expect(parseReceiptQuery(" 123 ")).toEqual({ number: 123 });
    });

    it("ignores text that is not a receipt number", () => {
        expect(parseReceiptQuery("ق")).toBeNull();
        expect(parseReceiptQuery("MSCU4829")).toBeNull();
        expect(parseReceiptQuery("احمد")).toBeNull();
        expect(parseReceiptQuery("0")).toBeNull();
    });
});

describe("pushRecent (last 5 searches)", () => {
    it("puts the newest first, drops repeats and keeps five", () => {
        expect(pushRecent(["a", "b"], "c")).toEqual(["c", "a", "b"]);
        expect(pushRecent(["a", "b", "c"], " b ")).toEqual(["b", "a", "c"]);
        expect(pushRecent(["1", "2", "3", "4", "5"], "6")).toEqual(["6", "1", "2", "3", "4"]);
        expect(pushRecent(["a"], "  ")).toEqual(["a"]);
    });
});

describe("greeting (by the time in Baghdad)", () => {
    it("says good morning before noon and good evening after", () => {
        expect(greeting(new Date("2026-11-24T05:00:00Z"))).toBe("صباح الخير"); // 08:00 Baghdad
        expect(greeting(new Date("2026-11-24T08:59:00Z"))).toBe("صباح الخير"); // 11:59
        expect(greeting(new Date("2026-11-24T09:00:00Z"))).toBe("مساء الخير"); // 12:00
        expect(greeting(new Date("2026-11-24T22:30:00Z"))).toBe("صباح الخير"); // 01:30 next day
    });
});
