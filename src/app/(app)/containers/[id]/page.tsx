import { ArrowLeft, ArrowRight, ClockRewind, Edit05, InfoCircle, Receipt, Route, Users01 } from "@untitledui/icons";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddChargesButton, ChargesSheetProvider } from "@/components/app/charges-sheet";
import { ChargesSection, ResplitAlert } from "@/components/app/containers/charges-section";
import { ContainerMenu } from "@/components/app/containers/container-menu";
import { SharesCard } from "@/components/app/containers/shares-card";
import { StatusSteps } from "@/components/app/containers/status-steps";
import { CardTitle, IconTile } from "@/components/app/icon-tile";
import { ShippingLineLogo } from "@/components/app/shipping-line-logo";
import { StatusDot } from "@/components/app/status-dot";
import { WhatsAppShareButton } from "@/components/app/whatsapp-share";
import { Button } from "@/components/base/buttons/button";
import { db } from "@/db";
import { type ContainerStatus, containers } from "@/db/schema";
import { type ContainerChargeRow, getChargeSheetData, getContainerCharges, getContainerMoney } from "@/features/charges/queries";
import { planResplit } from "@/features/charges/service";
import { type ContainerDetail, getContainer } from "@/features/containers/queries";
import { capacityFor } from "@/features/containers/shares";
import { requireSession } from "@/lib/auth";
import { formatDate, formatDateTime, formatMoney, formatNumber, todayISO, tradersText } from "@/lib/format";
import { t } from "@/lib/i18n";
import { isUuid } from "@/lib/ids";
import { cx } from "@/utils/cx";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    if (!isUuid(id)) return { title: "الحاوية" };
    const [row] = await db.select({ n: containers.containerNumber }).from(containers).where(eq(containers.id, id));
    return { title: row ? `الحاوية ${row.n}` : "الحاوية" };
}

function reachedDates(c: ContainerDetail): Partial<Record<ContainerStatus, string>> {
    const out: Partial<Record<ContainerStatus, string>> = {};
    for (const h of c.history) out[h.toStatus] = h.changedOn;
    if (c.arrivedOn) out.arrived = c.arrivedOn;
    if (c.deliveredOn) out.delivered = c.deliveredOn;
    return out;
}

const moneyText = (x: Record<"IQD" | "USD", string>) =>
    (["USD", "IQD"] as const)
        .filter((cur) => Number(x[cur]) !== 0)
        .map((cur) => formatMoney(x[cur], cur))
        .join(" و ");

function shareText(c: ContainerDetail, total?: Record<"IQD" | "USD", string>) {
    const sum = total ? moneyText(total) : "";
    return [
        `الحاوية ${c.containerNumber}`,
        `الحالة: ${t(`status.${c.status}`)}`,
        `التاجر: ${c.shares.map((s) => s.traderName).join("، ")}`,
        `خط الشحن: ${c.shippingLineName}`,
        c.billOfLadingNumber ? `البوليصة: ${c.billOfLadingNumber}` : null,
        c.arrivedOn ? `تاريخ الوصول: ${formatDate(c.arrivedOn)}` : null,
        sum ? `مجموع المصاريف: ${sum}` : null,
    ]
        .filter(Boolean)
        .join("\n");
}

export default async function ContainerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
    await requireSession();
    const { id } = await params;
    const justAdded = (await searchParams).new === "1";
    if (!isUuid(id)) notFound();
    const c = await getContainer(db, id);
    if (!c) notFound();
    const today = todayISO();
    const archived = !!c.archivedAt;
    const charges = await getContainerCharges(db, id);
    const [money, sheetData, resplit] = await Promise.all([
        getContainerMoney(db, id, charges),
        archived ? null : getChargeSheetData(db, id),
        archived || !c.isShared ? [] : planResplit(db, id),
    ]);
    const goods = c.shares.map((s) => s.goods).filter(Boolean);
    const meta = [c.shares.map((s) => s.traderName).join("، "), goods.join("، "), c.sizeLabel, c.shippingLineName, c.portName].filter(Boolean) as string[];

    return (
        <ChargesSheetProvider data={sheetData} today={today} startInFlow={justAdded && c.activeCharges === 0}>
            <div className="flex flex-col gap-6 max-lg:pb-20">
                <a href="/containers" className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-md text-sm text-tertiary outline-focus-ring hover:text-secondary focus-visible:outline-2">
                    <ArrowRight className="size-4" aria-hidden="true" />
                    الحاويات
                </a>

                {/* This card is also the picture sent on WhatsApp. */}
                <header id="container-card" className="surface rise-in relative flex flex-col gap-5 overflow-hidden p-5 md:p-6">
                    <span aria-hidden="true" className="bg-brand-gradient absolute inset-x-0 top-0 h-1.5" />
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                            <ShippingLineLogo line={{ name: c.shippingLineName, logo: c.shippingLineLogo, website: c.shippingLineWebsite }} size="xl" />
                            <div className="flex min-w-0 flex-col gap-1.5">
                                <h1 className="text-display-xs font-semibold text-primary md:text-display-sm">
                                    <bdi className="cn tracking-wide">{c.containerNumber}</bdi>
                                </h1>
                                <div className="flex flex-wrap items-center gap-2">
                                    <StatusDot status={c.status} />
                                    {c.isShared && (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-utility-purple-50 px-2.5 py-1 text-sm font-medium text-utility-purple-700 ring-1 ring-utility-purple-200 ring-inset">
                                            <Users01 className="size-4" aria-hidden="true" />
                                            مشتركة · {tradersText(c.shares.length)}
                                        </span>
                                    )}
                                    {archived && <span className="rounded-full bg-error-primary px-2.5 py-1 text-sm text-error-primary">ملغاة</span>}
                                </div>
                                <p className="text-md text-tertiary">
                                    {meta.join(" · ")}
                                    {c.billOfLadingNumber && (
                                        <>
                                            {" · "}B/L <bdi className="cn">{c.billOfLadingNumber}</bdi>
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                        {!archived && (
                            <div className="no-print flex flex-wrap items-center gap-2">
                                <WhatsAppShareButton text={shareText(c, money.total)} targetId="container-card" fileName={`الحاوية ${c.containerNumber}`} />
                                <Button size="lg" color="secondary" iconLeading={<Edit05 data-icon aria-hidden="true" />} href={`/containers/${c.id}/edit`}>
                                    {t("action.edit")}
                                </Button>
                                <ContainerMenu containerId={c.id} containerNumber={c.containerNumber} canArchive={c.activeCharges === 0} />
                            </div>
                        )}
                    </div>
                    {moneyText(money.total) && (
                        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-secondary px-4 py-3">
                            <IconTile icon={Receipt} color="pink" size="sm" />
                            <span className="text-md text-secondary">مجموع المصاريف</span>
                            <bdi className="num ms-auto text-lg font-semibold text-primary">{moneyText(money.total)}</bdi>
                        </div>
                    )}
                </header>

                {c.activeCharges === 0 && !archived && (
                    <div className="flex flex-col gap-4 rounded-[1.25rem] bg-brand-primary_alt p-5 ring-1 ring-brand-200 ring-inset lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <IconTile icon={Receipt} color="pink" size="lg" />
                            <div className="flex flex-col gap-1">
                                <p className="text-md font-semibold text-brand-secondary">{t("form.nextStep")}</p>
                                <p className="text-md text-secondary">سجّل ما دُفع على هذه الحاوية (الكمرك، الغرامات، النقل، والأتعاب) ليظهر على حساب التاجر.</p>
                            </div>
                        </div>
                        <AddChargesButton size="lg" className="shrink-0 max-lg:hidden" />
                    </div>
                )}

                <section aria-labelledby="steps-title" className="surface flex flex-col gap-5 p-5 md:p-6">
                    <CardTitle id="steps-title" icon={Route} color="orange" title="مراحل الحاوية" hint="اضغط على المرحلة التالية عندما تحصل" />
                    <StatusSteps containerId={c.id} status={c.status} reachedOn={reachedDates(c)} today={today} isArchived={archived} />
                </section>

                {c.isShared && (
                    <SharesCard
                        containerId={c.id}
                        unit={c.splitUnit}
                        shares={c.shares}
                        capacity={capacityFor(c.size ? { lengthM: c.size.lengthM, volumeM3: c.size.volumeM3 } : null, c.splitUnit)}
                        sizeLabel={c.sizeLabel}
                        today={today}
                    />
                )}
                <ResplitAlert containerId={c.id} items={resplit} />

                <ChargesSection charges={charges} money={money} isShared={c.isShared} canEdit={!archived} />

                <ContainerInfo c={c} />
                <ContainerHistory c={c} charges={charges} />

                {!archived && (
                    <div className="no-print fixed inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5rem)] z-20 lg:hidden">
                        <AddChargesButton size="lg" className="w-full shadow-hero" />
                    </div>
                )}
            </div>
        </ChargesSheetProvider>
    );
}

function InfoRow({ label, children, ltr }: { label: string; children: React.ReactNode; ltr?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="shrink-0 text-sm text-tertiary">{label}</dt>
            <dd className={cx("min-w-0 text-end text-md text-primary", !children && "text-quaternary")}>
                {children ? ltr ? <bdi className="cn">{children}</bdi> : children : "—"}
            </dd>
        </div>
    );
}

function ContainerInfo({ c }: { c: ContainerDetail }) {
    const single = !c.isShared ? c.shares[0] : null;
    return (
        <section aria-labelledby="info-title" className="surface flex flex-col gap-3 p-5 md:p-6">
            <CardTitle id="info-title" icon={InfoCircle} color="blue" title="معلومات الحاوية" />
            <dl className="grid divide-y divide-secondary md:grid-cols-2 md:gap-x-10 md:divide-y-0 md:[&>div]:border-b md:[&>div]:border-secondary">
                <InfoRow label="رقم الحاوية" ltr>
                    {c.containerNumber}
                </InfoRow>
                <InfoRow label="خط الشحن">
                    <span className="inline-flex items-center gap-2">
                        <ShippingLineLogo line={{ name: c.shippingLineName, logo: c.shippingLineLogo, website: c.shippingLineWebsite }} size="sm" />
                        {c.shippingLineName}
                    </span>
                </InfoRow>
                <InfoRow label="ميناء التحميل">{c.portName}</InfoRow>
                <InfoRow label="رقم البوليصة (B/L)" ltr>
                    {c.billOfLadingNumber}
                </InfoRow>
                <InfoRow label="حجم الحاوية">{c.sizeLabel}</InfoRow>
                <InfoRow label="العدد">
                    <bdi className="num">{c.quantity}</bdi>
                </InfoRow>
                <InfoRow label="فاكس" ltr>
                    {c.faxNumber}
                </InfoRow>
                <InfoRow label="شركة التخليص">{c.companyPartyName}</InfoRow>
                {single && <InfoRow label="البضاعة">{single.goods}</InfoRow>}
                {single && <InfoRow label="عدد الكراتين">{single.cartons !== null ? <bdi className="num">{formatNumber(single.cartons)}</bdi> : null}</InfoRow>}
                {single && <InfoRow label="الوزن (كغم)">{single.weightKg ? <bdi className="num">{formatNumber(single.weightKg)}</bdi> : null}</InfoRow>}
                <InfoRow label="الجهة">{c.destination}</InfoRow>
                <InfoRow label="تاريخ التسجيل">
                    <bdi className="num">{formatDate(c.registeredOn)}</bdi>
                </InfoRow>
                <InfoRow label="تاريخ الوصول المتوقع">{c.expectedArrivalOn ? <bdi className="num">{formatDate(c.expectedArrivalOn)}</bdi> : null}</InfoRow>
                <InfoRow label="تاريخ الوصول">{c.arrivedOn ? <bdi className="num">{formatDate(c.arrivedOn)}</bdi> : null}</InfoRow>
                <InfoRow label="تاريخ التسليم">{c.deliveredOn ? <bdi className="num">{formatDate(c.deliveredOn)}</bdi> : null}</InfoRow>
            </dl>
            {c.notes && <p className="rounded-lg bg-secondary p-4 text-md whitespace-pre-line text-secondary">{c.notes}</p>}
        </section>
    );
}

type HistoryItem =
    | { kind: "status"; at: Date; key: string; h: ContainerDetail["history"][number] }
    | { kind: "charge" | "cancel"; at: Date; key: string; ch: ContainerChargeRow };

/** Status changes and charges (added / cancelled), newest first (PRD §8.6 السجل). */
function ContainerHistory({ c, charges }: { c: ContainerDetail; charges: ContainerChargeRow[] }) {
    const items: HistoryItem[] = [
        ...c.history.map((h) => ({ kind: "status" as const, at: new Date(h.createdAt), key: `s-${h.id}`, h })),
        ...charges.map((ch) => ({ kind: "charge" as const, at: new Date(ch.createdAt), key: `c-${ch.id}`, ch })),
        ...charges.filter((ch) => ch.cancelledAt).map((ch) => ({ kind: "cancel" as const, at: new Date(ch.cancelledAt!), key: `x-${ch.id}`, ch })),
    ];
    // Stable sort keeps same-moment status steps in the order they were recorded.
    items.sort((a, b) => a.at.getTime() - b.at.getTime()).reverse();
    return (
        <section aria-labelledby="history-title" className="surface flex flex-col gap-4 p-5 md:p-6">
            <CardTitle id="history-title" icon={ClockRewind} color="gray" title="السجل" />
            <ol className="ms-2 flex flex-col border-s-2 border-secondary ps-5">
                {items.map((it) => {
                    const warn = it.kind === "cancel" || (it.kind === "status" && it.h.isBackward);
                    return (
                        <li key={it.key} className="relative flex flex-col gap-0.5 pb-5 last:pb-0">
                            <span
                                aria-hidden="true"
                                className={cx(
                                    "absolute -start-[27px] top-1.5 size-3 rounded-full ring-4 ring-bg-primary",
                                    warn ? "bg-warning-solid" : "bg-brand-solid",
                                )}
                            />
                            {it.kind === "status" ? (
                                <>
                                    <p className={cx("flex flex-wrap items-center gap-1.5 text-md", warn ? "text-warning-primary" : "text-primary")}>
                                        {it.h.fromStatus ? (
                                            <>
                                                {t(`statusShort.${it.h.fromStatus}`)}
                                                <ArrowLeft className="size-4 text-fg-quaternary" aria-hidden="true" />
                                                {t(`statusShort.${it.h.toStatus}`)}
                                                {it.h.isBackward && <span className="text-sm">(رجوع)</span>}
                                            </>
                                        ) : (
                                            "سُجّلت الحاوية"
                                        )}
                                    </p>
                                    <p className="text-sm text-tertiary">
                                        <bdi className="num">{formatDate(it.h.changedOn)}</bdi>
                                        {it.h.userName ? ` · ${it.h.userName}` : ""}
                                        <span className="sr-only"> · {formatDateTime(it.h.createdAt)}</span>
                                    </p>
                                    {it.h.note && <p className="text-sm text-secondary">{it.h.note}</p>}
                                </>
                            ) : (
                                <>
                                    <p className={cx("text-md", warn ? "text-warning-primary" : "text-primary")}>
                                        {it.kind === "cancel" ? "أُلغي مصروف" : "أُضيف مصروف"}: {it.ch.chargeTypeName}{" "}
                                        <bdi className="num">{formatMoney(it.ch.amount, it.ch.currency)}</bdi>
                                    </p>
                                    <p className="text-sm text-tertiary">
                                        <bdi className="num">{formatDate(it.kind === "cancel" ? it.at : it.ch.entryDate)}</bdi>
                                        {it.kind === "charge" ? ` · ${it.ch.payerLabel}` : ""}
                                    </p>
                                    {it.kind === "cancel" && it.ch.cancelReason && <p className="text-sm text-secondary">{it.ch.cancelReason}</p>}
                                </>
                            )}
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
