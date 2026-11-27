import type { AccountKind, Currency, EntryType, ReceiptKind } from "@/db/schema";

/** Which account a line hits. Accounts are created lazily per (kind, refId, currency). */
export interface AccountRef {
    kind: AccountKind;
    refId?: string | null;
}

export interface LedgerLine {
    account: AccountRef;
    currency: Currency;
    debit?: string;
    credit?: string;
    memo?: string | null;
}

export interface PostEntryInput {
    type: EntryType;
    /** yyyy-mm-dd */
    date: string;
    /** When set, the next receipt number of this kind is assigned inside the transaction. */
    receiptKind?: ReceiptKind | null;
    description: string;
    counterpartyLabel?: string | null;
    /** Headline amount for lists and the printed receipt (balances never read it). */
    amount?: string | null;
    currency?: Currency | null;
    containerId?: string | null;
    /** Containers this entry mentions (receipts can tag containers; no math). */
    containerTags?: string[];
    fxRate?: string | null;
    meta?: Record<string, unknown>;
    userId?: string | null;
    reversesEntryId?: string | null;
    lines: LedgerLine[];
}

export interface PostEntryResult {
    entryId: string;
    receiptNo: string | null;
}
