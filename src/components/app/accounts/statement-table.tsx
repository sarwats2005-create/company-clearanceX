import type { Currency } from "@/db/schema";
import type { Statement, StatementRow } from "@/features/ledger/statements";
import { balanceSide, formatDate, formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";

/** "account": traders and parties read عليه / له. "vault": money in / out and a plain balance. */
export type StatementMode = "account" | "vault";

export const COLUMN_LABEL: Record<StatementMode, { debit: string; credit: string }> = {
    account: { debit: "عليه", credit: "له" },
    vault: { debit: "داخل", credit: "خارج" },
};

const TONE = { owesUs: "text-error-primary", weOwe: "text-success-primary", settled: "text-tertiary" } as const;

/** A running balance in the owner's words (account) or as a plain amount (vault). */
export function RunningBalance({ amount, currency, mode, className }: { amount: string; currency: Currency; mode: StatementMode; className?: string }) {
    if (mode === "vault") {
        return (
            <bdi className={cx("num whitespace-nowrap", amount.startsWith("-") ? "text-error-primary" : "text-primary", className)}>
                {formatMoney(amount, currency)}
            </bdi>
        );
    }
    const side = balanceSide(amount, currency);
    if (side === "settled") return <span className={cx(TONE.settled, className)}>{t("balance.settled")}</span>;
    return (
        <span className={cx("whitespace-nowrap", TONE[side], className)}>
            {t(`balance.${side}`)} <bdi className="num">{formatMoney(amount.replace(/^-/, ""), currency)}</bdi>
        </span>
    );
}

const isZero = (x: string) => Number(x) === 0;

function Ref({ r }: { r: StatementRow }) {
    if (!r.receiptNo && !r.containerNumber) return <span className="text-quaternary">—</span>;
    return (
        <span className="flex flex-col">
            {r.receiptNo && (
                <a href={`/money/receipts/${r.entryId}`} className="self-start rounded-sm outline-focus-ring hover:underline focus-visible:outline-2">
                    <bdi className="num">{r.receiptNo}</bdi>
                </a>
            )}
            {r.containerNumber && r.containerId && (
                <a
                    href={`/containers/${r.containerId}`}
                    className={cx("self-start rounded-sm outline-focus-ring hover:underline focus-visible:outline-2", r.receiptNo && "text-sm text-tertiary")}
                >
                    <bdi className="cn">{r.containerNumber}</bdi>
                </a>
            )}
        </span>
    );
}

function State({ r }: { r: StatementRow }) {
    if (r.type === "reversal") return <span className="text-sm text-tertiary">قيد إلغاء</span>;
    if (r.cancelled) return <span className="text-sm text-error-primary">ملغى</span>;
    return null;
}

function Description({ r }: { r: StatementRow }) {
    return (
        <span className="flex min-w-0 flex-col">
            <span className={cx("text-secondary", r.cancelled && "text-tertiary")}>{r.description}</span>
            {r.memo && r.memo !== r.description && <span className="text-sm text-tertiary">{r.memo}</span>}
            <State r={r} />
        </span>
    );
}

function Amount({ value, currency, muted }: { value: string; currency: Currency; muted?: boolean }) {
    if (isZero(value)) return null;
    return <bdi className={cx("num whitespace-nowrap", muted ? "text-tertiary" : "text-primary")}>{formatMoney(value, currency)}</bdi>;
}

/**
 * Statement with an opening row for the range, the running balance on every line, and a totals row (PRD §8.8).
 * A table on wide screens, stacked rows on phones. Cancelled receipts stay, next to the line that cancels them.
 */
export function StatementTable({
    statement: st,
    currency,
    mode,
    showOpening,
}: {
    statement: Statement;
    currency: Currency;
    mode: StatementMode;
    showOpening: boolean;
}) {
    const col = COLUMN_LABEL[mode];
    if (!st.rows.length && !showOpening) {
        return <p className="rounded-2xl bg-secondary py-12 text-center text-md text-tertiary">لا توجد حركات بهذه العملة بعد.</p>;
    }

    return (
        <>
            <div className="hidden md:block">
                <table className="w-full table-fixed border-collapse text-md">
                    <thead>
                        <tr className="border-b border-secondary text-sm text-tertiary">
                            <th scope="col" className="w-[11%] px-3 py-3 text-start font-medium">
                                التاريخ
                            </th>
                            <th scope="col" className="w-[15%] px-3 py-3 text-start font-medium">
                                الوصل / الحاوية
                            </th>
                            <th scope="col" className="px-3 py-3 text-start font-medium">
                                البيان
                            </th>
                            <th scope="col" className="w-[14%] px-3 py-3 text-end font-medium">
                                {col.debit}
                            </th>
                            <th scope="col" className="w-[14%] px-3 py-3 text-end font-medium">
                                {col.credit}
                            </th>
                            <th scope="col" className="w-[17%] px-3 py-3 text-end font-medium">
                                الرصيد
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {showOpening && (
                            <tr className="bg-secondary_subtle border-b border-secondary">
                                <td className="px-3 py-3" />
                                <td className="px-3 py-3" />
                                <td className="px-3 py-3 text-secondary">الرصيد في بداية الفترة</td>
                                <td className="px-3 py-3" />
                                <td className="px-3 py-3" />
                                <td className="px-3 py-3 text-end">
                                    <RunningBalance amount={st.opening} currency={currency} mode={mode} />
                                </td>
                            </tr>
                        )}
                        {st.rows.map((r) => (
                            <tr key={r.lineId} className="border-b border-secondary align-top">
                                <td className="px-3 py-3.5 text-tertiary">
                                    <bdi className="num">{formatDate(r.date)}</bdi>
                                </td>
                                <td className="px-3 py-3.5 text-secondary">
                                    <Ref r={r} />
                                </td>
                                <td className="px-3 py-3.5">
                                    <Description r={r} />
                                </td>
                                <td className="px-3 py-3.5 text-end">
                                    <Amount value={r.debit} currency={currency} muted={r.cancelled} />
                                </td>
                                <td className="px-3 py-3.5 text-end">
                                    <Amount value={r.credit} currency={currency} muted={r.cancelled} />
                                </td>
                                <td className="px-3 py-3.5 text-end">
                                    <RunningBalance amount={r.balance} currency={currency} mode={mode} />
                                </td>
                            </tr>
                        ))}
                        {!st.rows.length && (
                            <tr className="border-b border-secondary">
                                <td colSpan={6} className="px-3 py-8 text-center text-tertiary">
                                    لا توجد حركات في هذه الفترة.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot>
                        <tr className="border-b border-primary font-semibold text-primary">
                            <td colSpan={3} className="px-3 py-3.5">
                                المجموع والرصيد في نهاية الفترة
                            </td>
                            <td className="px-3 py-3.5 text-end">
                                <bdi className="num whitespace-nowrap">{formatMoney(st.totalDebit, currency)}</bdi>
                            </td>
                            <td className="px-3 py-3.5 text-end">
                                <bdi className="num whitespace-nowrap">{formatMoney(st.totalCredit, currency)}</bdi>
                            </td>
                            <td className="px-3 py-3.5 text-end">
                                <RunningBalance amount={st.closing} currency={currency} mode={mode} />
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <ul className="flex flex-col divide-y divide-secondary md:hidden">
                {showOpening && (
                    <li className="flex items-baseline justify-between gap-3 py-3.5">
                        <span className="text-secondary">الرصيد في بداية الفترة</span>
                        <RunningBalance amount={st.opening} currency={currency} mode={mode} />
                    </li>
                )}
                {st.rows.map((r) => {
                    const debit = !isZero(r.debit);
                    return (
                        <li key={r.lineId} className="flex flex-col gap-1 py-3.5">
                            <div className="flex items-baseline justify-between gap-3">
                                <Description r={r} />
                                <span className="shrink-0 text-end whitespace-nowrap">
                                    <span className="text-sm text-tertiary">{debit ? col.debit : col.credit} </span>
                                    <Amount value={debit ? r.debit : r.credit} currency={currency} muted={r.cancelled} />
                                </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-3 text-sm text-tertiary">
                                <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-2">
                                    <bdi className="num">{formatDate(r.date)}</bdi>
                                    {r.receiptNo && <bdi className="num">{r.receiptNo}</bdi>}
                                </span>
                                <span className="shrink-0">
                                    الرصيد <RunningBalance amount={r.balance} currency={currency} mode={mode} />
                                </span>
                            </div>
                        </li>
                    );
                })}
                {!st.rows.length && <li className="py-8 text-center text-tertiary">لا توجد حركات في هذه الفترة.</li>}
                <li className="flex flex-col gap-1 py-3.5">
                    <div className="flex items-baseline justify-between gap-3 font-semibold text-primary">
                        <span>الرصيد في نهاية الفترة</span>
                        <RunningBalance amount={st.closing} currency={currency} mode={mode} />
                    </div>
                    <p className="text-sm text-tertiary">
                        مجموع {col.debit} <bdi className="num">{formatMoney(st.totalDebit, currency)}</bdi> · مجموع {col.credit}{" "}
                        <bdi className="num">{formatMoney(st.totalCredit, currency)}</bdi>
                    </p>
                </li>
            </ul>
        </>
    );
}
