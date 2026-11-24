"use client";

import { useEffect, useRef, useState } from "react";
import { FilterLines, SearchLg, XClose } from "@untitledui/icons";
import { usePathname, useRouter } from "next/navigation";
import { DateField } from "@/components/app/date-field";
import { EntityCombobox } from "@/components/app/entity-combobox";
import { SelectField } from "@/components/app/select-field";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Toggle } from "@/components/base/toggle/toggle";
import type { ContainerStatus } from "@/db/schema";
import { activeFilterCount, listQuery } from "@/features/containers/list-params";
import type { ContainerFilters } from "@/features/containers/queries";
import { STATUS_ORDER } from "@/features/containers/status";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";
import { STATUS_DOT } from "@/components/app/status-dot";

interface Props {
    filters: ContainerFilters;
    traders: { id: string; label: string }[];
    lines: { id: string; label: string }[];
}

/** Search + filters of the containers list (PRD §8.4). Phones get a "تصفية" slideout. */
export function ContainersFilters({ filters, traders, lines }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [q, setQ] = useState(filters.q ?? "");
    const [sheet, setSheet] = useState(false);
    const first = useRef(true);

    const go = (patch: Partial<ContainerFilters>) => router.replace(`${pathname}${listQuery(filters, { ...patch, page: 1 })}`, { scroll: false });

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        const id = window.setTimeout(() => go({ q: q.trim() || undefined }), 300);
        return () => window.clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    const toggleStatus = (s: ContainerStatus) => {
        const set = new Set(filters.statuses ?? []);
        if (set.has(s)) set.delete(s);
        else set.add(s);
        go({ statuses: STATUS_ORDER.filter((x) => set.has(x)) });
    };
    const count = activeFilterCount(filters);
    const clear = () => {
        setQ("");
        router.replace(pathname, { scroll: false });
    };

    const chips = (
        <div role="group" aria-label="الحالة" className="flex flex-wrap gap-2">
            {STATUS_ORDER.map((s) => {
                const on = filters.statuses?.includes(s) ?? false;
                return (
                    <button
                        key={s}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleStatus(s)}
                        className={cx(
                            "inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm outline-focus-ring ring-1 transition-[background-color,color,transform] duration-150 ease-smooth ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.97]",
                            on ? "bg-brand-primary_alt font-semibold text-brand-secondary ring-brand-300" : "bg-primary text-secondary ring-primary hover:bg-primary_hover",
                        )}
                    >
                        <span aria-hidden="true" className={cx("size-2 rounded-full", STATUS_DOT[s])} />
                        {t(`statusShort.${s}`)}
                    </button>
                );
            })}
        </div>
    );

    const more = (
        <>
            <EntityCombobox aria-label="التاجر" label="التاجر" placeholder="كل التجار" items={traders} value={filters.traderId ?? null} onChange={(id) => go({ traderId: id ?? undefined })} />
            <SelectField
                label="خط الشحن"
                items={[{ id: "", label: "كل الخطوط" }, ...lines]}
                value={filters.shippingLineId ?? ""}
                onChange={(id) => go({ shippingLineId: id || undefined })}
            />
            <div className="grid grid-cols-2 gap-3">
                <DateField label="مسجلة من" value={filters.from ?? null} onChange={(v) => go({ from: v ?? undefined })} />
                <DateField label="إلى" value={filters.to ?? null} onChange={(v) => go({ to: v ?? undefined })} />
            </div>
        </>
    );

    const lateToggle = <Toggle size="md" label="حاويات متأخرة فقط" isSelected={!!filters.lateOnly} onChange={(on) => go({ lateOnly: on || undefined })} />;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-end gap-3">
                <Input
                    aria-label="ابحث برقم الحاوية أو البوليصة أو اسم التاجر"
                    size="lg"
                    icon={SearchLg}
                    placeholder="ابحث برقم الحاوية أو البوليصة أو التاجر"
                    value={q}
                    onChange={setQ}
                    className="flex-1 md:max-w-md"
                />
                <Button size="lg" color="secondary" iconLeading={FilterLines} onClick={() => setSheet(true)} className="lg:hidden">
                    تصفية{count ? ` (${count})` : ""}
                </Button>
            </div>
            <div className="hidden flex-col gap-4 lg:flex">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    {chips}
                    {lateToggle}
                </div>
                <div className="grid grid-cols-[1fr_1fr_1.4fr] items-end gap-4">{more}</div>
            </div>
            {(count > 0 || filters.q) && (
                <button type="button" onClick={clear} className="inline-flex cursor-pointer items-center gap-1 self-start text-sm text-tertiary underline underline-offset-2 hover:text-secondary">
                    <XClose className="size-4" aria-hidden="true" />
                    مسح البحث والتصفية
                </button>
            )}

            <SlideoutMenu isOpen={sheet} onOpenChange={setSheet} isDismissable dialogLabel="تصفية الحاويات">
                <SlideoutMenu.Header onClose={() => setSheet(false)}>
                    <h2 className="text-lg font-semibold text-primary">تصفية الحاويات</h2>
                </SlideoutMenu.Header>
                <SlideoutMenu.Content>
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                            <span className="text-sm font-medium text-secondary">الحالة</span>
                            {chips}
                        </div>
                        {lateToggle}
                        {more}
                    </div>
                </SlideoutMenu.Content>
                <div className="border-t border-secondary p-4">
                    <Button size="lg" className="w-full" onClick={() => setSheet(false)}>
                        عرض النتائج
                    </Button>
                </div>
            </SlideoutMenu>
        </div>
    );
}
