import { LogoMark } from "@/components/app/logo";
import type { ReceiptView } from "@/features/money/queries";
import { formatDate, formatMoney } from "@/lib/format";
import { cx } from "@/utils/cx";

/**
 * The receipt as printed (PRD §6.5): company and number at the top, the labelled lines, the amount
 * in figures and in words, two signature lines, and a large "ملغى" watermark when cancelled.
 * Used by the on-screen preview and by /print/receipt/[id], so both always match.
 */
export function ReceiptDocument({ r, className, id }: { r: ReceiptView; className?: string; id?: string }) {
    const contact = [r.company.phone, r.company.address].filter(Boolean).join(" · ");
    return (
        <article
            id={id}
            aria-label={`${r.title} ${r.receiptNo}`}
            className={cx("receipt relative isolate flex flex-col gap-5 overflow-hidden bg-white p-6 text-primary sm:p-8", className)}
        >
            {r.cancelledAt && (
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 -z-10 flex [transform:rotate(-24deg)] items-center justify-center text-[7rem] leading-none font-semibold text-error-primary/15 select-none"
                >
                    ملغى
                </span>
            )}

            <header className="flex items-start justify-between gap-4 border-b border-primary pb-4">
                <div className="flex min-w-0 items-start gap-3">
                    <LogoMark className="size-10" />
                    <div className="min-w-0">
                        <p className="text-lg font-semibold">{r.company.name}</p>
                        {contact && <p className="text-sm text-tertiary">{contact}</p>}
                    </div>
                </div>
                <div className="shrink-0 rounded-lg border border-primary px-3 py-1.5 text-center">
                    <p className="text-sm font-semibold">{r.title}</p>
                    <p className="num text-lg font-semibold">
                        <bdi>{r.receiptNo}</bdi>
                    </p>
                </div>
            </header>

            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-md">
                <dt className="text-tertiary">التاريخ</dt>
                <dd>
                    <bdi className="num">{formatDate(r.date)}</bdi>
                </dd>
                {r.lines.map(([label, value], i) => (
                    <div key={`${label}-${i}`} className="contents">
                        <dt className="text-tertiary">{label}</dt>
                        <dd className="min-w-0 break-words">
                            <bdi>{value}</bdi>
                        </dd>
                    </div>
                ))}
                {r.containerNumber && !r.lines.some(([, v]) => v.includes(r.containerNumber!)) && (
                    <>
                        <dt className="text-tertiary">الحاوية</dt>
                        <dd>
                            <bdi className="cn">{r.containerNumber}</bdi>
                        </dd>
                    </>
                )}
            </dl>

            <div className="flex flex-col gap-1 rounded-lg border border-primary px-4 py-3">
                <p className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <span className="text-tertiary">المبلغ</span>
                    <bdi className="num text-display-xs font-semibold">{formatMoney(r.amount, r.currency)}</bdi>
                </p>
                <p className="text-md">
                    <span className="text-tertiary">فقط: </span>
                    {r.words}
                </p>
            </div>

            {r.cancelledAt && (
                <p className="text-sm font-semibold text-error-primary">
                    ملغى{r.cancelReason ? ` · السبب: ${r.cancelReason}` : ""}
                    {r.cancelledBy?.receiptNo && (
                        <>
                            {" · وصل الإلغاء "}
                            <bdi className="num">{r.cancelledBy.receiptNo}</bdi>
                        </>
                    )}
                </p>
            )}

            <footer className="mt-4 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-8 pt-6 text-sm text-tertiary">
                    <p className="border-t border-dashed border-primary pt-2">توقيع المستلم</p>
                    <p className="border-t border-dashed border-primary pt-2">توقيع المسلِّم</p>
                </div>
                {r.company.footer && <p className="text-center text-xs text-quaternary">{r.company.footer}</p>}
            </footer>
        </article>
    );
}
