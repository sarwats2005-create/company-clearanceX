import { describe, expect, it } from "vitest";
import { formatDate, formatDateLong, formatMoney, formatNumber, iraqiMonth, todayISO } from "@/lib/format";

describe("formatMoney", () => {
    it("formats IQD with separators, no decimals, symbol after", () => {
        expect(formatMoney("3144000", "IQD")).toBe("3,144,000 د.ع");
    });
    it("hides .00 for USD", () => {
        expect(formatMoney("2400.00", "USD")).toBe("2,400 $");
    });
    it("shows cents for USD when present", () => {
        expect(formatMoney("2400.5", "USD")).toBe("2,400.50 $");
    });
    it("can leave out the symbol", () => {
        expect(formatMoney("1157.89", "USD", { symbol: false })).toBe("1,157.89");
    });
    it("formats negatives with a leading minus", () => {
        expect(formatMoney("-130000", "IQD")).toBe("-130,000 د.ع");
    });
});

describe("formatNumber", () => {
    it("keeps up to 3 decimals and drops trailing zeros", () => {
        expect(formatNumber("9.500")).toBe("9.5");
        expect(formatNumber("12000")).toBe("12,000");
    });
});

describe("dates", () => {
    it("formats yyyy-mm-dd strings as dd/MM/yyyy", () => {
        expect(formatDate("2026-11-24")).toBe("24/11/2026");
    });
    it("formats a Date in Baghdad time", () => {
        // 23:30 UTC on 23 Nov is 02:30 on 24 Nov in Baghdad (UTC+3)
        expect(formatDate(new Date("2026-11-23T23:30:00Z"))).toBe("24/11/2026");
    });
    it("uses Iraqi month names", () => {
        expect(iraqiMonth(1)).toBe("كانون الثاني");
        expect(iraqiMonth(11)).toBe("تشرين الثاني");
        expect(iraqiMonth(12)).toBe("كانون الأول");
    });
    it("writes long dates with Latin digits and the Iraqi month", () => {
        expect(formatDateLong("2026-11-24")).toBe("24 تشرين الثاني 2026");
        expect(formatDateLong("2026-11-24", { weekday: true })).toBe("الثلاثاء 24 تشرين الثاني 2026");
    });
    it("gives today's date in Baghdad as yyyy-mm-dd", () => {
        expect(todayISO(new Date("2026-11-23T22:00:00Z"))).toBe("2026-11-24");
    });
});
