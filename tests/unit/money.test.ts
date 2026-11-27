import { describe, expect, it } from "vitest";
import { typedNumber } from "@/components/app/container-form/shares-editor";
import { shareSchema } from "@/features/containers/schemas";
import { addMoney, compareMoney, isPositive, negate, normalizeDigits, parseAmount, parseTypedDecimal, roundTo, subMoney } from "@/lib/money";

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

describe("parseTypedDecimal", () => {
    it("reads a lone comma as the decimal point", () => {
        expect(parseTypedDecimal("4,5")).toBe("4.5");
    });
    it("reads the Arabic decimal mark with Arabic-Indic digits", () => {
        expect(parseTypedDecimal("٤٫٥")).toBe("4.5");
    });
    it("reads comma groups of three as thousands", () => {
        expect(parseTypedDecimal("1,250")).toBe("1250");
        expect(parseTypedDecimal("12,500,000")).toBe("12500000");
    });
    it("reads commas as thousands when a point is present", () => {
        expect(parseTypedDecimal("1,250.5")).toBe("1250.5");
        expect(parseTypedDecimal("٢٬٤٠٠٫٥")).toBe("2400.5");
    });
    it("rejects text, blanks and two decimal marks", () => {
        expect(parseTypedDecimal("abc")).toBeNull();
        expect(parseTypedDecimal("")).toBeNull();
        expect(parseTypedDecimal("1,2,3")).toBeNull();
        expect(parseTypedDecimal("1.2.3")).toBeNull();
    });
});

describe("shareSchema", () => {
    it("stores a share typed as 4,5 as 4.5 (same as the live preview)", () => {
        const r = shareSchema.parse({ traderId: "00000000-0000-4000-8000-000000000000", shareValue: "4,5" });
        expect(r.shareValue).toBe("4.5");
        expect(typedNumber("4,5")).toBe(r.shareValue);
    });
});
