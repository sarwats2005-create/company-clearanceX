import Decimal from "decimal.js";
import type { SplitUnit } from "@/db/schema";
import { fillSummary, sharePercents } from "@/features/containers/shares";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";

/** Navy shades, darkest first; the 6th trader onward repeats. */
export const SHARE_COLORS = ["bg-brand-700", "bg-brand-500", "bg-brand-300", "bg-brand-800", "bg-brand-400", "bg-brand-200"];

export interface FillRow {
    traderId: string;
    name: string;
    shareValue: string | null;
}

const unitText = (unit: SplitUnit | null, value: string) => {
    if (unit === "percent") return `${formatNumber(value)}%`;
    if (unit === "meters" || unit === "cbm") return `${formatNumber(value)} ${t(`splitUnitShort.${unit}`)}`;
    return "";
};

/**
 * The container being filled (PRD §5.3 step 4): one segment per trader plus the empty space,
 * the over-capacity warning, and how charges will be split.
 */
export function FillBar({ unit, rows, capacity, sizeLabel, className }: { unit: SplitUnit | null; rows: FillRow[]; capacity: string | null; sizeLabel?: string | null; className?: string }) {
    const shares = rows.map((r) => ({ traderId: r.traderId, shareValue: unit === "equal" ? null : r.shareValue }));
    const fill = fillSummary(unit, shares, unit === "equal" ? null : capacity);
    const percents = sharePercents(unit, shares);
    const scale = Decimal.max(new Decimal(fill.used), new Decimal(fill.free === null ? 0 : (capacity ?? 0)), 0);
    const width = (v: string) => (scale.isZero() ? 0 : new Decimal(v).div(scale).times(100).toNumber());
    const weightOf = (r: FillRow) => (unit === "equal" ? "1" : r.shareValue && Number(r.shareValue) > 0 ? r.shareValue : "0");

    const captionCapacity = capacity && unit !== "equal" && unit !== "percent" ? ` (${sizeLabel ? `${sizeLabel} = ` : ""}${unitText(unit, capacity)})` : "";

    return (
        <div className={cx("flex flex-col gap-2", className)}>
            <span className="text-sm font-medium text-secondary">امتلاء الحاوية{captionCapacity}</span>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary ring-1 ring-secondary ring-inset" role="img" aria-label="امتلاء الحاوية">
                {rows.map((r, i) => (
                    <span
                        key={r.traderId + i}
                        className={cx("h-full transition-[width] duration-200 ease-smooth", SHARE_COLORS[i % SHARE_COLORS.length], i > 0 && "border-s-2 border-primary")}
                        style={{ width: `${width(weightOf(r))}%` }}
                    />
                ))}
            </div>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-tertiary">
                {rows.map((r, i) => (
                    <span key={r.traderId + i} className="inline-flex items-center gap-1.5">
                        <span aria-hidden="true" className={cx("size-2 rounded-full", SHARE_COLORS[i % SHARE_COLORS.length])} />
                        {r.name || `تاجر ${i + 1}`}
                        {unit !== "equal" && r.shareValue ? <bdi className="num">{unitText(unit, r.shareValue)}</bdi> : null}
                    </span>
                ))}
                {fill.free !== null && unit !== "percent" && Number(fill.free) > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden="true" className="size-2 rounded-full bg-quaternary ring-1 ring-secondary" />
                        فارغ <bdi className="num">{unitText(unit, fill.free)}</bdi>
                    </span>
                )}
            </p>
            {fill.over && unit !== "percent" && <p className="text-sm text-warning-primary">{t("warn.sharesOverCapacity")}</p>}
            {rows.length > 1 && (
                <p className="text-sm text-secondary">
                    ستُقسَّم المصاريف:{" "}
                    {rows.map((r, i) => (
                        <span key={r.traderId + i}>
                            {i > 0 && " · "}
                            {r.name || `تاجر ${i + 1}`} <bdi className="num">{percents[i]?.percent ?? "0"}%</bdi>
                        </span>
                    ))}
                </p>
            )}
        </div>
    );
}
