import { describe, expect, it } from "vitest";
import {
    debtWeight,
    defaultCurrency,
    parseStatementParams,
    rangeText,
    statementQuery,
    statementRange,
    statementShareText,
    vaultSubtitle,
} from "@/features/accounts/model";

const TODAY = "2026-11-24";

describe("statementRange presets (PRD §8.8)", () => {
    it("this month runs from the 1st to today", () => {
        expect(statementRange("this_month", TODAY)).toEqual({ from: "2026-11-01", to: "2026-11-24" });
    });

    it("last month is the whole previous month, across the new year and leap years", () => {
        expect(statementRange("last_month", TODAY)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
        expect(statementRange("last_month", "2026-01-05")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
        expect(statementRange("last_month", "2026-03-31")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
        expect(statementRange("last_month", "2028-03-01")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    });

    it("this year starts on 1 January; all has no limits", () => {
        expect(statementRange("this_year", TODAY)).toEqual({ from: "2026-01-01", to: "2026-11-24" });
        expect(statementRange("all", TODAY)).toEqual({});
    });
});

describe("parseStatementParams / statementQuery", () => {
    it("defaults to every movement and no chosen currency", () => {
        expect(parseStatementParams({}, TODAY)).toEqual({ preset: "all", currency: undefined, from: undefined, to: undefined });
    });

    it("resolves a preset to dates and reads the currency", () => {
        expect(parseStatementParams({ currency: "USD", range: "last_month" }, TODAY)).toEqual({
            preset: "last_month",
            currency: "USD",
            from: "2026-10-01",
            to: "2026-10-31",
        });
    });

    it("treats typed dates as a custom range, swapping them when reversed", () => {
        expect(parseStatementParams({ from: "2026-11-01", to: "2026-11-10" }, TODAY)).toMatchObject({ preset: "custom", from: "2026-11-01", to: "2026-11-10" });
        expect(parseStatementParams({ from: "2026-11-10", to: "2026-11-01" }, TODAY)).toMatchObject({ from: "2026-11-01", to: "2026-11-10" });
        expect(parseStatementParams({ to: "2026-11-10" }, TODAY)).toMatchObject({ preset: "custom", from: undefined, to: "2026-11-10" });
    });

    it("ignores junk values", () => {
        expect(parseStatementParams({ currency: "EUR", range: "forever", from: "2026-13-45", to: ["x"] }, TODAY)).toEqual({
            preset: "all",
            currency: undefined,
            from: undefined,
            to: undefined,
        });
    });

    it("writes back only what is needed", () => {
        const p = parseStatementParams({ currency: "IQD", range: "this_month" }, TODAY);
        expect(statementQuery(p, {})).toBe("?currency=IQD&range=this_month");
        expect(statementQuery(p, { preset: "all" })).toBe("?currency=IQD");
        expect(statementQuery(p, { preset: "custom", from: "2026-11-02", to: "2026-11-09" })).toBe("?currency=IQD&from=2026-11-02&to=2026-11-09");
        expect(statementQuery(p, { currency: "USD" })).toBe("?currency=USD&range=this_month");
    });
});

describe("rangeText", () => {
    it("says the period in the owner's words", () => {
        expect(rangeText("2026-11-01", "2026-11-24")).toBe("من 01/11/2026 إلى 24/11/2026");
        expect(rangeText(undefined, "2026-11-24")).toBe("حتى 24/11/2026");
        expect(rangeText("2026-11-01", undefined)).toBe("من 01/11/2026");
        expect(rangeText(undefined, undefined)).toBe("كل الحركات");
    });
});

describe("statementShareText (WhatsApp summary: name, range, closing balances)", () => {
    it("lists the closing balance per currency in عليه/له words", () => {
        expect(
            statementShareText({
                company: "شركة النخبة",
                title: "كشف حساب التاجر أحمد كاظم",
                from: "2026-11-01",
                to: "2026-11-24",
                balances: { USD: "2400.00", IQD: "-50000" },
            }),
        ).toBe(["شركة النخبة", "كشف حساب التاجر أحمد كاظم", "الفترة: من 01/11/2026 إلى 24/11/2026", "الرصيد: عليه 2,400 $ · له 50,000 د.ع"].join("\n"));
    });

    it("says مسدد when nothing is left", () => {
        expect(statementShareText({ company: "ش", title: "كشف", balances: { USD: "0.00", IQD: "0" } })).toBe(
            ["ش", "كشف", "الفترة: كل الحركات", "الرصيد: مسدد"].join("\n"),
        );
    });
});

describe("debtWeight (sorting by largest debt)", () => {
    it("adds both currencies in dinars at the rate", () => {
        expect(debtWeight({ USD: "100.00", IQD: "50000" }, "1310")).toBe(181000);
        expect(debtWeight({ USD: "-10.00", IQD: "0" }, "1310")).toBe(-13100);
    });
});

describe("defaultCurrency (which statement opens first)", () => {
    const zero = { USD: "0.00", IQD: "0" };
    it("keeps a chosen currency the account accepts", () => {
        expect(defaultCurrency(["USD", "IQD"], { USD: "10.00", IQD: "0" }, "IQD")).toBe("IQD");
        expect(defaultCurrency(["IQD"], zero, "USD")).toBe("IQD");
    });
    it("otherwise opens the first currency that holds a balance, then the first accepted", () => {
        expect(defaultCurrency(["USD", "IQD"], { USD: "0.00", IQD: "-5000" })).toBe("IQD");
        expect(defaultCurrency(["USD", "IQD"], { USD: "12.00", IQD: "5000" })).toBe("USD");
        expect(defaultCurrency(["IQD", "USD"], zero)).toBe("IQD");
    });
});

describe("vaultSubtitle", () => {
    it("names the kind and currencies, without repeating a built-in vault's name", () => {
        expect(vaultSubtitle({ kind: "exchange_shop", allowedCurrencies: ["IQD", "USD"] })).toBe("محل صيرفة · دينار عراقي ودولار أمريكي");
        expect(vaultSubtitle({ kind: "main", allowedCurrencies: ["IQD"] })).toBe("دينار عراقي");
    });
});
