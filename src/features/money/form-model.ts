/** Pure state of the money forms (PRD §8.7): defaults, linked cross-currency fields, checks, and the action input. */
import Decimal from "decimal.js";
import type { Currency, VaultKind } from "@/db/schema";
import { normalizeDigits, parseAmount } from "@/lib/money";
import { type SentenceInput, convertAtRate, moneySentence, rateOf } from "./describe";
import { type MoneyInput, type MoneyKind, type PayReason, otherCurrency } from "./schemas";

export type Balances = Record<Currency, string>;

export interface MoneyFormOptions {
    /** balance = everything the trader owes (customer's view); branchBalance = the part owed to the branch. */
    traders: { id: string; name: string; phone: string | null; balance: Balances; branchBalance: Balances }[];
    /** Active parties other than our own company and the branch. Negative balance = we owe them. */
    parties: { id: string; name: string; balance: Balances }[];
    /** partyId is set on the branch's own vault. */
    vaults: { id: string; name: string; kind: VaultKind; allowedCurrencies: Currency[]; partyId: string | null; balance: Balances }[];
    /** The owner's branch (the partnership). balance: negative = the owner holds money for it, positive = it owes the owner. */
    branch: { id: string; name: string; vaultId: string | null; balance: Balances } | null;
    categories: { id: string; name: string }[];
    defaultVaults: Partial<Record<Currency, string>>;
    /** Dinars per dollar to pre-fill. */
    defaultRate: string;
}

export const KIND_BY_SLUG: Record<string, MoneyKind> = {
    "receive-trader": "receive_trader",
    "receive-party": "receive_party",
    deposit: "deposit",
    "pay-party": "pay_party",
    "pay-trader": "pay_trader",
    withdraw: "withdraw",
    transfer: "transfer",
    exchange: "exchange",
    expense: "expense",
};
export const SLUG_BY_KIND = Object.fromEntries(Object.entries(KIND_BY_SLUG).map(([s, k]) => [k, s])) as Record<MoneyKind, string>;

export interface MoneyFormState {
    kind: MoneyKind;
    date: string | null;
    /** The paid amount; for an exchange, what leaves the first vault. */
    amount: string;
    currency: Currency;
    vaultId: string | null;
    traderId: string | null;
    partyId: string | null;
    categoryId: string | null;
    payReason: PayReason;
    payee: string;
    note: string;
    /** "الدفع بعملة أخرى" (receive from a trader / pay a party). */
    fxOn: boolean;
    rate: string;
    debtAmount: string;
    fromVaultId: string | null;
    toVaultId: string | null;
    /** Exchange: what arrives in the second vault. */
    toAmount: string;
    /** Receive from a trader: the part that pays what they owe the branch ("" = the automatic split). */
    branchAmount: string;
    /** Transfer between the owner's vault and the branch's: a handover that settles their account (default) or just moving cash. */
    settleBranch: boolean;
}

export interface Prefill {
    trader?: string;
    party?: string;
    vault?: string;
    /** Transfer: the vault the money goes to. */
    to?: string;
    currency?: string;
}

const accepts = (o: MoneyFormOptions, vaultId: string | null | undefined, c: Currency) =>
    !!vaultId && !!o.vaults.find((v) => v.id === vaultId)?.allowedCurrencies.includes(c);

/** The default vault for a currency, keeping the current one when it still fits. */
export function vaultFor(o: MoneyFormOptions, c: Currency, current?: string | null): string | null {
    if (accepts(o, current, c)) return current!;
    const d = o.defaultVaults[c];
    if (accepts(o, d, c)) return d!;
    return o.vaults.find((v) => v.allowedCurrencies.includes(c))?.id ?? null;
}

/** "2400.00" → "2400" for an input field. */
const plain = (x: string) => new Decimal(x).toString();

export function emptyForm(kind: MoneyKind, o: MoneyFormOptions, today: string, prefill: Prefill): MoneyFormState {
    const currency: Currency = prefill.currency === "USD" || prefill.currency === "IQD" ? prefill.currency : "IQD";
    const vault = vaultFor(o, currency, prefill.vault);
    return {
        kind,
        date: today,
        amount: "",
        currency,
        vaultId: vault,
        traderId: o.traders.some((x) => x.id === prefill.trader) ? prefill.trader! : null,
        partyId: o.parties.some((x) => x.id === prefill.party) ? prefill.party! : null,
        categoryId: null,
        payReason: "other",
        payee: "",
        note: "",
        fxOn: false,
        rate: o.defaultRate,
        debtAmount: "",
        fromVaultId: vault,
        toVaultId: kind === "exchange" ? vaultFor(o, otherCurrency(currency)) : accepts(o, prefill.to, currency) && prefill.to !== vault ? prefill.to! : null,
        toAmount: "",
        branchAmount: "",
        settleBranch: true,
    };
}

/** Kinds that only use the owner's vaults (the branch's vault is its own money). */
export const OWNER_VAULT_KINDS: MoneyKind[] = ["receive_party", "pay_party", "pay_trader", "exchange"];

export const isBranchVault = (o: MoneyFormOptions, id: string | null | undefined) => !!id && !!o.vaults.find((v) => v.id === id)?.partyId;

/** A transfer between one of the owner's vaults and the branch's. */
export const transferWithBranch = (o: MoneyFormOptions, f: MoneyFormState) =>
    !!f.fromVaultId && !!f.toVaultId && isBranchVault(o, f.fromVaultId) !== isBranchVault(o, f.toVaultId);

/**
 * Receive from a trader who owes the branch, or into the branch's vault: how much of the payment pays the branch's
 * debt. The owner can type it; otherwise money into the branch's vault pays the branch first, and money into the
 * owner's vault pays the owner first and only the rest goes to the branch.
 */
export function branchShare(f: MoneyFormState, o: MoneyFormOptions): { branch: string; owner: string } | null {
    if (f.kind !== "receive_trader" || f.fxOn || f.currency !== "IQD" || !o.branch) return null;
    const t = o.traders.find((x) => x.id === f.traderId);
    const owesBranch = new Decimal(t?.branchBalance.IQD ?? 0);
    const intoBranch = isBranchVault(o, f.vaultId);
    if (!intoBranch && owesBranch.lte(0)) return null;
    const amount = new Decimal(parseAmount(f.amount, "IQD") ?? 0);
    const typed = f.branchAmount.trim() ? parseAmount(f.branchAmount, "IQD") : null;
    let branch: Decimal;
    if (typed !== null) branch = Decimal.min(new Decimal(typed), amount);
    else if (intoBranch) branch = Decimal.min(Decimal.max(owesBranch, 0), amount);
    else {
        const owesOwner = Decimal.max(new Decimal(t?.balance.IQD ?? 0).minus(owesBranch), 0);
        branch = Decimal.min(Decimal.max(amount.minus(owesOwner), 0), Decimal.max(owesBranch, 0));
    }
    return { branch: branch.toFixed(0), owner: amount.minus(branch).toFixed(0) };
}

/** A typed rate ("1,310", "١٣١٠", "1310.5") as a plain positive number, or null. */
export function parseRate(raw: string): string | null {
    const s = normalizeDigits(raw)
        .replace(/[\s,٬،]/g, "")
        .replace(/٫/g, ".");
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    const d = new Decimal(s);
    return d.gt(0) ? d.toString() : null;
}

/** The other side at the current rate, or "" when it can't be computed yet. */
function converted(amount: string, from: Currency, rate: string): string {
    const a = parseAmount(amount, from);
    const r = parseRate(rate);
    if (a === null || r === null) return "";
    return convertAtRate(a, from, r) ?? "";
}

const linked = (f: MoneyFormState) => f.kind === "exchange" || f.fxOn;

export function onAmountChange(f: MoneyFormState, amount: string): MoneyFormState {
    const next = { ...f, amount };
    if (!linked(f)) return next;
    const other = converted(amount, f.currency, f.rate);
    return f.kind === "exchange" ? { ...next, toAmount: other } : { ...next, debtAmount: other };
}

export function onRateChange(f: MoneyFormState, rate: string): MoneyFormState {
    const next = { ...f, rate };
    const other = converted(f.amount, f.currency, rate);
    return f.kind === "exchange" ? { ...next, toAmount: other } : { ...next, debtAmount: other };
}

/** The owner typed the other side (debt or received amount): the rate follows. */
export function onDebtChange(f: MoneyFormState, value: string): MoneyFormState {
    const next = f.kind === "exchange" ? { ...f, toAmount: value } : { ...f, debtAmount: value };
    const a = parseAmount(f.amount, f.currency);
    const b = parseAmount(value, otherCurrency(f.currency));
    const r = a && b ? rateOf({ amount: a, currency: f.currency }, { amount: b, currency: otherCurrency(f.currency) }) : null;
    return r ? { ...next, rate: plain(r) } : next;
}

/** "تسديد الدين كاملاً" / "تسديد كامل المستحق": what fills the amount (and the debt side when paying in the other currency). */
export function fullAmount(kind: MoneyKind, f: MoneyFormState, o: MoneyFormOptions): { amount: string; debtAmount?: string } | null {
    let balance: Balances | undefined;
    let sign = 1;
    if (kind === "receive_trader") balance = o.traders.find((x) => x.id === f.traderId)?.balance;
    else if (kind === "pay_party") {
        balance = o.parties.find((x) => x.id === f.partyId)?.balance;
        sign = -1;
    }
    if (!balance) return null;
    const debtCurrency = f.fxOn ? otherCurrency(f.currency) : f.currency;
    const owed = new Decimal(balance[debtCurrency]).mul(sign);
    if (owed.lte(0)) return null;
    if (!f.fxOn) return { amount: plain(owed.toString()) };
    const paid = converted(owed.toString(), debtCurrency, f.rate);
    return paid ? { amount: plain(paid), debtAmount: plain(owed.toString()) } : null;
}

export type FormErrors = Record<string, string>;

const needsVault: MoneyKind[] = ["receive_trader", "receive_party", "deposit", "pay_party", "pay_trader", "withdraw", "expense"];

/** What the form can tell the owner before asking the server. Keys match the server's field names. */
export function validateForm(kind: MoneyKind, f: MoneyFormState): FormErrors {
    const e: FormErrors = {};
    const pos = (raw: string, c: Currency) => {
        const a = parseAmount(raw, c);
        return a !== null && Number(a) > 0;
    };
    if (!f.date) e.date = "اختر التاريخ";
    if ((kind === "receive_trader" || kind === "pay_trader") && !f.traderId) e.traderId = "اختر التاجر";
    if ((kind === "receive_party" || kind === "pay_party") && !f.partyId) e.partyId = "اختر الجهة";
    if (kind === "expense" && !f.categoryId) e.categoryId = "اختر التصنيف";
    if (needsVault.includes(kind) && !f.vaultId) e.vaultId = "اختر القاصة";
    if (kind === "transfer" || kind === "exchange") {
        if (!f.fromVaultId) e.fromVaultId = "اختر القاصة";
        if (!f.toVaultId) e.toVaultId = "اختر القاصة";
        else if (kind === "transfer" && f.toVaultId === f.fromVaultId) e.toVaultId = "اختر قاصة غير القاصة التي يخرج منها المبلغ";
    }
    if (!pos(f.amount, f.currency)) e[kind === "exchange" ? "fromAmount" : "amount"] = "اكتب المبلغ";
    if (kind === "exchange" && !pos(f.toAmount, otherCurrency(f.currency))) e.toAmount = "اكتب المبلغ";
    if (linked(f) && !parseRate(f.rate)) e.rate = "اكتب سعر الصرف";
    if (linked(f) && kind !== "exchange" && !pos(f.debtAmount, otherCurrency(f.currency))) e["fx.debtAmount"] = "اكتب المبلغ";
    return e;
}

export function toMoneyInput(kind: MoneyKind, f: MoneyFormState, allowNegative: boolean, o?: MoneyFormOptions): MoneyInput {
    const common = { date: f.date ?? "", note: f.note.trim() || null, allowNegative };
    const cash = { vaultId: f.vaultId ?? "", amount: f.amount, currency: f.currency };
    const fx = f.fxOn ? { debtCurrency: otherCurrency(f.currency), debtAmount: f.debtAmount } : null;
    switch (kind) {
        case "receive_trader": {
            const share = o ? branchShare(f, o) : null;
            return { kind, ...common, ...cash, traderId: f.traderId ?? "", fx, ...(share ? { branchAmount: share.branch } : {}) };
        }
        case "pay_party":
            return { kind, ...common, ...cash, partyId: f.partyId ?? "", fx };
        case "receive_party":
            return { kind, ...common, ...cash, partyId: f.partyId ?? "" };
        case "pay_trader":
            return { kind, ...common, ...cash, traderId: f.traderId ?? "", reason: f.payReason };
        case "deposit":
        case "withdraw":
            return { kind, ...common, ...cash };
        case "transfer":
            return {
                kind,
                ...common,
                fromVaultId: f.fromVaultId ?? "",
                toVaultId: f.toVaultId ?? "",
                amount: f.amount,
                currency: f.currency,
                ...(o && transferWithBranch(o, f) ? { settleBranch: f.settleBranch } : {}),
            };
        case "exchange":
            return {
                kind,
                ...common,
                fromVaultId: f.fromVaultId ?? "",
                fromCurrency: f.currency,
                fromAmount: f.amount,
                toVaultId: f.toVaultId ?? "",
                toAmount: f.toAmount,
            };
        case "expense":
            return { kind, ...common, ...cash, categoryId: f.categoryId ?? "", payee: f.payee.trim() || null };
    }
}

/** The confirmation sentence for the current form (names looked up in the options). */
export function formSentence(kind: MoneyKind, f: MoneyFormState, o: MoneyFormOptions): string {
    const vault = (id: string | null) => o.vaults.find((v) => v.id === id)?.name ?? "";
    const other = otherCurrency(f.currency);
    const amount = parseAmount(f.amount, f.currency) ?? "0";
    const s: SentenceInput = {
        amount,
        currency: f.currency,
        traderName: o.traders.find((x) => x.id === f.traderId)?.name,
        partyName: o.parties.find((x) => x.id === f.partyId)?.name,
        vaultName: vault(f.vaultId),
        fromVaultName: vault(f.fromVaultId),
        toVaultName: vault(f.toVaultId),
        categoryName: o.categories.find((x) => x.id === f.categoryId)?.name,
        payee: f.payee.trim() || null,
        payReason: f.payReason,
    };
    const share = branchShare(f, o);
    if (kind === "receive_trader" && share && Number(share.branch) > 0) Object.assign(s, { branchAmount: share.branch, branchName: o.branch?.name });
    if (kind === "transfer" && transferWithBranch(o, f)) s.settlesBranch = f.settleBranch;
    if (kind === "exchange") {
        const to = parseAmount(f.toAmount, other) ?? "0";
        s.exchange = { toAmount: to, toCurrency: other };
        s.rate = rateOf({ amount, currency: f.currency }, { amount: to, currency: other });
    } else if (f.fxOn && (kind === "receive_trader" || kind === "pay_party")) {
        const debt = parseAmount(f.debtAmount, other) ?? "0";
        s.fx = { debtCurrency: other, debtAmount: debt };
        s.rate = rateOf({ amount, currency: f.currency }, { amount: debt, currency: other });
    }
    return moneySentence(kind, s);
}
