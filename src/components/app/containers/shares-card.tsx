"use client";

import { Checkbox } from "@/components/base/checkbox/checkbox";
import { FillBar, SHARE_COLORS } from "@/components/app/container-form/fill-bar";
import { Button } from "@/components/base/buttons/button";
import type { SplitUnit } from "@/db/schema";
import { setShareDeliveredAction } from "@/features/containers/actions";
import { sharePercents } from "@/features/containers/shares";
import { useAction } from "@/hooks/use-action";
import { formatDate, formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";

interface Share {
    traderId: string;
    traderName: string;
    shareValue: string | null;
    goods: string | null;
    deliveredOn: string | null;
}

/** "الحصص" on a shared container's page (PRD §8.6): fill bar, one row per trader, and the per-trader delivered tick. */
export function SharesCard({ containerId, unit, shares, capacity, sizeLabel, today }: { containerId: string; unit: SplitUnit | null; shares: Share[]; capacity: string | null; sizeLabel: string | null; today: string }) {
    const tick = useAction(setShareDeliveredAction, { success: "تم الحفظ" });
    const percents = sharePercents(unit, shares);

    return (
        <section aria-labelledby="shares-title" className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
                <h2 id="shares-title" className="text-lg font-semibold text-primary">
                    الحصص <span className="text-md font-normal text-tertiary">· {unit ? t(`splitUnit.${unit}`) : ""}</span>
                </h2>
                <Button size="md" color="link-color" href={`/containers/${containerId}/edit#sec-shares`}>
                    تعديل الحصص
                </Button>
            </div>
            <FillBar unit={unit} capacity={capacity} sizeLabel={sizeLabel} rows={shares.map((s) => ({ traderId: s.traderId, name: s.traderName, shareValue: s.shareValue }))} />
            <ul className="flex flex-col divide-y divide-secondary border-y border-secondary">
                {shares.map((s, i) => (
                    <li key={s.traderId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                        <span aria-hidden="true" className={cx("size-2.5 shrink-0 rounded-full", SHARE_COLORS[i % SHARE_COLORS.length])} />
                        <div className="flex min-w-0 flex-1 flex-col">
                            <a href={`/accounts/traders/${s.traderId}`} className="truncate text-md font-semibold text-primary hover:underline">
                                {s.traderName}
                            </a>
                            <span className="text-sm text-tertiary">
                                {unit !== "equal" && s.shareValue ? (
                                    <bdi className="num">
                                        {formatNumber(s.shareValue)}
                                        {unit === "percent" ? "%" : ` ${t(`splitUnitShort.${unit ?? "meters"}`)}`}
                                    </bdi>
                                ) : null}
                                {unit !== "equal" && s.shareValue ? " · " : ""}
                                <bdi className="num">{percents[i]?.percent}%</bdi> من المصاريف
                                {s.goods ? ` · ${s.goods}` : ""}
                            </span>
                        </div>
                        <Checkbox
                            size="md"
                            label={s.deliveredOn ? `سُلّم ${formatDate(s.deliveredOn)}` : "سُلّم للتاجر"}
                            isSelected={!!s.deliveredOn}
                            isDisabled={tick.pending}
                            onChange={(on) => tick.run(containerId, s.traderId, on ? today : null)}
                        />
                    </li>
                ))}
            </ul>
        </section>
    );
}
