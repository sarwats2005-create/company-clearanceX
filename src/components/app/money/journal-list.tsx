import { ChevronLeft } from "@untitledui/icons";
import type { JournalRow } from "@/features/money/queries";
import { formatDate, formatMoney } from "@/lib/format";
import { cx } from "@/utils/cx";
import { ENTRY_TYPE_LABEL, GROUP_COLOR, RECEIPT_KIND_GROUP } from "./money-kinds";

const hrefOf = (r: JournalRow) => (r.receiptNo ? `/money/receipts/${r.id}` : r.containerId ? `/containers/${r.containerId}` : null);

function TypeLabel({ r }: { r: JournalRow }) {
    const isCancel = r.type === "reversal";
    const dot = isCancel || !r.receiptKind ? "bg-fg-quaternary" : GROUP_COLOR[RECEIPT_KIND_GROUP[r.receiptKind]];
    return (
        <span className="inline-flex min-w-0 items-center gap-2 text-sm text-secondary">
            <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", dot)} />
            <span className="truncate">{isCancel ? `إلغاء · ${r.reversesType ? ENTRY_TYPE_LABEL[r.reversesType] : ""}` : ENTRY_TYPE_LABEL[r.type]}</span>
        </span>
    );
}

function Flow({ r }: { r: JournalRow }) {
    if (!r.from && !r.to) return <span className="text-quaternary">—</span>;
    return (
        <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5">
            <bdi className="truncate">{r.from || "—"}</bdi>
            <ChevronLeft className="size-4 shrink-0 text-fg-quaternary" aria-label="إلى" />
            <bdi className="truncate">{r.to || "—"}</bdi>
        </span>
    );
}

function Amount({ r }: { r: JournalRow }) {
    if (!r.amount || !r.currency) return <span className="text-quaternary">—</span>;
    return (
        <bdi
            className={cx("num whitespace-nowrap", r.cancelledAt || r.type === "reversal" ? "text-tertiary" : "text-primary", r.cancelledAt && "line-through")}
        >
            {formatMoney(r.amount, r.currency)}
        </bdi>
    );
}

function State({ r }: { r: JournalRow }) {
    if (r.cancelledAt) return <span className="text-sm text-error-primary">ملغى</span>;
    if (r.type === "reversal") return <span className="text-sm text-tertiary">قيد إلغاء</span>;
    return null;
}

/** The journal (PRD §8.7 سجل المعاملات): a table on wide screens, stacked rows on phones. Rows open the receipt. */
export function JournalList({ rows, empty }: { rows: JournalRow[]; empty?: React.ReactNode }) {
    if (!rows.length) return <>{empty}</>;
    return (
        <>
            <div className="hidden md:block">
                <table className="w-full table-fixed border-collapse text-md">
                    <thead>
                        <tr className="border-b border-secondary text-start text-sm text-tertiary">
                            <th scope="col" className="w-[13%] px-3 py-3 text-start font-medium">
                                الوصل
                            </th>
                            <th scope="col" className="w-[11%] px-3 py-3 text-start font-medium">
                                التاريخ
                            </th>
                            <th scope="col" className="w-[18%] px-3 py-3 text-start font-medium">
                                العملية
                            </th>
                            <th scope="col" className="px-3 py-3 text-start font-medium">
                                من ← إلى
                            </th>
                            <th scope="col" className="w-[15%] px-3 py-3 text-end font-medium">
                                المبلغ
                            </th>
                            <th scope="col" className="w-[9%] px-3 py-3 text-start font-medium">
                                الحالة
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => {
                            const href = hrefOf(r);
                            return (
                                <tr key={r.id} className="group relative border-b border-secondary transition-colors duration-100 hover:bg-primary_hover">
                                    <td className="px-3 py-3.5">
                                        {href ? (
                                            <a
                                                href={href}
                                                className="outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:outline-focus-ring"
                                            >
                                                <bdi className="num font-semibold text-primary">{r.receiptNo ?? "—"}</bdi>
                                            </a>
                                        ) : (
                                            <bdi className="num text-quaternary">—</bdi>
                                        )}
                                    </td>
                                    <td className="px-3 py-3.5 text-tertiary">
                                        <bdi className="num">{formatDate(r.entryDate)}</bdi>
                                    </td>
                                    <td className="px-3 py-3.5">
                                        <TypeLabel r={r} />
                                    </td>
                                    <td className="px-3 py-3.5 text-secondary">
                                        <Flow r={r} />
                                        {r.note && <p className="truncate text-sm text-tertiary">{r.note}</p>}
                                    </td>
                                    <td className="px-3 py-3.5 text-end">
                                        <Amount r={r} />
                                    </td>
                                    <td className="px-3 py-3.5">
                                        <State r={r} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <ul className="flex flex-col divide-y divide-secondary border-y border-secondary md:hidden">
                {rows.map((r) => {
                    const href = hrefOf(r);
                    const body = (
                        <>
                            <div className="flex items-baseline justify-between gap-3">
                                <TypeLabel r={r} />
                                <Amount r={r} />
                            </div>
                            <div className="text-md text-secondary">
                                <Flow r={r} />
                            </div>
                            <div className="flex items-baseline justify-between gap-3 text-sm text-tertiary">
                                <span className="inline-flex gap-2">
                                    <bdi className="num">{r.receiptNo ?? ""}</bdi>
                                    <bdi className="num">{formatDate(r.entryDate)}</bdi>
                                </span>
                                {(r.cancelledAt || r.type === "reversal") && <State r={r} />}
                            </div>
                        </>
                    );
                    return (
                        <li key={r.id}>
                            {href ? (
                                <a
                                    href={href}
                                    className="flex flex-col gap-1 py-3.5 outline-focus-ring transition-colors duration-100 focus-visible:outline-2 active:bg-primary_hover"
                                >
                                    {body}
                                </a>
                            ) : (
                                <div className="flex flex-col gap-1 py-3.5">{body}</div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </>
    );
}
