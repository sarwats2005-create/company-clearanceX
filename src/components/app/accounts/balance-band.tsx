import type { ReactNode } from "react";
import type { Currency } from "@/db/schema";
import { balanceSide, formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";

export interface BandItem {
    label: ReactNode;
    value: ReactNode;
    hint?: ReactNode;
}

/** Big figures side by side in raised cards (balances, totals), under a small title. */
export function BalanceBand({ items, title }: { items: BandItem[]; title: string }) {
    return (
        <section aria-label={title} className="flex flex-col gap-3">
            <h2 className="text-md font-semibold text-secondary">{title}</h2>
            <dl className={cx("grid grid-cols-1 gap-3", items.length > 1 && "sm:grid-cols-2", items.length > 2 && "lg:grid-cols-4")}>
                {items.map((it, i) => (
                    <div key={i} className="surface flex flex-col gap-1 p-4 md:p-5">
                        <dt className="text-sm text-tertiary">{it.label}</dt>
                        <dd className="text-xl font-semibold md:text-display-xs">{it.value}</dd>
                        {it.hint && <dd className="text-sm text-tertiary">{it.hint}</dd>}
                    </div>
                ))}
            </dl>
        </section>
    );
}

const TONE = { owesUs: "text-error-primary", weOwe: "text-success-primary", settled: "text-quaternary" } as const;

/** One currency as a big figure: "عليه 2,400 $" (red) / "له 100 $" (green) / "مسدد". */
export function SideFigure({ amount, currency }: { amount: string; currency: Currency }) {
    const side = balanceSide(amount, currency);
    if (side === "settled") return <span className={TONE.settled}>{t("balance.settled")}</span>;
    return (
        <span className={cx("whitespace-nowrap", TONE[side])}>
            {t(`balance.${side}`)} <bdi className="num">{formatMoney(amount.replace(/^-/, ""), currency)}</bdi>
        </span>
    );
}

/** Totals per currency on one line ("12,400 $  3,000,000 د.ع"), signs dropped; "لا شيء" when empty. */
export function AmountsLine({ amounts, tone }: { amounts: Record<Currency, string>; tone: string }) {
    const parts = (["USD", "IQD"] as Currency[]).filter((c) => Number(amounts[c]) !== 0);
    if (!parts.length) return <span className="text-quaternary">لا شيء</span>;
    return (
        <span className={cx("flex flex-wrap gap-x-4", tone)}>
            {parts.map((c) => (
                <bdi key={c} className="num whitespace-nowrap">
                    {formatMoney(amounts[c].replace(/^-/, ""), c)}
                </bdi>
            ))}
        </span>
    );
}

/** The small link above a page title back to its list. */
export function ParentLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <a href={href} className="rounded-md outline-focus-ring hover:text-secondary focus-visible:outline-2">
            {children}
        </a>
    );
}
