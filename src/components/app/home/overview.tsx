import type { ReactNode } from "react";
import { ChevronLeft } from "@untitledui/icons";
import Link from "next/link";
import { AmountsLine } from "@/components/app/accounts/balance-band";
import { STATUS_DOT } from "@/components/app/status-dot";
import type { ContainerStatus } from "@/db/schema";
import { listQuery } from "@/features/containers/list-params";
import { type HomeFilter, homeQuery, lateArrivedText, lateOnTheWayText } from "@/features/home/model";
import { getHomeCounts, getHomeMoney } from "@/features/home/queries";
import { formatMoney, formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";

/** 2 columns on phones, 4 on desktop, split by hairlines only (Part F: no boxes). */
function cell(i: number) {
    return cx(
        "flex min-w-0 flex-col gap-1.5 py-4 lg:pe-6",
        i % 2 === 1 ? "border-s border-secondary ps-4" : "pe-4",
        i >= 2 && "border-t border-secondary lg:border-t-0",
        i === 2 && "lg:border-s",
        i > 0 && "lg:ps-6",
    );
}

const FIGURE_LINK =
    "group relative flex min-w-0 flex-col gap-1.5 rounded-md outline-focus-ring transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-4";

function StatusFigure({ status, label, count, active }: { status: ContainerStatus; label: string; count: number; active: boolean }) {
    // Tapping a figure filters the list below; tapping the active one again shows everything.
    return (
        <Link
            href={`${homeQuery({ filter: active ? "all" : (status as HomeFilter), page: 1 })}#current`}
            aria-current={active ? "true" : undefined}
            className={FIGURE_LINK}
        >
            <span className="inline-flex items-center gap-2 text-sm text-tertiary group-hover:text-secondary">
                <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", STATUS_DOT[status])} />
                {label}
            </span>
            <span className="num text-display-sm font-semibold text-primary lg:text-display-md">{formatNumber(count)}</span>
            {active && <span aria-hidden="true" className="absolute start-0 -bottom-2 h-0.5 w-8 rounded-full bg-brand-solid" />}
        </Link>
    );
}

function MoneyFigure({ href, label, children }: { href: string; label: string; children: ReactNode }) {
    return (
        <Link href={href} className={FIGURE_LINK}>
            <span className="text-sm text-tertiary group-hover:text-secondary">{label}</span>
            <span className="text-xl font-semibold lg:text-display-xs">{children}</span>
        </Link>
    );
}

function VaultAmount({ amount, currency }: { amount: string; currency: "IQD" | "USD" }) {
    return <bdi className={cx("num whitespace-nowrap", amount.startsWith("-") ? "text-error-primary" : "text-primary")}>{formatMoney(amount, currency)}</bdi>;
}

/** Home overview (PRD §8.3, Part F4.1): four status figures over four money figures, then the late alerts. */
export async function HomeOverview({ filter }: { filter: HomeFilter }) {
    const [c, money] = await Promise.all([getHomeCounts(), getHomeMoney()]);
    const statuses: { status: ContainerStatus; label: string; count: number }[] = [
        { status: "confirmed", label: t("status.confirmed"), count: c.confirmed },
        { status: "on_the_way", label: t("statusShort.on_the_way"), count: c.onTheWay },
        { status: "arrived", label: t("status.arrived"), count: c.arrived },
        { status: "delivered", label: "سُلّمت هذا الشهر", count: c.deliveredThisMonth },
    ];
    const moneyItems = [
        money.main && {
            key: "main",
            href: `/accounts/vaults/${money.main.id}`,
            label: money.main.name,
            value: <VaultAmount amount={money.main.balance.IQD} currency="IQD" />,
        },
        money.usd && {
            key: "usd",
            href: `/accounts/vaults/${money.usd.id}`,
            label: money.usd.name,
            value: <VaultAmount amount={money.usd.balance.USD} currency="USD" />,
        },
        {
            key: "traders",
            href: "/accounts/traders?debts=1",
            label: "لنا عند التجار",
            value: <AmountsLine amounts={money.tradersOweUs} tone="text-error-primary" />,
        },
        { key: "parties", href: "/accounts/parties", label: "علينا للجهات", value: <AmountsLine amounts={money.weOweParties} tone="text-success-primary" /> },
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
        <section aria-label="نظرة عامة" className="flex flex-col gap-4">
            <div>
                <ul aria-label="الحاويات حسب الحالة" className="grid grid-cols-2 border-b border-secondary lg:grid-cols-4">
                    {statuses.map((s, i) => (
                        <li key={s.status} className={cell(i)}>
                            <StatusFigure {...s} active={filter === s.status} />
                        </li>
                    ))}
                </ul>
                <ul aria-label="المال" className="grid grid-cols-2 border-b border-secondary lg:grid-cols-4">
                    {moneyItems.map((m, i) => (
                        <li key={m.key} className={cell(i)}>
                            <MoneyFigure href={m.href} label={m.label}>
                                {m.value}
                            </MoneyFigure>
                        </li>
                    ))}
                </ul>
            </div>

            {alerts.length > 0 && (
                <ul aria-label="تنبيهات" className="flex flex-col gap-1">
                    {alerts.map((a) => (
                        <li key={a.key}>
                            <Link
                                href={a.href}
                                className="inline-flex min-h-11 items-start gap-2 rounded-md py-2 text-md text-warning-primary outline-focus-ring hover:underline focus-visible:outline-2"
                            >
                                <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-warning-solid" />
                                <span>{a.text}</span>
                                <span className="inline-flex shrink-0 items-center font-semibold">
                                    عرض
                                    <ChevronLeft className="size-4" aria-hidden="true" />
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
