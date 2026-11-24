"use client";

import { usePathname, useRouter } from "next/navigation";
import { DateField } from "@/components/app/date-field";
import { FilterChip } from "@/components/app/filter-chip";
import { SegmentedControl } from "@/components/app/segmented-control";
import type { Currency } from "@/db/schema";
import { PRESET_LABEL, STATEMENT_PRESETS, type StatementParams, statementQuery } from "@/features/accounts/model";

/** Currency, period presets and a typed range for a statement (PRD §8.8). Everything lives in the URL. */
export function StatementFilters({ params, currency, currencies }: { params: StatementParams; currency: Currency; currencies: Currency[] }) {
    const router = useRouter();
    const pathname = usePathname();
    const go = (patch: Partial<StatementParams>) => router.replace(`${pathname}${statementQuery({ ...params, currency }, patch)}`, { scroll: false });

    return (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            {currencies.length > 1 && (
                <SegmentedControl
                    label="العملة"
                    size="md"
                    value={currency}
                    onChange={(c) => go({ currency: c })}
                    options={currencies.map((c) => ({ value: c, label: c === "USD" ? "دولار $" : "دينار د.ع" }))}
                />
            )}
            <div role="group" aria-label="الفترة" className="flex flex-wrap gap-2">
                {STATEMENT_PRESETS.map((p) => (
                    <FilterChip key={p} pressed={params.preset === p} onClick={() => go({ preset: p, from: undefined, to: undefined })}>
                        {PRESET_LABEL[p]}
                    </FilterChip>
                ))}
            </div>
            <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:items-end">
                <DateField
                    label="من تاريخ"
                    aria-label="من تاريخ"
                    value={params.from ?? null}
                    onChange={(d) => go({ preset: "custom", from: d ?? undefined })}
                />
                <DateField label="إلى تاريخ" aria-label="إلى تاريخ" value={params.to ?? null} onChange={(d) => go({ preset: "custom", to: d ?? undefined })} />
            </div>
        </div>
    );
}
