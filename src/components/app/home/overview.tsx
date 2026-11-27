import type { FC, ReactNode, SVGProps } from "react";
import { ArrowCircleDown, ArrowCircleUp, BellRinging01, ChevronLeft, CoinsSwap01, Receipt, SwitchHorizontal01, TrendDown01, TrendUp01 } from "@untitledui/icons";
import Link from "next/link";
import { AmountsLine } from "@/components/app/accounts/balance-band";
import { IconTile, type TileColor } from "@/components/app/icon-tile";
import { STATUS_META } from "@/components/app/status-dot";
import { type HeroAmount, VaultHero } from "@/components/app/vault-hero";
import type { ContainerStatus } from "@/db/schema";
import { listQuery } from "@/features/containers/list-params";
import { type HomeFilter, homeQuery, lateArrivedText, lateOnTheWayText } from "@/features/home/model";
import { getHomeCounts, getHomeMoney } from "@/features/home/queries";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";

const CARD_LINK =
    "surface group relative flex w-full min-w-0 flex-col gap-3 p-4 outline-focus-ring transition-[box-shadow,transform] duration-150 ease-smooth hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.985] md:p-5";

function StatusTile({ status, label, count, active }: { status: ContainerStatus; label: string; count: number; active: boolean }) {
    const m = STATUS_META[status];
    // Tapping a tile filters the list below; tapping the active one again shows everything.
    return (
        <Link
            href={`${homeQuery({ filter: active ? "all" : (status as HomeFilter), page: 1 })}#current`}
            aria-current={active ? "true" : undefined}
            className={cx(CARD_LINK, active && "ring-2 ring-brand")}
        >
            <div className="flex items-center justify-between gap-2">
                <IconTile icon={m.icon} color={m.tile} size="md" />
                <ChevronLeft aria-hidden="true" className="size-5 text-fg-quaternary transition-transform duration-150 group-hover:-translate-x-0.5" />
            </div>
            <div className="flex flex-col">
                <span className="num text-display-sm font-semibold text-primary">{formatNumber(count)}</span>
                <span className="text-md text-secondary">{label}</span>
            </div>
        </Link>
    );
}

function MoneyCard({ href, label, hint, icon, color, children }: { href: string; label: string; hint: string; icon: FC<SVGProps<SVGSVGElement>>; color: TileColor; children: ReactNode }) {
    return (
        <Link href={href} className={cx(CARD_LINK, "flex-row items-center gap-4")}>
            <IconTile icon={icon} color={color} size="lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-md font-semibold text-primary">{label}</span>
                <span className="text-lg font-semibold">{children}</span>
                <span className="text-sm text-tertiary">{hint}</span>
            </div>
            <ChevronLeft aria-hidden="true" className="size-5 shrink-0 text-fg-quaternary" />
        </Link>
    );
}

/** Home overview: the main vault first and loud, then the container counts, what's owed, and late alerts. */
export async function HomeOverview({ filter }: { filter: HomeFilter }) {
    const [c, money] = await Promise.all([getHomeCounts(), getHomeMoney()]);
    const statuses: { status: ContainerStatus; label: string; count: number }[] = [
        { status: "confirmed", label: t("status.confirmed"), count: c.confirmed },
        { status: "on_the_way", label: t("statusShort.on_the_way"), count: c.onTheWay },
        { status: "arrived", label: t("status.arrived"), count: c.arrived },
        { status: "delivered", label: "سُلّمت هذا الشهر", count: c.deliveredThisMonth },
    ];
    const amounts: HeroAmount[] = [
        money.main && { label: `${money.main.name} · دينار`, amount: money.main.balance.IQD, currency: "IQD" as const },
        money.usd && { label: `${money.usd.name} · دولار`, amount: money.usd.balance.USD, currency: "USD" as const },
    ].filter((x) => !!x);
    const alerts = [
        c.arrivedLate > 0 && {
            key: "arrived",
            text: lateArrivedText(c.arrivedLate, c.warningDays),
            href: `/containers${listQuery({ statuses: ["arrived"], lateOnly: true })}`,
        },
        c.onTheWayLate > 0 && {
            key: "on_the_way",
            text: lateOnTheWayText(c.onTheWayLate),
            href: `/containers${listQuery({ statuses: ["on_the_way"], lateOnly: true })}`,
        },
    ].filter((x) => !!x);

    return (
        <div className="flex flex-col gap-6">
            <VaultHero
                title={money.main?.name ?? "القاصة الرئيسية"}
                subtitle="الرصيد الآن"
                href={money.main ? `/accounts/vaults/${money.main.id}` : "/accounts/vaults"}
                amounts={amounts}
                actions={[
                    { href: "/money/new/receive-trader", label: "قبض", icon: ArrowCircleDown, tone: "in" },
                    { href: "/money/new/pay-party", label: "دفع", icon: ArrowCircleUp, tone: "out" },
                    { href: "/money/new/transfer", label: "تحويل", icon: SwitchHorizontal01, tone: "between" },
                    { href: "/money/new/exchange", label: "تصريف", icon: CoinsSwap01, tone: "between" },
                    { href: "/money/new/expense", label: "مصروف", icon: Receipt, tone: "out" },
                ]}
            />

            {alerts.length > 0 && (
                <ul aria-label="تنبيهات" className="flex flex-col gap-3">
                    {alerts.map((a) => (
                        <li key={a.key}>
                            <Link
                                href={a.href}
                                className="flex min-h-16 items-center gap-3 rounded-2xl bg-warning-primary p-3 pe-4 text-md text-warning-primary ring-1 ring-utility-orange-200 outline-focus-ring ring-inset transition-transform duration-150 ease-smooth hover:brightness-[0.98] focus-visible:outline-2 active:scale-[0.99]"
                            >
                                <IconTile icon={BellRinging01} color="orange" size="md" />
                                <span className="flex-1 font-medium">{a.text}</span>
                                <span className="inline-flex shrink-0 items-center gap-0.5 font-semibold">
                                    عرض
                                    <ChevronLeft className="size-4" aria-hidden="true" />
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}

            <section aria-labelledby="status-title" className="flex flex-col gap-3">
                <h2 id="status-title" className="text-lg font-semibold text-primary">
                    الحاويات حسب الحالة
                </h2>
                <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {statuses.map((s) => (
                        <li key={s.status} className="flex">
                            <StatusTile {...s} active={filter === s.status} />
                        </li>
                    ))}
                </ul>
            </section>

            <section aria-label="الديون" className="grid gap-3 md:grid-cols-2">
                <MoneyCard href="/accounts/traders?debts=1" label="لنا عند التجار" hint="ما يجب أن يدفعه التجار لنا" icon={TrendUp01} color="red">
                    <AmountsLine amounts={money.tradersOweUs} tone="text-error-primary" />
                </MoneyCard>
                <MoneyCard href="/accounts/parties" label="علينا للجهات" hint="ما يجب أن ندفعه للشركات والشركاء" icon={TrendDown01} color="green">
                    <AmountsLine amounts={money.weOweParties} tone="text-success-primary" />
                </MoneyCard>
            </section>
        </div>
    );
}
