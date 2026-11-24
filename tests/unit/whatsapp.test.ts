import { describe, expect, it } from "vitest";
import { receiptShareText, whatsappUrl } from "@/lib/whatsapp";

describe("whatsappUrl (PRD §6.5)", () => {
    it("opens a chat with an Iraqi number in international form", () => {
        expect(whatsappUrl("0770 123 4567", "مرحبا")).toBe("https://wa.me/9647701234567?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7");
        expect(whatsappUrl("+964 770 123 4567", "x")).toBe("https://wa.me/9647701234567?text=x");
        expect(whatsappUrl("٠٧٧٠١٢٣٤٥٦٧", "x")).toBe("https://wa.me/9647701234567?text=x");
    });

    it("lets the owner pick the chat when there is no usable number", () => {
        expect(whatsappUrl(null, "x")).toBe("https://wa.me/?text=x");
        expect(whatsappUrl("12", "x")).toBe("https://wa.me/?text=x");
    });
});

describe("receiptShareText", () => {
    it("summarises the receipt in plain lines", () => {
        expect(
            receiptShareText({
                company: "سرور البصرة",
                title: "وصل قبض",
                receiptNo: "ق-000001",
                date: "2026-11-22",
                lines: [
                    ["استلمنا من", "التاجر أحمد كاظم"],
                    ["إلى قاصة", "قاصة الدولار"],
                ],
                amount: "2400.00",
                currency: "USD",
                words: "ألفان وأربعمائة دولار أمريكي لا غير",
                cancelled: false,
            }),
        ).toBe(
            [
                "سرور البصرة",
                "وصل قبض ق-000001",
                "التاريخ: 22/11/2026",
                "استلمنا من: التاجر أحمد كاظم",
                "إلى قاصة: قاصة الدولار",
                "المبلغ: 2,400 $",
                "فقط: ألفان وأربعمائة دولار أمريكي لا غير",
            ].join("\n"),
        );
    });

    it("says when the receipt is cancelled", () => {
        const text = receiptShareText({
            company: "س",
            title: "وصل صرف",
            receiptNo: "ص-000002",
            date: "2026-11-22",
            lines: [],
            amount: "10",
            currency: "IQD",
            words: "عشرة دنانير عراقية لا غير",
            cancelled: true,
        });
        expect(text.split("\n")[1]).toBe("وصل صرف ص-000002 (ملغى)");
    });
});
