import { eq } from "drizzle-orm";
import "server-only";
import type { DbOrTx } from "@/db";
import { type Currency, containerCharges, expenseCategories, journalEntries, parties, traders, vaults } from "@/db/schema";
import { audit } from "@/features/audit/log";
import { cancelCharge } from "@/features/charges/service";
import { postEntry } from "@/features/ledger/post-entry";
import * as postings from "@/features/ledger/postings";
import { reverseEntry } from "@/features/ledger/reverse-entry";
import type { LedgerLine } from "@/features/ledger/types";
import { type VaultOutflow, type VaultShortfall, vaultShortfalls } from "@/features/ledger/vault-check";
import { DomainError } from "@/lib/errors";
import { formatMoney, todayISO } from "@/lib/format";
import { t } from "@/lib/i18n";
import { ENTRY_TYPE_OF, type MoneyMeta, PAY_REASON_LABEL, rateOf } from "./describe";
import { type MoneyData, type MoneyInput, moneySchema, otherCurrency } from "./schemas";

export type { MoneyInput };

async function vaultFor(tx: DbOrTx, vaultId: string, currency: Currency, field: string) {
    const [v] = await tx.select().from(vaults).where(eq(vaults.id, vaultId));
    if (!v || !v.isActive) throw new DomainError("اختر القاصة", field);
    if (!v.allowedCurrencies.includes(currency)) throw new DomainError(t("error.vaultCurrency"), field);
    return v;
}

async function traderFor(tx: DbOrTx, traderId: string) {
    const [tr] = await tx.select().from(traders).where(eq(traders.id, traderId));
    if (!tr || !tr.isActive) throw new DomainError("اختر التاجر", "traderId");
    return tr;
}

async function partyFor(tx: DbOrTx, partyId: string) {
    const [p] = await tx.select().from(parties).where(eq(parties.id, partyId));
    if (!p || !p.isActive) throw new DomainError("اختر الجهة", "partyId");
    if (p.kind === "self") throw new DomainError("اختر جهة غير شركتنا. لإدخال أو إخراج مال المالك استخدم إيداع أو سحب", "partyId");
    return p;
}

/** Cash leaving a vault for this action (for the negative-balance warning). */
function outflowsOf(d: MoneyData): VaultOutflow[] {
    switch (d.kind) {
        case "pay_party":
        case "pay_trader":
        case "withdraw":
        case "expense":
            return [{ vaultId: d.vaultId, currency: d.currency, amount: d.amount }];
        case "transfer":
            return [{ vaultId: d.fromVaultId, currency: d.currency, amount: d.amount }];
        case "exchange":
            return [{ vaultId: d.fromVaultId, currency: d.fromCurrency, amount: d.fromAmount }];
        default:
            return [];
    }
}

interface Resolved {
    lines: LedgerLine[];
    description: string;
    counterpartyLabel: string | null;
    amount: string;
    currency: Currency;
    fxRate: string | null;
    meta: MoneyMeta;
}

/** Checks the action against the database and builds its PRD §6.3 lines and receipt labels. */
async function resolve(tx: DbOrTx, d: MoneyData): Promise<Resolved> {
    const base = { note: d.note };
    switch (d.kind) {
        case "receive_trader": {
            const tr = await traderFor(tx, d.traderId);
            const v = await vaultFor(tx, d.vaultId, d.currency, "vaultId");
            const paid = { amount: d.amount, currency: d.currency };
            return {
                lines: d.fx
                    ? postings.receiveFromTraderFx({
                          traderId: tr.id,
                          vaultId: v.id,
                          paidCurrency: d.currency,
                          paidAmount: d.amount,
                          debtCurrency: d.fx.debtCurrency,
                          debtAmount: d.fx.debtAmount,
                      })
                    : postings.receiveFromTrader({ traderId: tr.id, vaultId: v.id, currency: d.currency, amount: d.amount }),
                description: `قبض من التاجر ${tr.name}`,
                counterpartyLabel: tr.name,
                ...paid,
                fxRate: d.fx ? rateOf(paid, { amount: d.fx.debtAmount, currency: d.fx.debtCurrency }) : null,
                meta: { ...base, traderId: tr.id, traderName: tr.name, vaultName: v.name, fx: d.fx },
            };
        }
        case "pay_party": {
            const p = await partyFor(tx, d.partyId);
            const v = await vaultFor(tx, d.vaultId, d.currency, "vaultId");
            const paid = { amount: d.amount, currency: d.currency };
            return {
                lines: d.fx
                    ? postings.payPartyFx({
                          partyId: p.id,
                          vaultId: v.id,
                          paidCurrency: d.currency,
                          paidAmount: d.amount,
                          debtCurrency: d.fx.debtCurrency,
                          debtAmount: d.fx.debtAmount,
                      })
                    : postings.payParty({ partyId: p.id, vaultId: v.id, currency: d.currency, amount: d.amount }),
                description: `دفع إلى ${p.name}`,
                counterpartyLabel: p.name,
                ...paid,
                fxRate: d.fx ? rateOf(paid, { amount: d.fx.debtAmount, currency: d.fx.debtCurrency }) : null,
                meta: { ...base, partyId: p.id, partyName: p.name, vaultName: v.name, fx: d.fx },
            };
        }
        case "receive_party": {
            const p = await partyFor(tx, d.partyId);
            const v = await vaultFor(tx, d.vaultId, d.currency, "vaultId");
            return {
                lines: postings.receiveFromParty({ partyId: p.id, vaultId: v.id, currency: d.currency, amount: d.amount }),
                description: `قبض من ${p.name}`,
                counterpartyLabel: p.name,
                amount: d.amount,
                currency: d.currency,
                fxRate: null,
                meta: { ...base, partyId: p.id, partyName: p.name, vaultName: v.name },
            };
        }
        case "pay_trader": {
            const tr = await traderFor(tx, d.traderId);
            const v = await vaultFor(tx, d.vaultId, d.currency, "vaultId");
            return {
                lines: postings.payTrader({ traderId: tr.id, vaultId: v.id, currency: d.currency, amount: d.amount }),
                description: `دفع للتاجر ${tr.name}${d.reason !== "other" ? ` · ${PAY_REASON_LABEL[d.reason]}` : ""}`,
                counterpartyLabel: tr.name,
                amount: d.amount,
                currency: d.currency,
                fxRate: null,
                meta: { ...base, traderId: tr.id, traderName: tr.name, vaultName: v.name, payReason: d.reason },
            };
        }
        case "deposit":
        case "withdraw": {
            const v = await vaultFor(tx, d.vaultId, d.currency, "vaultId");
            const p = { vaultId: v.id, currency: d.currency, amount: d.amount };
            return {
                lines: d.kind === "deposit" ? postings.deposit(p) : postings.withdraw(p),
                description: d.kind === "deposit" ? `إيداع في ${v.name}` : `سحب من ${v.name}`,
                counterpartyLabel: "المالك",
                amount: d.amount,
                currency: d.currency,
                fxRate: null,
                meta: { ...base, vaultName: v.name },
            };
        }
        case "transfer": {
            const from = await vaultFor(tx, d.fromVaultId, d.currency, "fromVaultId");
            const to = await vaultFor(tx, d.toVaultId, d.currency, "toVaultId");
            return {
                lines: postings.transfer({ fromVaultId: from.id, toVaultId: to.id, currency: d.currency, amount: d.amount }),
                description: `تحويل من ${from.name} إلى ${to.name}`,
                counterpartyLabel: to.name,
                amount: d.amount,
                currency: d.currency,
                fxRate: null,
                meta: { ...base, fromVaultName: from.name, toVaultName: to.name },
            };
        }
        case "exchange": {
            const toCurrency = otherCurrency(d.fromCurrency);
            const from = await vaultFor(tx, d.fromVaultId, d.fromCurrency, "fromVaultId");
            const to = await vaultFor(tx, d.toVaultId, toCurrency, "toVaultId");
            return {
                lines: postings.exchange({
                    fromVaultId: from.id,
                    fromCurrency: d.fromCurrency,
                    fromAmount: d.fromAmount,
                    toVaultId: to.id,
                    toCurrency,
                    toAmount: d.toAmount,
                }),
                description: `تصريف ${formatMoney(d.fromAmount, d.fromCurrency)} إلى ${formatMoney(d.toAmount, toCurrency)}`,
                counterpartyLabel: to.name,
                amount: d.fromAmount,
                currency: d.fromCurrency,
                fxRate: rateOf({ amount: d.fromAmount, currency: d.fromCurrency }, { amount: d.toAmount, currency: toCurrency }),
                meta: { ...base, fromVaultName: from.name, toVaultName: to.name, exchange: { toAmount: d.toAmount, toCurrency } },
            };
        }
        case "expense": {
            const [cat] = await tx.select().from(expenseCategories).where(eq(expenseCategories.id, d.categoryId));
            if (!cat || !cat.isActive) throw new DomainError("اختر التصنيف", "categoryId");
            const v = await vaultFor(tx, d.vaultId, d.currency, "vaultId");
            return {
                lines: postings.generalExpense({ categoryId: cat.id, vaultId: v.id, currency: d.currency, amount: d.amount }),
                description: `مصروف عام · ${cat.name}`,
                counterpartyLabel: d.payee ?? cat.name,
                amount: d.amount,
                currency: d.currency,
                fxRate: null,
                meta: { ...base, categoryName: cat.name, payee: d.payee, vaultName: v.name },
            };
        }
    }
}

const RECEIPT_KIND = {
    receive_trader: "in",
    receive_party: "in",
    deposit: "in",
    pay_party: "out",
    pay_trader: "out",
    withdraw: "out",
    expense: "out",
    transfer: "transfer",
    exchange: "exchange",
} as const;

/**
 * Posts one money action (PRD §6.3 A4–A12) with its receipt number, in the caller's transaction.
 * A vault that would go below zero needs `allowNegative` (the owner confirmed the warning, §6.4).
 */
export async function postMoney(tx: DbOrTx, input: MoneyInput, userId: string): Promise<{ entryId: string; receiptNo: string }> {
    const d = moneySchema.parse(input);
    const r = await resolve(tx, d);
    if (!d.allowNegative && (await vaultShortfalls(tx, outflowsOf(d))).length) throw new DomainError(t("warn.negativeVault"), "allowNegative");
    const { entryId, receiptNo } = await postEntry(tx, {
        type: ENTRY_TYPE_OF[d.kind],
        date: d.date,
        receiptKind: RECEIPT_KIND[d.kind],
        description: r.description,
        counterpartyLabel: r.counterpartyLabel,
        amount: r.amount,
        currency: r.currency,
        fxRate: r.fxRate,
        meta: { ...r.meta },
        userId,
        lines: r.lines,
    });
    await audit(tx, {
        table: "journal_entries",
        recordId: entryId,
        action: "create",
        after: { kind: d.kind, receiptNo, amount: r.amount, currency: r.currency },
        userId,
    });
    return { entryId, receiptNo: receiptNo! };
}

/** Vaults this action would take below zero (empty when none). */
export async function willGoNegative(db: DbOrTx, input: MoneyInput): Promise<VaultShortfall[]> {
    return vaultShortfalls(db, outflowsOf(moneySchema.parse(input)));
}

/**
 * Cancels a receipt (A14): the exact reverse with its own number of the same letter. A container charge's
 * receipt is cancelled through the charge, so the container's list and totals stay right.
 */
export async function cancelReceipt(tx: DbOrTx, entryId: string, reason: string, userId: string, date: string = todayISO()) {
    const why = reason.trim();
    if (!why) throw new DomainError("اكتب سبب الإلغاء", "reason");
    const [e] = await tx.select().from(journalEntries).where(eq(journalEntries.id, entryId));
    if (!e) throw new DomainError("لم يُعثر على الوصل");
    if (e.type === "reversal") throw new DomainError("لا يمكن إلغاء قيد إلغاء");
    if (e.cancelledAt) throw new DomainError("هذا الوصل ملغى مسبقاً");
    if (e.type === "container_charge") {
        const [charge] = await tx.select({ id: containerCharges.id }).from(containerCharges).where(eq(containerCharges.journalEntryId, entryId));
        if (charge) return cancelCharge(tx, charge.id, why, userId, date);
    }
    const result = await reverseEntry(tx, entryId, why, date, userId);
    await audit(tx, {
        table: "journal_entries",
        recordId: entryId,
        action: "cancel",
        before: { receiptNo: e.receiptNo },
        after: { cancelReason: why, reversalEntryId: result.entryId, reversalReceiptNo: result.receiptNo },
        userId,
    });
    return result;
}
