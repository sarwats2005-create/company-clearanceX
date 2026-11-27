/**
 * One pure function per money action (PRD §6.3, A1–A15). Each returns the journal lines;
 * post them with postEntry(). Pure so they can be unit-tested without a database.
 */
import Decimal from "decimal.js";
import type { Currency } from "@/db/schema";
import type { AccountRef, LedgerLine } from "./types";

export type { LedgerLine };

const dr = (account: AccountRef, currency: Currency, amount: string, memo?: string | null): LedgerLine => ({ account, currency, debit: amount, memo });
const cr = (account: AccountRef, currency: Currency, amount: string, memo?: string | null): LedgerLine => ({ account, currency, credit: amount, memo });

const trader = (id: string): AccountRef => ({ kind: "trader", refId: id });
const party = (id: string): AccountRef => ({ kind: "party", refId: id });
const vault = (id: string): AccountRef => ({ kind: "vault", refId: id });
/** What a trader owes our branch (the partnership), not the owner. */
const traderBranch = (id: string): AccountRef => ({ kind: "trader_branch", refId: id });
/** The branch's side of its account with the owner (always the mirror of the branch's party account). */
const branchOwner = (branchId: string): AccountRef => ({ kind: "branch_owner", refId: branchId });
const FEE: AccountRef = { kind: "fee_income" };
const FX: AccountRef = { kind: "fx" };
const EQUITY: AccountRef = { kind: "owner_equity" };
const OPENING: AccountRef = { kind: "opening" };

export type ChargePayer =
    | { kind: "party"; partyId: string }
    | { kind: "vault"; vaultId: string }
    | { kind: "fee" }
    /** The branch paid from its own vault: the traders owe the branch. */
    | { kind: "branch_vault"; vaultId: string }
    /** The owner paid from his vault for the branch: the traders owe the branch, and the branch owes the owner. */
    | { kind: "branch_on_behalf"; vaultId: string; branchId: string };

/**
 * A1/A2/A3: a container charge. Debit each trader with their part (zero parts skipped),
 * credit the party that paid (A1), our vault (A2), or fee income (A3) with the full amount.
 * Branch payers (B1/B2): the traders' parts go to what they owe the branch instead of the owner.
 */
export function containerCharge(p: {
    currency: Currency;
    amount: string;
    allocations: { traderId: string; amount: string; memo?: string | null }[];
    payer: ChargePayer;
    memo?: string | null;
}): LedgerLine[] {
    const forBranch = p.payer.kind === "branch_vault" || p.payer.kind === "branch_on_behalf";
    const lines = p.allocations
        .filter((a) => new Decimal(a.amount).gt(0))
        .map((a) => dr(forBranch ? traderBranch(a.traderId) : trader(a.traderId), p.currency, a.amount, a.memo ?? p.memo));
    switch (p.payer.kind) {
        case "party":
            lines.push(cr(party(p.payer.partyId), p.currency, p.amount, p.memo));
            break;
        case "vault":
        case "branch_vault":
            lines.push(cr(vault(p.payer.vaultId), p.currency, p.amount, p.memo));
            break;
        case "fee":
            lines.push(cr(FEE, p.currency, p.amount, p.memo));
            break;
        case "branch_on_behalf":
            lines.push(cr(vault(p.payer.vaultId), p.currency, p.amount, p.memo));
            lines.push(dr(party(p.payer.branchId), p.currency, p.amount, p.memo), cr(branchOwner(p.payer.branchId), p.currency, p.amount, p.memo));
            break;
    }
    return lines;
}

/**
 * B3: a trader pays, and the owner says which debt it settles: what they owe the owner (`ownerPart`) and/or
 * what they owe the branch (`branchPart`). Money taken into the owner's vault for the branch means the owner
 * now holds it for the branch; money taken into the branch's vault for the owner means the branch holds it.
 */
export function receiveFromTraderSplit(p: {
    traderId: string;
    vaultId: string;
    vaultIsBranch: boolean;
    branchId: string;
    currency: Currency;
    ownerPart: string;
    branchPart: string;
}): LedgerLine[] {
    const o = new Decimal(p.ownerPart);
    const b = new Decimal(p.branchPart);
    const total = o.plus(b).toFixed();
    const lines: LedgerLine[] = [dr(vault(p.vaultId), p.currency, total)];
    if (o.gt(0)) lines.push(cr(trader(p.traderId), p.currency, p.ownerPart));
    if (b.gt(0)) lines.push(cr(traderBranch(p.traderId), p.currency, p.branchPart));
    if (!p.vaultIsBranch && b.gt(0)) lines.push(dr(branchOwner(p.branchId), p.currency, p.branchPart), cr(party(p.branchId), p.currency, p.branchPart));
    if (p.vaultIsBranch && o.gt(0)) lines.push(dr(party(p.branchId), p.currency, p.ownerPart), cr(branchOwner(p.branchId), p.currency, p.ownerPart));
    return lines;
}

/**
 * B4: cash moved between the owner's vault and the branch's vault that settles what they owe each other
 * (the owner handing over money he collected for the branch, or the branch paying the owner back).
 * A plain transfer (A10) between the same two vaults moves cash without touching that account (profit, top-up).
 */
export function branchSettle(p: { fromVaultId: string; toVaultId: string; toBranch: boolean; branchId: string; currency: Currency; amount: string }): LedgerLine[] {
    const lines = transfer(p);
    if (p.toBranch) lines.push(dr(party(p.branchId), p.currency, p.amount), cr(branchOwner(p.branchId), p.currency, p.amount));
    else lines.push(dr(branchOwner(p.branchId), p.currency, p.amount), cr(party(p.branchId), p.currency, p.amount));
    return lines;
}

/** A4: receive from a trader into a vault (same currency). */
export function receiveFromTrader(p: { traderId: string; vaultId: string; currency: Currency; amount: string }): LedgerLine[] {
    return [dr(vault(p.vaultId), p.currency, p.amount), cr(trader(p.traderId), p.currency, p.amount)];
}

/** A4x: trader pays in the other currency at a typed rate; the FX account bridges the two. */
export function receiveFromTraderFx(p: {
    traderId: string;
    vaultId: string;
    paidCurrency: Currency;
    paidAmount: string;
    debtCurrency: Currency;
    debtAmount: string;
}): LedgerLine[] {
    return [
        dr(vault(p.vaultId), p.paidCurrency, p.paidAmount),
        cr(FX, p.paidCurrency, p.paidAmount),
        dr(FX, p.debtCurrency, p.debtAmount),
        cr(trader(p.traderId), p.debtCurrency, p.debtAmount),
    ];
}

/** A5: pay a party from a vault. */
export function payParty(p: { partyId: string; vaultId: string; currency: Currency; amount: string }): LedgerLine[] {
    return [dr(party(p.partyId), p.currency, p.amount), cr(vault(p.vaultId), p.currency, p.amount)];
}

/** A5 cross-currency: we owe the party in one currency and pay in the other. */
export function payPartyFx(p: { partyId: string; vaultId: string; paidCurrency: Currency; paidAmount: string; debtCurrency: Currency; debtAmount: string }): LedgerLine[] {
    return [
        dr(party(p.partyId), p.debtCurrency, p.debtAmount),
        cr(FX, p.debtCurrency, p.debtAmount),
        dr(FX, p.paidCurrency, p.paidAmount),
        cr(vault(p.vaultId), p.paidCurrency, p.paidAmount),
    ];
}

/** A6: pay / refund / advance a trader from a vault. */
export function payTrader(p: { traderId: string; vaultId: string; currency: Currency; amount: string }): LedgerLine[] {
    return [dr(trader(p.traderId), p.currency, p.amount), cr(vault(p.vaultId), p.currency, p.amount)];
}

/** A7: receive money from a party (e.g. a refund). */
export function receiveFromParty(p: { partyId: string; vaultId: string; currency: Currency; amount: string }): LedgerLine[] {
    return [dr(vault(p.vaultId), p.currency, p.amount), cr(party(p.partyId), p.currency, p.amount)];
}

/** A8: owner puts money in. */
export function deposit(p: { vaultId: string; currency: Currency; amount: string }): LedgerLine[] {
    return [dr(vault(p.vaultId), p.currency, p.amount), cr(EQUITY, p.currency, p.amount)];
}

/** A9: owner takes money out. */
export function withdraw(p: { vaultId: string; currency: Currency; amount: string }): LedgerLine[] {
    return [dr(EQUITY, p.currency, p.amount), cr(vault(p.vaultId), p.currency, p.amount)];
}

/** A10: move money between vaults (same currency). */
export function transfer(p: { fromVaultId: string; toVaultId: string; currency: Currency; amount: string }): LedgerLine[] {
    return [dr(vault(p.toVaultId), p.currency, p.amount), cr(vault(p.fromVaultId), p.currency, p.amount)];
}

/** A11: currency exchange (same vault or two vaults) at a typed rate. */
export function exchange(p: { fromVaultId: string; fromCurrency: Currency; fromAmount: string; toVaultId: string; toCurrency: Currency; toAmount: string }): LedgerLine[] {
    return [
        dr(vault(p.toVaultId), p.toCurrency, p.toAmount),
        cr(FX, p.toCurrency, p.toAmount),
        dr(FX, p.fromCurrency, p.fromAmount),
        cr(vault(p.fromVaultId), p.fromCurrency, p.fromAmount),
    ];
}

/** A12: general expense (rent, salaries…). */
export function generalExpense(p: { categoryId: string; vaultId: string; currency: Currency; amount: string }): LedgerLine[] {
    return [dr({ kind: "general_expense", refId: p.categoryId }, p.currency, p.amount), cr(vault(p.vaultId), p.currency, p.amount)];
}

/** A13: opening balance. side "debit" = the account starts with a debit balance (trader عليه, vault cash). */
export function opening(p: { account: AccountRef; currency: Currency; amount: string; side: "debit" | "credit" }): LedgerLine[] {
    return p.side === "debit"
        ? [dr(p.account, p.currency, p.amount), cr(OPENING, p.currency, p.amount)]
        : [dr(OPENING, p.currency, p.amount), cr(p.account, p.currency, p.amount)];
}

/** A15: a party collected from a trader on our behalf. */
export function traderPartyOffset(p: { traderId: string; partyId: string; currency: Currency; amount: string }): LedgerLine[] {
    return [dr(party(p.partyId), p.currency, p.amount), cr(trader(p.traderId), p.currency, p.amount)];
}
