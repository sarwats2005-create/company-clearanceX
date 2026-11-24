/** Money forms input (PRD §6.3 A4–A12). Shared by the server actions and the forms. */
import { z } from "zod";
import type { Currency } from "@/db/schema";
import { ISO_DATE } from "@/features/containers/status";
import { parseAmount } from "@/lib/money";

export const MONEY_KINDS = ["receive_trader", "receive_party", "deposit", "pay_party", "pay_trader", "withdraw", "transfer", "exchange", "expense"] as const;
export type MoneyKind = (typeof MONEY_KINDS)[number];

export const PAY_REASONS = ["refund", "advance", "other"] as const;
export type PayReason = (typeof PAY_REASONS)[number];

const id = (message: string) => z.string({ error: message }).uuid(message);
const currency = z.enum(["IQD", "USD"], { error: "اختر العملة" });
const note = z
    .string()
    .trim()
    .max(500, "الملاحظة طويلة جداً")
    .nullish()
    .transform((v) => v || null);
const fx = z.object({ debtCurrency: currency, debtAmount: z.string() }).nullish();

const common = { date: z.string().regex(ISO_DATE, "اختر التاريخ"), note, allowNegative: z.boolean().optional() };
const cash = { vaultId: id("اختر القاصة"), amount: z.string(), currency };

const kinds = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("receive_trader"), ...common, ...cash, traderId: id("اختر التاجر"), fx }),
    z.object({ kind: z.literal("receive_party"), ...common, ...cash, partyId: id("اختر الجهة") }),
    z.object({ kind: z.literal("deposit"), ...common, ...cash }),
    z.object({ kind: z.literal("pay_party"), ...common, ...cash, partyId: id("اختر الجهة"), fx }),
    z.object({ kind: z.literal("pay_trader"), ...common, ...cash, traderId: id("اختر التاجر"), reason: z.enum(PAY_REASONS).default("other") }),
    z.object({ kind: z.literal("withdraw"), ...common, ...cash }),
    z.object({ kind: z.literal("transfer"), ...common, fromVaultId: id("اختر القاصة"), toVaultId: id("اختر القاصة"), amount: z.string(), currency }),
    z.object({
        kind: z.literal("exchange"),
        ...common,
        fromVaultId: id("اختر القاصة"),
        fromCurrency: currency,
        fromAmount: z.string(),
        toVaultId: id("اختر القاصة"),
        toAmount: z.string(),
    }),
    z.object({
        kind: z.literal("expense"),
        ...common,
        ...cash,
        categoryId: id("اختر التصنيف"),
        payee: z
            .string()
            .trim()
            .max(200, "الاسم طويل جداً")
            .nullish()
            .transform((v) => v || null),
    }),
]);

export const otherCurrency = (c: Currency): Currency => (c === "IQD" ? "USD" : "IQD");

/** Parses every amount for its currency and checks what one form can check on its own. */
export const moneySchema = kinds.transform((v, ctx) => {
    const money = (raw: string, cur: Currency, path: (string | number)[]) => {
        const a = parseAmount(raw, cur);
        if (a === null || Number(a) <= 0) {
            ctx.addIssue({ code: "custom", path, message: "اكتب المبلغ" });
            return "0";
        }
        return a;
    };
    switch (v.kind) {
        case "exchange":
            return {
                ...v,
                fromAmount: money(v.fromAmount, v.fromCurrency, ["fromAmount"]),
                toAmount: money(v.toAmount, otherCurrency(v.fromCurrency), ["toAmount"]),
            };
        case "transfer":
            if (v.fromVaultId === v.toVaultId) ctx.addIssue({ code: "custom", path: ["toVaultId"], message: "اختر قاصة غير القاصة التي يخرج منها المبلغ" });
            return { ...v, amount: money(v.amount, v.currency, ["amount"]) };
        case "receive_trader":
        case "pay_party": {
            const amount = money(v.amount, v.currency, ["amount"]);
            if (!v.fx) return { ...v, amount, fx: null };
            if (v.fx.debtCurrency === v.currency) {
                ctx.addIssue({ code: "custom", path: ["fx", "debtCurrency"], message: "عملة الدين يجب أن تختلف عن عملة الدفع" });
                return { ...v, amount, fx: null };
            }
            return { ...v, amount, fx: { debtCurrency: v.fx.debtCurrency, debtAmount: money(v.fx.debtAmount, v.fx.debtCurrency, ["fx", "debtAmount"]) } };
        }
        default:
            return { ...v, amount: money(v.amount, v.currency, ["amount"]) };
    }
});

/** What a form sends (amounts as typed). */
export type MoneyInput = z.input<typeof moneySchema>;
/** After parsing (amounts normalized for their currency). */
export type MoneyData = z.output<typeof moneySchema>;

export const cancelReceiptSchema = z.object({ entryId: z.string().uuid(), reason: z.string().trim().min(1, "اكتب سبب الإلغاء").max(500, "السبب طويل جداً") });
