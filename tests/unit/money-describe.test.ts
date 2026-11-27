import { describe, expect, it } from "vitest";
import { convertAtRate, entryFlow, moneySentence, rateOf, receiptLines, receiptTitle } from "@/features/money/describe";

describe("rateOf and convertAtRate (PRD §6.3 A4x)", () => {
    it("states the rate as dinars per dollar whichever side was paid", () => {
        expect(rateOf({ amount: "3144000", currency: "IQD" }, { amount: "2400", currency: "USD" })).toBe("1310.0000");
        expect(rateOf({ amount: "500", currency: "USD" }, { amount: "655000", currency: "IQD" })).toBe("1310.0000");
        expect(rateOf({ amount: "1000", currency: "USD" }, { amount: "0", currency: "IQD" })).toBeNull();
    });

    it("converts and rounds for the target currency", () => {
        expect(convertAtRate("2400", "USD", "1310")).toBe("3144000");
        expect(convertAtRate("1000000", "IQD", "1310")).toBe("763.36");
        expect(convertAtRate("1000000", "IQD", "")).toBeNull();
    });
});

describe("moneySentence (the confirmation, PRD §8.7)", () => {
    it("reads the PRD example for a dinar payment against a dollar debt", () => {
        expect(
            moneySentence("receive_trader", {
                amount: "3144000",
                currency: "IQD",
                traderName: "أحمد كاظم",
                vaultName: "القاصة الرئيسية",
                fx: { debtCurrency: "USD", debtAmount: "2400" },
                rate: "1310.0000",
            }),
        ).toBe("سيتم استلام 3,144,000 د.ع من التاجر أحمد كاظم إلى القاصة الرئيسية مقابل 2,400 $ بسعر صرف 1,310");
    });

    it("has one sentence per action", () => {
        expect(moneySentence("pay_trader", { amount: "100", currency: "USD", traderName: "حيدر", vaultName: "قاصة الدولار", payReason: "advance" })).toBe(
            "سيتم دفع 100 $ للتاجر حيدر من قاصة الدولار (سلفة)",
        );
        expect(moneySentence("transfer", { amount: "1000000", currency: "IQD", fromVaultName: "القاصة الرئيسية", toVaultName: "صيرفة الأمين" })).toBe(
            "سيتم تحويل 1,000,000 د.ع من القاصة الرئيسية إلى صيرفة الأمين",
        );
        expect(
            moneySentence("exchange", {
                amount: "655000",
                currency: "IQD",
                fromVaultName: "صيرفة الأمين",
                toVaultName: "قاصة الدولار",
                exchange: { toAmount: "500", toCurrency: "USD" },
                rate: "1310.0000",
            }),
        ).toBe("سيتم تصريف 655,000 د.ع من صيرفة الأمين إلى 500 $ في قاصة الدولار بسعر صرف 1,310");
        expect(moneySentence("expense", { amount: "500000", currency: "IQD", vaultName: "القاصة الرئيسية", categoryName: "إيجار", payee: "صاحب المكتب" })).toBe(
            "سيتم صرف 500,000 د.ع من القاصة الرئيسية على إيجار · المستفيد صاحب المكتب",
        );
        expect(moneySentence("deposit", { amount: "5000", currency: "USD", vaultName: "قاصة الدولار" })).toBe("سيتم إيداع 5,000 $ في قاصة الدولار");
        expect(moneySentence("withdraw", { amount: "5000", currency: "USD", vaultName: "قاصة الدولار" })).toBe("سيتم سحب 5,000 $ من قاصة الدولار");
    });
});

describe("receipt title and lines (PRD §6.5)", () => {
    it("titles each receipt kind and marks a cancellation", () => {
        expect(receiptTitle("in", false)).toBe("وصل قبض");
        expect(receiptTitle("out", false)).toBe("وصل صرف");
        expect(receiptTitle("transfer", false)).toBe("وصل تحويل");
        expect(receiptTitle("exchange", false)).toBe("وصل تصريف عملة");
        expect(receiptTitle("in", true)).toBe("إلغاء وصل قبض");
    });

    it("lists who, which vault, the rate and the note", () => {
        expect(receiptLines("pay_trader", { traderName: "حيدر", vaultName: "قاصة الدولار", payReason: "refund", note: "تسوية" }, null)).toEqual([
            ["دفعنا إلى", "التاجر حيدر"],
            ["من قاصة", "قاصة الدولار"],
            ["السبب", "إرجاع"],
            ["ملاحظة", "تسوية"],
        ]);
        expect(
            receiptLines(
                "exchange",
                { fromVaultName: "صيرفة الأمين", toVaultName: "قاصة الدولار", exchange: { toAmount: "500", toCurrency: "USD" } },
                "1310.0000",
            ),
        ).toEqual([
            ["من قاصة", "صيرفة الأمين"],
            ["إلى قاصة", "قاصة الدولار"],
            ["المبلغ المستلم", "500 $"],
            ["سعر الصرف", "1,310"],
        ]);
        expect(
            receiptLines(
                "receive_from_trader",
                { traderName: "أحمد كاظم", vaultName: "القاصة الرئيسية", fx: { debtCurrency: "USD", debtAmount: "2400" } },
                "1310.0000",
            ),
        ).toEqual([
            ["استلمنا من", "التاجر أحمد كاظم"],
            ["إلى قاصة", "القاصة الرئيسية"],
            ["مقابل دين", "2,400 $"],
            ["سعر الصرف", "1,310"],
        ]);
        expect(
            receiptLines(
                "container_charge",
                {
                    chargeType: "كمرك بصرة",
                    containerNumber: "MSCU4829175",
                    vaultName: "قاصة الدولار",
                    traders: [
                        { name: "أحمد", amount: "842.11" },
                        { name: "حيدر", amount: "1157.89" },
                    ],
                },
                null,
            ),
        ).toEqual([
            ["دفعنا عن", "كمرك بصرة · الحاوية MSCU4829175"],
            ["من قاصة", "قاصة الدولار"],
            ["على التجار", "أحمد، حيدر"],
        ]);
    });
});

describe("entryFlow (journal from → to)", () => {
    it("names where the money came from and went to", () => {
        expect(entryFlow("receive_from_trader", { traderName: "أحمد", vaultName: "قاصة الدولار" }, null)).toEqual({ from: "التاجر أحمد", to: "قاصة الدولار" });
        expect(entryFlow("pay_party", { partyName: "شركة التخليص - الصين", vaultName: "قاصة الدولار" }, null)).toEqual({
            from: "قاصة الدولار",
            to: "شركة التخليص - الصين",
        });
        expect(entryFlow("withdraw", { vaultName: "القاصة الرئيسية" }, null)).toEqual({ from: "القاصة الرئيسية", to: "المالك" });
        expect(entryFlow("container_charge", { payer: "شركة التخليص - الصين", containerNumber: "MSCU4829175" }, null)).toEqual({
            from: "شركة التخليص - الصين",
            to: "الحاوية MSCU4829175",
        });
    });

    it("swaps the sides of a cancellation", () => {
        expect(entryFlow("reversal", { traderName: "أحمد", vaultName: "قاصة الدولار" }, "receive_from_trader")).toEqual({
            from: "قاصة الدولار",
            to: "التاجر أحمد",
        });
    });
});
