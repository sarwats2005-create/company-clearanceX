import type { FC, SVGProps } from "react";
import { ArrowCircleDown, ArrowCircleUp, Building07, CoinsSwap01, Receipt, SwitchHorizontal01, User01 } from "@untitledui/icons";
import type { EntryType, ReceiptKind } from "@/db/schema";
import type { MoneyKind } from "@/features/money/schemas";

export type MoneyGroup = "in" | "out" | "internal";

export const MONEY_KIND_META: Record<MoneyKind, { title: string; hint: string; icon: FC<SVGProps<SVGSVGElement>>; group: MoneyGroup }> = {
    receive_trader: { title: "قبض من تاجر", hint: "تاجر يسدد ما عليه", icon: User01, group: "in" },
    receive_party: { title: "قبض من جهة", hint: "شركة أو شريك يرجع لنا مبلغاً", icon: Building07, group: "in" },
    deposit: { title: "إيداع", hint: "المالك يضع مالاً في القاصة", icon: ArrowCircleDown, group: "in" },
    pay_party: { title: "دفع لجهة", hint: "تسديد ما علينا لشركة أو شريك", icon: Building07, group: "out" },
    pay_trader: { title: "دفع لتاجر", hint: "إرجاع مبلغ أو سلفة لتاجر", icon: User01, group: "out" },
    withdraw: { title: "سحب", hint: "المالك يأخذ مالاً من القاصة", icon: ArrowCircleUp, group: "out" },
    expense: { title: "مصروف عام", hint: "إيجار، رواتب، وقود وغيرها", icon: Receipt, group: "out" },
    transfer: { title: "تحويل بين القاصات", hint: "نقل مبلغ من قاصة إلى أخرى", icon: SwitchHorizontal01, group: "internal" },
    exchange: { title: "تصريف عملة", hint: "دينار ⇄ دولار بسعر صرف تكتبه", icon: CoinsSwap01, group: "internal" },
};

export const MONEY_GROUPS: { group: MoneyGroup; title: string; kinds: MoneyKind[] }[] = [
    { group: "in", title: "دخول مال", kinds: ["receive_trader", "receive_party", "deposit"] },
    { group: "out", title: "خروج مال", kinds: ["pay_party", "pay_trader", "withdraw", "expense"] },
    { group: "internal", title: "بين القاصات", kinds: ["transfer", "exchange"] },
];

/** Money direction: green in, red out, blue between vaults (PRD §8.7), as a strip or a dot. */
export const GROUP_COLOR: Record<MoneyGroup, string> = { in: "bg-success-solid", out: "bg-error-solid", internal: "bg-utility-blue-500" };

export const RECEIPT_KIND_GROUP: Record<ReceiptKind, MoneyGroup> = { in: "in", out: "out", transfer: "internal", exchange: "internal" };
export const RECEIPT_KIND_LABEL: Record<ReceiptKind, string> = { in: "وصل قبض", out: "وصل صرف", transfer: "وصل تحويل", exchange: "وصل تصريف" };

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
    container_charge: "مصروف حاوية",
    receive_from_trader: "قبض من تاجر",
    receive_from_party: "قبض من جهة",
    pay_party: "دفع لجهة",
    pay_trader: "دفع لتاجر",
    deposit: "إيداع",
    withdraw: "سحب",
    transfer: "تحويل",
    exchange: "تصريف عملة",
    general_expense: "مصروف عام",
    opening_balance: "رصيد افتتاحي",
    trader_party_offset: "تسوية",
    reversal: "إلغاء",
};

/** A balance as plain words for a picker's second line (shared with statements). */
export { balanceWords } from "@/features/accounts/model";
