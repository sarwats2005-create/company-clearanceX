/** Account statements in the URL and in words (PRD §8.8). Pure: used by pages (server) and filters (client). */
import Decimal from "decimal.js";
import type { Currency, PartyKind, VaultKind } from "@/db/schema";
import { isIsoDate } from "@/features/containers/status";
import { balanceSide, formatDate, formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";

export const STATEMENT_PRESETS = ["this_month", "last_month", "this_year", "all"] as const;
export type StatementPreset = (typeof STATEMENT_PRESETS)[number];

export const PRESET_LABEL: Record<StatementPreset, string> = {
    this_month: "هذا الشهر",
    last_month: "الشهر الماضي",
    this_year: "هذه السنة",
    all: "الكل",
};

export const PARTY_KIND_LABEL: Record<PartyKind, string> = { self: "شركتنا", clearance_company: "شركة تخليص", partner: "شريك", other: "أخرى" };

export const VAULT_KIND_LABEL: Record<VaultKind, string> = {
    main: "القاصة الرئيسية",
    usd: "قاصة الدولار",
    person: "شخص",
    exchange_shop: "محل صيرفة",
    trader: "تاجر",
    other: "أخرى",
};

/** Kinds the owner can pick for a new vault (PRD §8.8 vault form). */
export const CUSTOM_VAULT_KINDS = ["person", "exchange_shop", "trader", "other"] as const satisfies readonly VaultKind[];

export const CURRENCY_NAME: Record<Currency, string> = { IQD: "دينار عراقي", USD: "دولار أمريكي" };
export const CURRENCY_IN: Record<Currency, string> = { IQD: "بالدينار العراقي", USD: "بالدولار الأمريكي" };

/** Under a vault's name: its kind, or for the two built-in vaults (whose name says it all) the currencies it holds. */
export function vaultSubtitle(v: { kind: VaultKind; allowedCurrencies: Currency[]; partyId?: string | null }): string {
    const currencies = v.allowedCurrencies.map((c) => CURRENCY_NAME[c]).join(" و");
    if (v.partyId) return `قاصة الشراكة · ${currencies}`;
    return v.kind === "main" || v.kind === "usd" ? currencies : `${VAULT_KIND_LABEL[v.kind]} · ${currencies}`;
}

export interface StatementParams {
    preset: StatementPreset | "custom";
    currency?: Currency;
    from?: string;
    to?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Dates (yyyy-mm-dd) a preset covers on a given day. */
export function statementRange(preset: StatementPreset, today: string): { from?: string; to?: string } {
    const [y, m] = today.split("-").map(Number);
    switch (preset) {
        case "this_month":
            return { from: `${y}-${pad(m)}-01`, to: today };
        case "last_month": {
            const py = m === 1 ? y - 1 : y;
            const pm = m === 1 ? 12 : m - 1;
            const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
            return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(last)}` };
        }
        case "this_year":
            return { from: `${y}-01-01`, to: today };
        case "all":
            return {};
    }
}

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const date = (v: string | string[] | undefined) => {
    const s = one(v);
    return s && isIsoDate(s) ? s : undefined;
};

/** Anything odd in the URL is ignored rather than failing the page. Typed dates win over a preset. */
export function parseStatementParams(raw: Raw, today: string): StatementParams {
    const c = one(raw.currency);
    const currency = c === "IQD" || c === "USD" ? c : undefined;
    let from = date(raw.from);
    let to = date(raw.to);
    if (from || to) {
        if (from && to && from > to) [from, to] = [to, from];
        return { preset: "custom", currency, from, to };
    }
    const r = one(raw.range) as StatementPreset | undefined;
    const preset = r && (STATEMENT_PRESETS as readonly string[]).includes(r) ? r : "all";
    return { preset, currency, from: undefined, to: undefined, ...statementRange(preset, today) };
}

export function statementQuery(p: StatementParams, patch: Partial<StatementParams>): string {
    const m = { ...p, ...patch };
    const s = new URLSearchParams();
    if (m.currency) s.set("currency", m.currency);
    if (m.preset === "custom") {
        if (m.from) s.set("from", m.from);
        if (m.to) s.set("to", m.to);
    } else if (m.preset !== "all") s.set("range", m.preset);
    const str = s.toString();
    return str ? `?${str}` : "";
}

export function rangeText(from: string | undefined, to: string | undefined): string {
    if (from && to) return `من ${formatDate(from)} إلى ${formatDate(to)}`;
    if (to) return `حتى ${formatDate(to)}`;
    if (from) return `من ${formatDate(from)}`;
    return "كل الحركات";
}

/** One balance in the owner's words: "عليه 2,400 $" / "له 50,000 د.ع" / "مسدد". */
export function balanceWordsOf(amount: string, currency: Currency): string {
    const side = balanceSide(amount, currency);
    return side === "settled" ? t("balance.settled") : `${t(`balance.${side}`)} ${formatMoney(amount.replace(/^-/, ""), currency)}`;
}

/** Both currencies as plain words: "عليه 2,400 $ · له 50,000 د.ع", or "مسدد" when nothing is left. */
export function balanceWords(b: Record<Currency, string>): string {
    const parts = (["USD", "IQD"] as Currency[]).filter((c) => balanceSide(b[c], c) !== "settled").map((c) => balanceWordsOf(b[c], c));
    return parts.length ? parts.join(" · ") : t("balance.settled");
}

/** WhatsApp summary of a statement (PRD §8.8): company, title, range, closing balances. */
export function statementShareText(s: { company: string; title: string; from?: string; to?: string; balances: Record<Currency, string> }): string {
    return [s.company, s.title, `الفترة: ${rangeText(s.from, s.to)}`, `الرصيد: ${balanceWords(s.balances)}`].join("\n");
}

/** Both currencies in dinars at the rate, for "largest debt first" (positive = owes us). */
export function debtWeight(b: Record<Currency, string>, rate: string): number {
    return new Decimal(b.USD).times(rate).plus(b.IQD).toNumber();
}

/** The statement currency to open: the chosen one if the account takes it, else the first holding a balance, else the first accepted. */
export function defaultCurrency(allowed: Currency[], balance: Record<Currency, string>, chosen?: Currency): Currency {
    if (chosen && allowed.includes(chosen)) return chosen;
    return allowed.find((c) => balanceSide(balance[c], c) !== "settled") ?? allowed[0];
}

/** Account pages by URL segment. */
export const ACCOUNT_SEGMENTS = ["traders", "parties", "vaults"] as const;
export type AccountSegment = (typeof ACCOUNT_SEGMENTS)[number];
export const LEDGER_KIND = { traders: "trader", parties: "party", vaults: "vault" } as const satisfies Record<AccountSegment, string>;
