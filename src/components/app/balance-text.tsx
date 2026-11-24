import type { Currency } from "@/db/schema";
import { balanceSide, formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";

const TONE = { owesUs: "text-error-primary", weOwe: "text-success-primary", settled: "text-quaternary" } as const;

/** A balance per currency in the owner's words (PRD §6.1): "عليه 2,400 $" red, "له 100 $" green, or "مسدد". */
export function BalanceText({ amounts, className }: { amounts: Record<Currency, string>; className?: string }) {
    const parts = (["USD", "IQD"] as Currency[]).filter((c) => balanceSide(amounts[c], c) !== "settled");
    if (!parts.length) return <span className={cx(TONE.settled, className)}>{t("balance.settled")}</span>;
    return (
        <span className={cx("inline-flex flex-wrap items-baseline gap-x-3 gap-y-0.5", className)}>
            {parts.map((c) => {
                const side = balanceSide(amounts[c], c);
                return (
                    <span key={c} className={cx("whitespace-nowrap", TONE[side])}>
                        {t(`balance.${side}`)} <bdi className="num">{formatMoney(amounts[c].replace(/^-/, ""), c)}</bdi>
                    </span>
                );
            })}
        </span>
    );
}
