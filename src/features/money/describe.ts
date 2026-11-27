/**
 * Pure wording for money entries: the confirmation sentence (PRD §8.7), the receipt title and lines
 * (PRD §6.5) and the journal's from → to. Reads the labels saved in the entry's meta at posting time,
 * so a printed receipt never changes when a name is edited later.
 */
import Decimal from "decimal.js";
import type { Currency, EntryType, ReceiptKind } from "@/db/schema";
import { formatMoney, formatNumber } from "@/lib/format";
import { roundTo } from "@/lib/money";
import type { MoneyKind, PayReason } from "./schemas";

export interface MoneyMeta {
    note?: string | null;
    traderId?: string;
    traderName?: string;
    partyId?: string;
    partyName?: string;
    vaultName?: string;
    fromVaultName?: string;
    toVaultName?: string;
    categoryName?: string;
    payee?: string | null;
    payReason?: PayReason;
    fx?: { debtCurrency: Currency; debtAmount: string } | null;
    exchange?: { toAmount: string; toCurrency: Currency };
    /** Container charges (written by the charges service). */
    chargeType?: string;
    containerNumber?: string;
    payer?: string;
    traders?: { name: string; amount: string }[];
    /** Cancellations (written by reverseEntry). */
    reason?: string;
    reversesReceiptNo?: string | null;
    reversesType?: EntryType;
}

export const PAY_REASON_LABEL: Record<PayReason, string> = { refund: "إرجاع", advance: "سلفة", other: "أخرى" };

export const ENTRY_TYPE_OF: Record<MoneyKind, EntryType> = {
    receive_trader: "receive_from_trader",
    receive_party: "receive_from_party",
    deposit: "deposit",
    pay_party: "pay_party",
    pay_trader: "pay_trader",
    withdraw: "withdraw",
    transfer: "transfer",
    exchange: "exchange",
    expense: "general_expense",
};

/** Dinars per dollar, 4 decimals, whichever side is which. Null when either side is not positive. */
export function rateOf(a: { amount: string; currency: Currency }, b: { amount: string; currency: Currency }): string | null {
    const iqd = new Decimal(a.currency === "IQD" ? a.amount : b.amount);
    const usd = new Decimal(a.currency === "USD" ? a.amount : b.amount);
    if (iqd.lte(0) || usd.lte(0)) return null;
    return iqd.div(usd).toFixed(4);
}

/** The other currency's amount at a dinars-per-dollar rate, rounded for that currency. */
export function convertAtRate(amount: string, from: Currency, rate: string): string | null {
    let r: Decimal;
    let a: Decimal;
    try {
        r = new Decimal(rate);
        a = new Decimal(amount);
    } catch {
        return null;
    }
    if (r.lte(0) || a.lt(0)) return null;
    return from === "USD" ? roundTo(a.mul(r), "IQD") : roundTo(a.div(r), "USD");
}

const rateText = (rate: string | null | undefined) => (rate ? formatNumber(rate) : "");

export type SentenceInput = MoneyMeta & { amount: string; currency: Currency; rate?: string | null };

/** The full Arabic sentence of the confirmation dialog. */
export function moneySentence(kind: MoneyKind, s: SentenceInput): string {
    const amt = formatMoney(s.amount, s.currency);
    const fx = s.fx ? ` مقابل ${formatMoney(s.fx.debtAmount, s.fx.debtCurrency)} بسعر صرف ${rateText(s.rate)}` : "";
    switch (kind) {
        case "receive_trader":
            return `سيتم استلام ${amt} من التاجر ${s.traderName} إلى ${s.vaultName}${fx}`;
        case "receive_party":
            return `سيتم استلام ${amt} من ${s.partyName} إلى ${s.vaultName}`;
        case "deposit":
            return `سيتم إيداع ${amt} في ${s.vaultName}`;
        case "pay_party":
            return `سيتم دفع ${amt} إلى ${s.partyName} من ${s.vaultName}${fx}`;
        case "pay_trader":
            return `سيتم دفع ${amt} للتاجر ${s.traderName} من ${s.vaultName}${s.payReason && s.payReason !== "other" ? ` (${PAY_REASON_LABEL[s.payReason]})` : ""}`;
        case "withdraw":
            return `سيتم سحب ${amt} من ${s.vaultName}`;
        case "transfer":
            return `سيتم تحويل ${amt} من ${s.fromVaultName} إلى ${s.toVaultName}`;
        case "exchange":
            return `سيتم تصريف ${amt} من ${s.fromVaultName} إلى ${formatMoney(s.exchange?.toAmount ?? "0", s.exchange?.toCurrency ?? "USD")} في ${s.toVaultName} بسعر صرف ${rateText(s.rate)}`;
        case "expense":
            return `سيتم صرف ${amt} من ${s.vaultName} على ${s.categoryName}${s.payee ? ` · المستفيد ${s.payee}` : ""}`;
    }
}

const TITLES: Record<ReceiptKind, string> = { in: "وصل قبض", out: "وصل صرف", transfer: "وصل تحويل", exchange: "وصل تصريف عملة" };

export function receiptTitle(kind: ReceiptKind, isCancellation: boolean): string {
    return isCancellation ? `إلغاء ${TITLES[kind]}` : TITLES[kind];
}

export type ReceiptLine = [label: string, value: string];

/** The labelled lines between the header and the amount. `type` is the original entry's type. */
export function receiptLines(type: EntryType, m: MoneyMeta, fxRate: string | null): ReceiptLine[] {
    const out: ReceiptLine[] = [];
    const add = (label: string, value: string | null | undefined) => {
        if (value) out.push([label, value]);
    };
    const fxLines = (label: string) => {
        if (!m.fx) return;
        add(label, formatMoney(m.fx.debtAmount, m.fx.debtCurrency));
        add("سعر الصرف", rateText(fxRate));
    };
    switch (type) {
        case "receive_from_trader":
            add("استلمنا من", `التاجر ${m.traderName}`);
            add("إلى قاصة", m.vaultName);
            fxLines("مقابل دين");
            break;
        case "receive_from_party":
            add("استلمنا من", m.partyName);
            add("إلى قاصة", m.vaultName);
            break;
        case "deposit":
            add("استلمنا من", "المالك (إيداع)");
            add("إلى قاصة", m.vaultName);
            break;
        case "pay_party":
            add("دفعنا إلى", m.partyName);
            add("من قاصة", m.vaultName);
            fxLines("مقابل مستحق");
            break;
        case "pay_trader":
            add("دفعنا إلى", `التاجر ${m.traderName}`);
            add("من قاصة", m.vaultName);
            add("السبب", m.payReason && m.payReason !== "other" ? PAY_REASON_LABEL[m.payReason] : null);
            break;
        case "withdraw":
            add("دفعنا إلى", "المالك (سحب)");
            add("من قاصة", m.vaultName);
            break;
        case "general_expense":
            add("مصروف", m.categoryName);
            add("المستفيد", m.payee);
            add("من قاصة", m.vaultName);
            break;
        case "transfer":
            add("من قاصة", m.fromVaultName);
            add("إلى قاصة", m.toVaultName);
            break;
        case "exchange":
            add("من قاصة", m.fromVaultName);
            add("إلى قاصة", m.toVaultName);
            if (m.exchange) add("المبلغ المستلم", formatMoney(m.exchange.toAmount, m.exchange.toCurrency));
            add("سعر الصرف", rateText(fxRate));
            break;
        case "container_charge":
            add("دفعنا عن", m.chargeType ? `${m.chargeType} · الحاوية ${m.containerNumber}` : null);
            add("من قاصة", m.vaultName);
            add((m.traders?.length ?? 0) > 1 ? "على التجار" : "على التاجر", m.traders?.map((t) => t.name).join("، "));
            break;
        default:
            break;
    }
    add("ملاحظة", m.note);
    return out;
}

/** Where the money came from and went to, for the journal. A cancellation swaps the sides. */
export function entryFlow(type: EntryType, m: MoneyMeta, reversesType: EntryType | null): { from: string; to: string } {
    if (type === "reversal") {
        const f = entryFlow(reversesType ?? m.reversesType ?? "opening_balance", m, null);
        return { from: f.to, to: f.from };
    }
    const trader = m.traderName ? `التاجر ${m.traderName}` : "";
    switch (type) {
        case "receive_from_trader":
            return { from: trader, to: m.vaultName ?? "" };
        case "receive_from_party":
            return { from: m.partyName ?? "", to: m.vaultName ?? "" };
        case "deposit":
            return { from: "المالك", to: m.vaultName ?? "" };
        case "pay_party":
            return { from: m.vaultName ?? "", to: m.partyName ?? "" };
        case "pay_trader":
            return { from: m.vaultName ?? "", to: trader };
        case "withdraw":
            return { from: m.vaultName ?? "", to: "المالك" };
        case "general_expense":
            return { from: m.vaultName ?? "", to: [m.categoryName, m.payee].filter(Boolean).join(" · ") };
        case "transfer":
        case "exchange":
            return { from: m.fromVaultName ?? "", to: m.toVaultName ?? "" };
        case "container_charge":
            return { from: m.payer ?? "", to: m.containerNumber ? `الحاوية ${m.containerNumber}` : "" };
        default:
            return { from: "", to: "" };
    }
}
