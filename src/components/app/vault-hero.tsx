import type { FC, SVGProps } from "react";
import { ChevronLeft, Safe } from "@untitledui/icons";
import Link from "next/link";
import type { Currency } from "@/db/schema";
import { formatMoney } from "@/lib/format";
import { cx } from "@/utils/cx";

type Icon = FC<SVGProps<SVGSVGElement>>;

export interface HeroAmount {
    label: string;
    amount: string;
    currency: Currency;
}

export interface HeroAction {
    href: string;
    label: string;
    icon: Icon;
    /** Direction color: in = green, out = red, between = blue/purple. */
    tone: "in" | "out" | "between" | "neutral";
}

const TONE: Record<HeroAction["tone"], string> = {
    in: "bg-[linear-gradient(140deg,rgb(74_222_128),rgb(22_163_74))]",
    out: "bg-[linear-gradient(140deg,rgb(252_129_129),rgb(220_38_38))]",
    between: "bg-[linear-gradient(140deg,rgb(129_140_248),rgb(79_70_229))]",
    neutral: "bg-white/18",
};

/**
 * The main vault, loud: a deep gradient card with the balance in big white numbers and round action
 * buttons under it (the pattern people praise in Revolut and Wise: money first, actions one tap away).
 */
export function VaultHero({
    title,
    subtitle,
    href,
    amounts,
    actions,
    className,
}: {
    title: string;
    subtitle?: string;
    /** When set, the title row links to the vault's own page. */
    href?: string;
    amounts: HeroAmount[];
    actions: HeroAction[];
    className?: string;
}) {
    const head = (
        <>
            <span aria-hidden="true" className="inline-flex size-12 items-center justify-center rounded-2xl bg-white/14 ring-1 ring-white/20">
                <Safe className="size-6 text-accent-300" strokeWidth={2} />
            </span>
            <span className="flex min-w-0 flex-col">
                <span className="truncate text-lg font-semibold text-white">{title}</span>
                {subtitle && <span className="text-sm text-white/70">{subtitle}</span>}
            </span>
        </>
    );

    return (
        <section aria-label={title} className={cx("rise-in relative overflow-hidden rounded-[1.75rem] bg-hero p-5 text-white shadow-hero md:p-7", className)}>
            {/* Soft container-stripe pattern in the corner, purely decorative. */}
            <svg aria-hidden="true" viewBox="0 0 200 120" className="pointer-events-none absolute -end-6 -bottom-6 w-64 opacity-[0.09]">
                <rect x="4" y="4" width="192" height="112" rx="10" fill="none" stroke="white" strokeWidth="6" />
                {[30, 60, 90, 120, 150].map((x) => (
                    <path key={x} d={`M${x} 18v84`} stroke="white" strokeWidth="6" strokeLinecap="round" />
                ))}
            </svg>

            <div className="relative flex flex-col gap-6">
                <div className="flex items-center justify-between gap-3">
                    {href ? (
                        <Link href={href} className="group flex min-w-0 items-center gap-3 rounded-2xl outline-white focus-visible:outline-2 focus-visible:outline-offset-4">
                            {head}
                        </Link>
                    ) : (
                        <div className="flex min-w-0 items-center gap-3">{head}</div>
                    )}
                    {href && (
                        <Link
                            href={href}
                            className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full bg-white/14 ps-4 pe-3 text-sm font-semibold text-white ring-1 ring-white/20 outline-white transition-[background-color,transform] duration-150 ease-smooth hover:bg-white/22 focus-visible:outline-2 active:scale-[0.97]"
                        >
                            فتح القاصة
                            <ChevronLeft className="size-4" aria-hidden="true" />
                        </Link>
                    )}
                </div>

                <dl className={cx("grid gap-4", amounts.length > 1 && "sm:grid-cols-2")}>
                    {amounts.map((a) => (
                        <div key={`${a.label}:${a.currency}`} className="flex flex-col gap-1">
                            <dt className="text-sm text-white/70">{a.label}</dt>
                            <dd className={cx("num text-display-sm font-semibold tracking-tight md:text-display-md", a.amount.startsWith("-") && "text-[rgb(254_202_202)]")}>
                                <bdi>{formatMoney(a.amount, a.currency)}</bdi>
                            </dd>
                        </div>
                    ))}
                </dl>

                {actions.length > 0 && (
                    <nav aria-label="معاملة سريعة">
                        <ul className="grid grid-cols-5 gap-1 sm:flex sm:flex-wrap sm:gap-5">
                            {actions.map((a) => (
                                <li key={a.href}>
                                    <Link
                                        href={a.href}
                                        className="group flex flex-col items-center gap-2 rounded-2xl p-0.5 text-center text-sm font-medium text-white outline-white focus-visible:outline-2 sm:min-w-20"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={cx(
                                                "inline-flex size-12 items-center justify-center rounded-full sm:size-14 shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_8px_18px_-8px_rgb(0_0_0/0.5)] ring-1 ring-white/20 transition-transform duration-150 ease-smooth group-hover:-translate-y-0.5 group-active:scale-[0.94]",
                                                TONE[a.tone],
                                            )}
                                        >
                                            <a.icon className="size-6 text-white" strokeWidth={2} />
                                        </span>
                                        <span className="leading-tight">{a.label}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>
                )}
            </div>
        </section>
    );
}
