import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BalanceText } from "@/components/app/balance-text";
import { LogoMark } from "@/components/app/logo";
import { PrintToolbar } from "@/components/app/print-toolbar";
import { db } from "@/db";
import type { Currency } from "@/db/schema";
import { getContainerCharges, getContainerMoney } from "@/features/charges/queries";
import { getContainer } from "@/features/containers/queries";
import { getCompanySettings } from "@/features/settings/queries";
import { requireSession } from "@/lib/auth";
import { formatDate, formatMoney, formatNumber, todayISO } from "@/lib/format";
import { t } from "@/lib/i18n";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = { title: "طباعة كشف حاوية" };

const moneyLine = (x: Record<Currency, string>) =>
    (["USD", "IQD"] as Currency[])
        .filter((c) => Number(x[c]) !== 0)
        .map((c) => formatMoney(x[c], c))
        .join(" و ") || "0";

/** A4 container sheet (PRD §8.11): details, active charges, totals and each trader's part. */
export default async function PrintContainerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ autoprint?: string }> }) {
    await requireSession();
    const { id } = await params;
    if (!isUuid(id)) notFound();
    const c = await getContainer(db, id);
    if (!c) notFound();
    const [all, company] = await Promise.all([getContainerCharges(db, id), getCompanySettings()]);
    const money = await getContainerMoney(db, id, all);
    const charges = all.filter((x) => !x.cancelledAt);
    const { autoprint } = await searchParams;
    const contact = [company.phone, company.address].filter(Boolean).join(" · ");
    const goods = c.shares
        .map((s) => s.goods)
        .filter(Boolean)
        .join("، ");
    const unit = c.isShared && c.splitUnit ? c.splitUnit : null;

    const info: [string, React.ReactNode][] = [
        [c.isShared ? "التجار" : "التاجر", c.shares.map((s) => s.traderName).join("، ")],
        ["الحالة", t(`status.${c.status}`)],
        ["خط الشحن", c.shippingLineName],
        ["ميناء التحميل", c.portName],
        ["حجم الحاوية", c.sizeLabel],
        ["رقم البوليصة (B/L)", c.billOfLadingNumber ? <bdi className="num">{c.billOfLadingNumber}</bdi> : null],
        ["البضاعة", goods || null],
        ["تاريخ التسجيل", <bdi className="num">{formatDate(c.registeredOn)}</bdi>],
        ["تاريخ الوصول", c.arrivedOn ? <bdi className="num">{formatDate(c.arrivedOn)}</bdi> : null],
        ["تاريخ التسليم", c.deliveredOn ? <bdi className="num">{formatDate(c.deliveredOn)}</bdi> : null],
    ];

    return (
        <>
            <style>
                {
                    "@page { size: A4 portrait; margin: 12mm; } @media print { html, body { background: #fff; } .sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }"
                }
            </style>
            <PrintToolbar autoPrint={autoprint === "1"} backHref={`/containers/${c.id}`} backLabel="رجوع إلى الحاوية" />
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
                            <p className="text-sm text-tertiary">كشف حاوية</p>
                            <p className="cn text-xl">{c.containerNumber}</p>
                        </div>
                    </header>

                    <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-md">
                        {info
                            .filter(([, v]) => v)
                            .map(([label, value]) => (
                                <div key={label} className="flex gap-3">
                                    <dt className="shrink-0 text-tertiary">{label}:</dt>
                                    <dd className="min-w-0">{value}</dd>
                                </div>
                            ))}
                    </dl>

                    {c.isShared && (
                        <section className="flex flex-col gap-2">
                            <h2 className="text-md font-semibold">الحصص</h2>
                            <table className="w-full border-collapse text-md">
                                <thead>
                                    <tr className="border-b border-primary text-sm text-tertiary">
                                        <th className="py-2 text-start font-medium">التاجر</th>
                                        <th className="py-2 text-start font-medium">البضاعة</th>
                                        <th className="py-2 text-end font-medium">الحصة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {c.shares.map((s) => (
                                        <tr key={s.id} className="border-b border-secondary">
                                            <td className="py-2">{s.traderName}</td>
                                            <td className="py-2 text-tertiary">{s.goods ?? "—"}</td>
                                            <td className="py-2 text-end">
                                                {unit === "equal" ? (
                                                    "متساوية"
                                                ) : s.shareValue ? (
                                                    <bdi className="num">{`${formatNumber(s.shareValue)} ${unit ? t(`splitUnitShort.${unit}`) : ""}`}</bdi>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>
                    )}

                    <section className="flex flex-col gap-2">
                        <h2 className="text-md font-semibold">المصاريف</h2>
                        {charges.length ? (
                            <table className="w-full border-collapse text-md">
                                <thead>
                                    <tr className="border-b border-primary text-sm text-tertiary">
                                        <th className="py-2 text-start font-medium">نوع المصروف</th>
                                        <th className="py-2 text-start font-medium">دفعها</th>
                                        {c.isShared && <th className="py-2 text-start font-medium">التوزيع</th>}
                                        <th className="py-2 text-end font-medium">المبلغ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {charges.map((ch) => (
                                        <tr key={ch.id} className="border-b border-secondary align-top">
                                            <td className="py-2">{ch.chargeTypeName}</td>
                                            <td className="py-2 text-tertiary">{ch.payerLabel}</td>
                                            {c.isShared && (
                                                <td className="py-2 text-sm text-tertiary">
                                                    {ch.allocations.map((a) => (
                                                        <span key={a.traderId} className="me-3 inline-block">
                                                            {a.traderName} <bdi className="num">{formatMoney(a.amount, ch.currency)}</bdi>
                                                        </span>
                                                    ))}
                                                </td>
                                            )}
                                            <td className="py-2 text-end">
                                                <bdi className="num">{formatMoney(ch.amount, ch.currency)}</bdi>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-md text-tertiary">لا توجد مصاريف مسجلة على هذه الحاوية.</p>
                        )}
                    </section>

                    <section className="ms-auto flex w-full max-w-sm flex-col gap-1.5 text-md">
                        <p className="flex justify-between gap-4">
                            <span className="text-tertiary">المصاريف</span>
                            <bdi className="num">{moneyLine(money.costs)}</bdi>
                        </p>
                        <p className="flex justify-between gap-4">
                            <span className="text-tertiary">الأتعاب</span>
                            <bdi className="num">{moneyLine(money.fees)}</bdi>
                        </p>
                        <p className="flex justify-between gap-4 border-t border-primary pt-1.5 font-semibold">
                            <span>المجموع</span>
                            <bdi className="num">{moneyLine(money.total)}</bdi>
                        </p>
                        {money.traders.map((tr) => (
                            <div key={tr.traderId} className="flex flex-col gap-0.5 border-t border-secondary pt-1.5">
                                <p className="flex justify-between gap-4">
                                    <span>على {tr.name}</span>
                                    <bdi className="num">{moneyLine(tr.part)}</bdi>
                                </p>
                                <p className="flex justify-between gap-4 text-sm">
                                    <span className="text-tertiary">رصيده الكلي اليوم</span>
                                    <BalanceText amounts={tr.balance} />
                                </p>
                            </div>
                        ))}
                    </section>

                    <footer className="mt-6 flex items-end justify-between gap-8 text-sm text-tertiary">
                        <p>
                            طُبع في <bdi className="num">{formatDate(todayISO())}</bdi>
                        </p>
                        <p className="w-48 border-t border-dashed border-primary pt-2 text-center">التوقيع</p>
                    </footer>
                </article>
            </main>
        </>
    );
}
