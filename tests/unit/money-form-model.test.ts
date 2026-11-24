import { describe, expect, it } from "vitest";
import {
    KIND_BY_SLUG,
    SLUG_BY_KIND,
    emptyForm,
    fullAmount,
    onAmountChange,
    onDebtChange,
    onRateChange,
    toMoneyInput,
    validateForm,
} from "@/features/money/form-model";

const opts = {
    traders: [{ id: "t1", name: "أحمد كاظم", phone: null, balance: { IQD: "0", USD: "2400.00" } }],
    parties: [{ id: "p1", name: "شركة التخليص - الصين", balance: { IQD: "-50000", USD: "-3000.00" } }],
    vaults: [
        { id: "v-main", name: "القاصة الرئيسية", kind: "main" as const, allowedCurrencies: ["IQD" as const], balance: { IQD: "1000000", USD: "0.00" } },
        { id: "v-usd", name: "قاصة الدولار", kind: "usd" as const, allowedCurrencies: ["USD" as const], balance: { IQD: "0", USD: "500.00" } },
    ],
    categories: [{ id: "c1", name: "إيجار" }],
    defaultVaults: { IQD: "v-main", USD: "v-usd" },
    defaultRate: "1310",
};

describe("slugs", () => {
    it("maps every URL slug to a money action and back", () => {
        expect(KIND_BY_SLUG["receive-trader"]).toBe("receive_trader");
        expect(KIND_BY_SLUG.expense).toBe("expense");
        expect(Object.keys(KIND_BY_SLUG)).toHaveLength(9);
        for (const [slug, kind] of Object.entries(KIND_BY_SLUG)) expect(SLUG_BY_KIND[kind]).toBe(slug);
    });
});

describe("emptyForm", () => {
    it("fills today, the default vault and the default rate", () => {
        const f = emptyForm("receive_trader", opts, "2026-11-24", {});
        expect(f).toMatchObject({ date: "2026-11-24", currency: "IQD", vaultId: "v-main", rate: "1310", fxOn: false });
        expect(emptyForm("pay_party", opts, "2026-11-24", { currency: "USD", party: "p1" })).toMatchObject({
            currency: "USD",
            vaultId: "v-usd",
            partyId: "p1",
        });
        expect(emptyForm("exchange", opts, "2026-11-24", {})).toMatchObject({ currency: "IQD", fromVaultId: "v-main", toVaultId: "v-usd" });
    });
});

describe("cross-currency fields stay in step (PRD §6.3 A4x)", () => {
    it("recomputes the debt from the amount and the rate, and the rate from both amounts", () => {
        let f = { ...emptyForm("receive_trader", opts, "2026-11-24", {}), fxOn: true };
        f = onAmountChange(f, "3,144,000");
        expect(f.debtAmount).toBe("2400.00");
        f = onRateChange(f, "1300");
        expect(f.debtAmount).toBe("2418.46");
        f = onDebtChange(f, "2400");
        expect(f.rate).toBe("1310");
        expect(onRateChange(f, "١٣١٠").debtAmount).toBe("2400.00");
        expect(onRateChange(f, "abc").debtAmount).toBe("");
        expect(validateForm("receive_trader", { ...onRateChange(f, "0"), traderId: "t1" })).toEqual({ rate: "اكتب سعر الصرف", "fx.debtAmount": "اكتب المبلغ" });
    });
});

describe("fullAmount", () => {
    it("fills what the trader owes, or what we owe the party, in the right currency", () => {
        const f = emptyForm("receive_trader", opts, "2026-11-24", { trader: "t1", currency: "USD" });
        expect(fullAmount("receive_trader", f, opts)).toEqual({ amount: "2400" });
        const fx = { ...emptyForm("receive_trader", opts, "2026-11-24", { trader: "t1" }), fxOn: true };
        expect(fullAmount("receive_trader", fx, opts)).toEqual({ amount: "3144000", debtAmount: "2400" });
        const p = emptyForm("pay_party", opts, "2026-11-24", { party: "p1", currency: "USD" });
        expect(fullAmount("pay_party", p, opts)).toEqual({ amount: "3000" });
        expect(fullAmount("pay_party", { ...p, partyId: null }, opts)).toBeNull();
    });
});

describe("validateForm", () => {
    it("names each missing field before the server is asked", () => {
        expect(validateForm("receive_trader", emptyForm("receive_trader", opts, "2026-11-24", {}))).toEqual({ traderId: "اختر التاجر", amount: "اكتب المبلغ" });
        const tr = { ...emptyForm("transfer", opts, "2026-11-24", {}), amount: "10", toVaultId: "v-main" };
        expect(validateForm("transfer", tr)).toEqual({ toVaultId: "اختر قاصة غير القاصة التي يخرج منها المبلغ" });
        expect(validateForm("expense", { ...emptyForm("expense", opts, "2026-11-24", {}), amount: "5" })).toEqual({ categoryId: "اختر التصنيف" });
    });
});

describe("toMoneyInput", () => {
    it("sends only what the action needs", () => {
        const f = { ...emptyForm("receive_trader", opts, "2026-11-24", { trader: "t1" }), amount: "3,144,000", fxOn: true, debtAmount: "2400", note: "  " };
        expect(toMoneyInput("receive_trader", f, false)).toEqual({
            kind: "receive_trader",
            date: "2026-11-24",
            traderId: "t1",
            vaultId: "v-main",
            amount: "3,144,000",
            currency: "IQD",
            fx: { debtCurrency: "USD", debtAmount: "2400" },
            note: null,
            allowNegative: false,
        });
        const ex = { ...emptyForm("exchange", opts, "2026-11-24", {}), amount: "655000", toAmount: "500" };
        expect(toMoneyInput("exchange", ex, true)).toEqual({
            kind: "exchange",
            date: "2026-11-24",
            fromVaultId: "v-main",
            fromCurrency: "IQD",
            fromAmount: "655000",
            toVaultId: "v-usd",
            toAmount: "500",
            note: null,
            allowNegative: true,
        });
    });
});
