/** What each "تصدير Excel" button downloads (PRD §8.4 containers, §8.7 journal, §8.8 statements). */
import { ENTRY_TYPE_LABEL } from "@/components/app/money/money-kinds";
import type { Currency } from "@/db/schema";
import type { ContainerRow } from "@/features/containers/queries";
import type { Statement } from "@/features/ledger/statements";
import type { JournalRow } from "@/features/money/queries";
import { balanceSide } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { Cell, SheetSpec } from "./workbook";

const date = (v: string | null): Cell => (v ? { date: v } : null);
const money = (amount: string | null | undefined, currency: Currency | null | undefined): Cell => (amount && currency ? { money: amount, currency } : null);

export function containersSheet(rows: ContainerRow[], subtitle: string): SheetSpec {
    return {
        name: "الحاويات",
        title: "الحاويات",
        subtitle,
        columns: [
            { header: "رقم الحاوية", width: 15 },
            { header: "خط الشحن", width: 14 },
            { header: "رقم البوليصة", width: 16 },
            { header: "التاجر", width: 26 },
            { header: "البضاعة", width: 20 },
            { header: "الحالة", width: 18 },
            { header: "تاريخ التسجيل", width: 13 },
            { header: "تاريخ الوصول", width: 13 },
            { header: "تاريخ التسليم", width: 13 },
            { header: "المصاريف بالدولار", width: 16 },
            { header: "المصاريف بالدينار", width: 18 },
        ],
        rows: rows.map((r) => [
            r.containerNumber,
            r.shippingLineName,
            r.billOfLadingNumber,
            r.traderNames.join("، "),
            r.goods,
            t(`status.${r.status}`),
            date(r.registeredOn),
            date(r.arrivedOn),
            date(r.deliveredOn),
            money(r.totals.USD, "USD"),
            money(r.totals.IQD, "IQD"),
        ]),
    };
}

export function journalSheet(rows: JournalRow[], subtitle: string): SheetSpec {
    return {
        name: "سجل المعاملات",
        title: "سجل المعاملات",
        subtitle,
        columns: [
            { header: "رقم الوصل", width: 13 },
            { header: "التاريخ", width: 12 },
            { header: "العملية", width: 22 },
            { header: "من", width: 22 },
            { header: "إلى", width: 22 },
            { header: "المبلغ", width: 16 },
            { header: "ملاحظة", width: 30 },
            { header: "الحالة", width: 20 },
        ],
        rows: rows.map((r) => [
            r.receiptNo,
            date(r.entryDate),
            r.type === "reversal" ? `إلغاء · ${r.reversesType ? ENTRY_TYPE_LABEL[r.reversesType] : ""}` : ENTRY_TYPE_LABEL[r.type],
            r.from || null,
            r.to || null,
            money(r.amount, r.currency),
            r.note,
            r.cancelledAt ? (r.cancelReason ? `ملغى: ${r.cancelReason}` : "ملغى") : r.type === "reversal" ? "قيد إلغاء" : null,
        ]),
    };
}

export interface StatementSheetMeta {
    title: string;
    range: string;
    currency: Currency;
    /** account: عليه / له with the balance in words; vault: داخل / خارج with a signed balance. */
    mode: "account" | "vault";
    withOpening: boolean;
}

export function statementSheet(st: Statement, m: StatementSheetMeta): SheetSpec {
    const account = m.mode === "account";
    // Accounts: the balance as a positive amount plus the side in words; vaults: the signed cash figure.
    const balance = (amount: string): Cell[] => {
        if (!account) return [money(amount, m.currency)];
        const side = balanceSide(amount, m.currency);
        return [money(amount.replace(/^-/, ""), m.currency), t(`balance.${side}`)];
    };
    const amount = (v: string) => (Number(v) !== 0 ? money(v, m.currency) : null);
    const label = account ? { debit: "عليه", credit: "له" } : { debit: "داخل", credit: "خارج" };

    return {
        name: "كشف الحساب",
        title: m.title,
        subtitle: `الفترة: ${m.range} · ${m.currency === "USD" ? "بالدولار" : "بالدينار"}`,
        columns: [
            { header: "التاريخ", width: 12 },
            { header: "الوصل", width: 13 },
            { header: "الحاوية", width: 15 },
            { header: "البيان", width: 36 },
            { header: label.debit, width: 15 },
            { header: label.credit, width: 15 },
            { header: "الرصيد", width: 16 },
            ...(account ? [{ header: "", width: 8 }] : []),
        ],
        rows: [
            ...(m.withOpening ? [[null, null, null, "الرصيد في بداية الفترة", null, null, ...balance(st.opening)]] : []),
            ...st.rows.map((r) => {
                const parts = [r.description, r.memo && r.memo !== r.description ? r.memo : null].filter(Boolean).join(" · ");
                const mark = r.type === "reversal" ? " (قيد إلغاء)" : r.cancelled ? " (ملغى)" : "";
                return [date(r.date), r.receiptNo, r.containerNumber, `${parts}${mark}`, amount(r.debit), amount(r.credit), ...balance(r.balance)];
            }),
        ],
        footer: [null, null, null, "المجموع", money(st.totalDebit, m.currency), money(st.totalCredit, m.currency), ...balance(st.closing)],
    };
}
