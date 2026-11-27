import { describe, expect, it } from "vitest";
import { balanceSide, containersText, daysText, formatDate, formatDateLong, formatMoney, formatNumber, iraqiMonth, todayISO, tradersText } from "@/lib/format";

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
    it("formats negatives with a leading minus that stays left of the digits in Arabic text", () => {
        // A left-to-right mark keeps the minus attached to the number inside a right-to-left line.
        expect(formatMoney("-130000", "IQD")).toBe("\u200E-130,000 د.ع");
        expect(formatMoney("-0.001", "USD")).toBe("0 $");
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

describe("daysText", () => {
    it("counts days the way Arabic does", () => {
        expect(daysText(0)).toBe("اليوم");
        expect(daysText(1)).toBe("يوم واحد");
        expect(daysText(2)).toBe("يومان");
        expect(daysText(3)).toBe("3 أيام");
        expect(daysText(10)).toBe("10 أيام");
        expect(daysText(11)).toBe("11 يوماً");
        expect(daysText(100)).toBe("100 يوم");
        expect(daysText(103)).toBe("103 أيام");
    });
});

describe("tradersText", () => {
    it("counts traders the way Arabic does", () => {
        expect(tradersText(1)).toBe("تاجر واحد");
        expect(tradersText(2)).toBe("تاجران");
        expect(tradersText(3)).toBe("3 تجار");
        expect(tradersText(10)).toBe("10 تجار");
        expect(tradersText(11)).toBe("11 تاجراً");
        expect(tradersText(99)).toBe("99 تاجراً");
        expect(tradersText(100)).toBe("100 تاجر");
        expect(tradersText(103)).toBe("103 تجار");
    });
});

describe("containersText", () => {
    it("counts containers the way Arabic does", () => {
        expect(containersText(0)).toBe("0 حاوية");
        expect(containersText(1)).toBe("حاوية واحدة");
        expect(containersText(2)).toBe("حاويتان");
        expect(containersText(7)).toBe("7 حاويات");
        expect(containersText(25)).toBe("25 حاوية");
        expect(containersText(1200)).toBe("1,200 حاوية");
    });
});

describe("balanceSide", () => {
    it("reads a debit − credit balance as عليه / له / مسدد", () => {
        expect(balanceSide("2400.00", "USD")).toBe("owesUs");
        expect(balanceSide("-100", "IQD")).toBe("weOwe");
        expect(balanceSide("0.00", "USD")).toBe("settled");
        expect(balanceSide("0.004", "USD")).toBe("settled");
        expect(balanceSide("0.4", "IQD")).toBe("settled");
    });
});
