import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { COLUMN_LABEL, RunningBalance } from "@/components/app/accounts/statement-table";
import { LogoMark } from "@/components/app/logo";
import { PrintToolbar } from "@/components/app/print-toolbar";
import { db } from "@/db";
import {
    ACCOUNT_SEGMENTS,
    type AccountSegment,
    CURRENCY_IN,
    LEDGER_KIND,
    defaultCurrency,
    parseStatementParams,
    rangeText,
    statementQuery,
} from "@/features/accounts/model";
import { getStatementTarget } from "@/features/accounts/queries";
import { getStatement } from "@/features/ledger/statements";
import { getCompanySettings } from "@/features/settings/queries";
import { requireSession } from "@/lib/auth";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = { title: "طباعة كشف حساب" };

type Params = Promise<{ kind: string; id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

const SIGNATURE: Record<AccountSegment, string> = { traders: "توقيع التاجر", parties: "توقيع الجهة", vaults: "توقيع أمين القاصة" };

/** A4 statement (PRD §8.8): company header, the range, every movement with its running balance, totals and signatures. */
export default async function PrintStatementPage({ params, searchParams }: { params: Params; searchParams: Search }) {
    await requireSession();
    const { kind, id } = await params;
    const segment = ACCOUNT_SEGMENTS.find((s) => s === kind);
    if (!segment || !isUuid(id)) notFound();
    const target = await getStatementTarget(db, segment, id);
    if (!target) notFound();
    const sp = await searchParams;
    const today = todayISO();
    const p = parseStatementParams(sp, today);
    const currency = defaultCurrency(target.currencies, target.balance, p.currency);
    const [st, company] = await Promise.all([getStatement(db, { kind: LEDGER_KIND[segment], refId: id }, currency, p.from, p.to), getCompanySettings()]);
    const mode = segment === "vaults" ? "vault" : "account";
    const col = COLUMN_LABEL[mode];
    const contact = [company.phone, company.address].filter(Boolean).join(" · ");

    return (
        <>
            <style>
                {
                    "@page { size: A4 portrait; margin: 12mm; } @media print { html, body { background: #fff; } .sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact; } tr { break-inside: avoid; } }"
                }
            </style>
            <PrintToolbar
                autoPrint={sp.autoprint === "1"}
                backHref={`/accounts/${segment}/${id}${statementQuery({ ...p, currency }, {})}`}
                backLabel="رجوع إلى الحساب"
            />
            <main className="flex justify-center-safe overflow-x-auto bg-secondary px-4 py-8 print:overflow-visible print:bg-white print:p-0">
                <article className="sheet flex w-full max-w-[210mm] min-w-[36rem] flex-col gap-6 bg-white p-8 text-primary shadow-lg print:max-w-none print:p-0 print:shadow-none">
                    <header className="flex items-start justify-between gap-4 border-b border-primary pb-4">
                        <div className="flex min-w-0 items-start gap-3">
                            <LogoMark className="size-10" />
                            <div>
                                <p className="text-lg font-semibold">{company.name}</p>
                                {contact && <p className="text-sm text-tertiary">{contact}</p>}
                            </div>
                        </div>
                        <div className="text-end">
                            <p className="text-sm text-tertiary">{segment === "vaults" ? "كشف حركة قاصة" : "كشف حساب"}</p>
                            <p className="text-xl font-semibold">{target.name}</p>
                        </div>
                    </header>

                    <p className="flex flex-wrap justify-between gap-x-6 gap-y-1 text-md">
                        <span>
                            <span className="text-tertiary">الفترة: </span>
                            {rangeText(p.from, p.to)}
                        </span>
                        <span>
                            <span className="text-tertiary">العملة: </span>
                            {CURRENCY_IN[currency].replace(/^بال/, "ال")}
                        </span>
                    </p>

                    <table className="w-full table-fixed border-collapse text-md">
                        <thead>
                            <tr className="border-b border-primary text-sm text-tertiary">
                                <th className="w-[13%] py-2 pe-3 text-start font-medium">التاريخ</th>
                                <th className="w-[16%] py-2 pe-3 text-start font-medium">الوصل / الحاوية</th>
                                <th className="py-2 pe-3 text-start font-medium">البيان</th>
                                <th className="w-[14%] py-2 pe-3 text-end font-medium">{col.debit}</th>
                                <th className="w-[14%] py-2 pe-3 text-end font-medium">{col.credit}</th>
                                <th className="w-[18%] py-2 text-end font-medium">الرصيد</th>
                            </tr>
                        </thead>
                        <tbody>
                            {p.from && (
                                <tr className="border-b border-secondary">
                                    <td className="py-2 pe-3" colSpan={5}>
                                        الرصيد في بداية الفترة
                                    </td>
                                    <td className="py-2 text-end">
                                        <RunningBalance amount={st.opening} currency={currency} mode={mode} />
                                    </td>
                                </tr>
                            )}
                            {st.rows.map((r) => (
                                <tr key={r.lineId} className="border-b border-secondary align-top">
                                    <td className="py-2 pe-3 whitespace-nowrap">
                                        <bdi className="num">{formatDate(r.date)}</bdi>
                                    </td>
                                    <td className="py-2 pe-3">
                                        {r.receiptNo && <bdi className="num block">{r.receiptNo}</bdi>}
                                        {r.containerNumber && <bdi className="cn block w-fit text-sm">{r.containerNumber}</bdi>}
                                        {!r.receiptNo && !r.containerNumber && "—"}
                                    </td>
                                    <td className="py-2 pe-3">
                                        {r.description}
                                        {r.memo && r.memo !== r.description && <span className="block text-sm text-tertiary">{r.memo}</span>}
                                        {r.type === "reversal" ? (
                                            <span className="block text-sm text-tertiary">قيد إلغاء</span>
                                        ) : (
                                            r.cancelled && <span className="block text-sm">(ملغى)</span>
                                        )}
                                    </td>
                                    <td className="py-2 pe-3 text-end">
                                        {Number(r.debit) !== 0 && <bdi className="num whitespace-nowrap">{formatMoney(r.debit, currency)}</bdi>}
                                    </td>
                                    <td className="py-2 pe-3 text-end">
                                        {Number(r.credit) !== 0 && <bdi className="num whitespace-nowrap">{formatMoney(r.credit, currency)}</bdi>}
                                    </td>
                                    <td className="py-2 text-end">
                                        <RunningBalance amount={r.balance} currency={currency} mode={mode} />
                                    </td>
                                </tr>
                            ))}
                            {!st.rows.length && (
                                <tr className="border-b border-secondary">
                                    <td colSpan={6} className="py-6 text-center text-tertiary">
                                        لا توجد حركات في هذه الفترة.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="border-b border-primary font-semibold">
                                <td className="py-2 pe-3" colSpan={3}>
                                    المجموع
                                </td>
                                <td className="py-2 pe-3 text-end">
                                    <bdi className="num whitespace-nowrap">{formatMoney(st.totalDebit, currency)}</bdi>
                                </td>
                                <td className="py-2 pe-3 text-end">
                                    <bdi className="num whitespace-nowrap">{formatMoney(st.totalCredit, currency)}</bdi>
                                </td>
                                <td className="py-2 text-end">
                                    <RunningBalance amount={st.closing} currency={currency} mode={mode} />
                                </td>
                            </tr>
                        </tfoot>
                    </table>

                    <p className="ms-auto flex items-baseline gap-3 text-lg font-semibold">
                        <span className="text-md font-normal text-tertiary">الرصيد في نهاية الفترة</span>
                        <RunningBalance amount={st.closing} currency={currency} mode={mode} />
                    </p>

                    <footer className="mt-8 flex items-end justify-between gap-8 text-sm text-tertiary">
                        <p>
                            طُبع في <bdi className="num">{formatDate(today)}</bdi>
                        </p>
                        <div className="flex gap-8">
                            <p className="w-40 border-t border-dashed border-primary pt-2 text-center">توقيع المحاسب</p>
                            <p className="w-40 border-t border-dashed border-primary pt-2 text-center">{SIGNATURE[segment]}</p>
                        </div>
                    </footer>
                </article>
            </main>
        </>
    );
}
