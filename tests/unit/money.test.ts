import { describe, expect, it } from "vitest";
import { addMoney, compareMoney, isPositive, negate, normalizeDigits, parseAmount, roundTo, subMoney } from "@/lib/money";

describe("normalizeDigits", () => {
    it("turns Arabic-Indic and Persian digits into Latin", () => {
        expect(normalizeDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
        expect(normalizeDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
    });
});

describe("parseAmount", () => {
    it("accepts Arabic-Indic digits with an Arabic thousands separator", () => {
        expect(parseAmount("٢٬٤٠٠", "USD")).toBe("2400.00");
    });
    it("accepts Latin digits with commas for IQD (whole dinars)", () => {
        expect(parseAmount("2,400", "IQD")).toBe("2400");
    });
    it("rejects text", () => {
        expect(parseAmount("abc", "USD")).toBeNull();
    });
    it("rejects negative amounts", () => {
        expect(parseAmount("-5", "USD")).toBeNull();
    });
    it("rejects empty input", () => {
        expect(parseAmount("   ", "USD")).toBeNull();
    });
    it("accepts the Arabic decimal separator", () => {
        expect(parseAmount("١٢٫٥", "USD")).toBe("12.50");
    });
    it("accepts spaces and a typed currency symbol", () => {
        expect(parseAmount(" 1 250 $ ", "USD")).toBe("1250.00");
    });
    it("rejects two decimal points", () => {
        expect(parseAmount("1.2.3", "USD")).toBeNull();
    });
    it("rounds USD to cents and IQD to whole dinars (half up)", () => {
        expect(parseAmount("1.005", "USD")).toBe("1.01");
        expect(parseAmount("2400.5", "IQD")).toBe("2401");
    });
    it("rejects amounts too large for the database", () => {
        expect(parseAmount("10000000000000000", "IQD")).toBeNull();
    });
});

describe("roundTo", () => {
    it("rounds per currency", () => {
        expect(roundTo("54736.84", "IQD")).toBe("54737");
        expect(roundTo("842.105", "USD")).toBe("842.11");
        expect(roundTo("7", "USD")).toBe("7.00");
    });
});

describe("decimal helpers", () => {
    it("adds and subtracts without floating point error", () => {
        expect(addMoney("0.1", "0.2")).toBe("0.3");
        expect(subMoney("2400", "2400.00")).toBe("0");
        expect(negate("5.5")).toBe("-5.5");
    });
    it("compares and checks sign", () => {
        expect(compareMoney("10", "9.99")).toBe(1);
        expect(compareMoney("1.0", "1")).toBe(0);
        expect(isPositive("0.00")).toBe(false);
        expect(isPositive("0.01")).toBe(true);
    });
});
