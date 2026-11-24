"use client";

import { useEffect, useRef, useState } from "react";
import { SearchLg } from "@untitledui/icons";
import { usePathname, useRouter } from "next/navigation";
import { DateField } from "@/components/app/date-field";
import { FilterChip } from "@/components/app/filter-chip";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import type { ReceiptKind } from "@/db/schema";
import { type JournalParams, journalQuery } from "@/features/money/journal-params";
import { cx } from "@/utils/cx";
import { GROUP_COLOR, RECEIPT_KIND_GROUP } from "./money-kinds";

const KINDS: { value: ReceiptKind | undefined; label: string }[] = [
    { value: undefined, label: "الكل" },
    { value: "in", label: "قبض" },
    { value: "out", label: "صرف" },
    { value: "transfer", label: "تحويل" },
    { value: "exchange", label: "تصريف" },
];

/** Search, receipt-kind chips and a date range for the journal. Everything lives in the URL. */
export function JournalFilters({ params }: { params: JournalParams }) {
    const router = useRouter();
    const pathname = usePathname();
    const [q, setQ] = useState(params.q ?? "");
    const first = useRef(true);
    const go = (patch: Partial<JournalParams>) => router.replace(`${pathname}${journalQuery(params, { ...patch, page: 1 })}`, { scroll: false });

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        const id = window.setTimeout(() => go({ q: q.trim() || undefined }), 300);
        return () => window.clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    const any = !!(params.q || params.kind || params.from || params.to);

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                <Input aria-label="بحث" size="lg" icon={SearchLg} placeholder="رقم الوصل، اسم التاجر أو الجهة، ملاحظة…" value={q} onChange={setQ} />
                <DateField label="من تاريخ" aria-label="من تاريخ" value={params.from ?? null} onChange={(d) => go({ from: d ?? undefined })} />
                <DateField label="إلى تاريخ" aria-label="إلى تاريخ" value={params.to ?? null} onChange={(d) => go({ to: d ?? undefined })} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <div role="group" aria-label="نوع الوصل" className="flex flex-wrap gap-2">
                    {KINDS.map((k) => {
                        const on = params.kind === k.value;
                        return (
                            <FilterChip key={k.label} pressed={on} onClick={() => go({ kind: k.value })}>
                                {k.value && <span aria-hidden="true" className={cx("size-2 rounded-full", GROUP_COLOR[RECEIPT_KIND_GROUP[k.value]])} />}
                                {k.label}
                            </FilterChip>
                        );
                    })}
                </div>
                {any && (
                    <Button
                        size="md"
                        color="link-gray"
                        className="ms-auto"
                        onClick={() => {
                            setQ("");
                            router.replace(pathname, { scroll: false });
                        }}
                    >
                        مسح التصفية
                    </Button>
                )}
            </div>
        </div>
    );
}
