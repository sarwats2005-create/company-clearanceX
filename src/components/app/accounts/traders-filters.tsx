"use client";

import { useEffect, useRef, useState } from "react";
import { SearchLg } from "@untitledui/icons";
import { usePathname, useRouter } from "next/navigation";
import { FilterChip } from "@/components/app/filter-chip";
import { Input } from "@/components/base/input/input";

/** Search and "عليهم ديون فقط" for the traders list. Both live in the URL. */
export function TradersFilters({ q: initialQ, debtsOnly }: { q?: string; debtsOnly: boolean }) {
    const router = useRouter();
    const pathname = usePathname();
    const [q, setQ] = useState(initialQ ?? "");
    const first = useRef(true);
    const go = (next: { q?: string; debts: boolean }) => {
        const s = new URLSearchParams();
        if (next.q) s.set("q", next.q);
        if (next.debts) s.set("debts", "1");
        const str = s.toString();
        router.replace(str ? `${pathname}?${str}` : pathname, { scroll: false });
    };

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        const id = window.setTimeout(() => go({ q: q.trim() || undefined, debts: debtsOnly }), 300);
        return () => window.clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
                aria-label="بحث عن تاجر"
                size="lg"
                icon={SearchLg}
                placeholder="اسم التاجر أو رقم هاتفه أو مدينته…"
                value={q}
                onChange={setQ}
                className="sm:max-w-md"
            />
            <FilterChip pressed={debtsOnly} onClick={() => go({ q: q.trim() || undefined, debts: !debtsOnly })} className="self-start sm:self-auto">
                عليهم ديون فقط
            </FilterChip>
        </div>
    );
}
