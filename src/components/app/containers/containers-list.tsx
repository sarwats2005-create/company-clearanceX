import { ArrowDown, ArrowUp, ChevronSelectorVertical, Users01 } from "@untitledui/icons";
import { StatusDot } from "@/components/app/status-dot";
import type { Currency } from "@/db/schema";
import { listQuery } from "@/features/containers/list-params";
import type { ContainerFilters, ContainerRow, ContainerSort } from "@/features/containers/queries";
import { daysText, formatDate, formatMoney } from "@/lib/format";
import { cx } from "@/utils/cx";

function Totals({ totals }: { totals: Partial<Record<Currency, string>> }) {
    const parts = (["USD", "IQD"] as Currency[]).filter((c) => totals[c]);
    if (!parts.length) return <span className="text-quaternary">—</span>;
    return (
        <span className="flex flex-col items-end gap-0.5">
            {parts.map((c) => (
                <bdi key={c} className="num whitespace-nowrap">
                    {formatMoney(totals[c]!, c)}
                </bdi>
            ))}
        </span>
    );
}

function Traders({ names }: { names: string[] }) {
    if (!names.length) return <span className="text-quaternary">—</span>;
    return (
        <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className="truncate">{names[0]}</span>
            {names.length > 1 && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary ring-1 ring-secondary ring-inset" title={names.join("، ")}>
                    <Users01 className="size-3" aria-hidden="true" />+{names.length - 1}
                </span>
            )}
        </span>
    );
}

/** Days in the current status (PRD §8.3), delivered included; amber once late. */
function Since({ row }: { row: ContainerRow }) {
    return <span className={cx("whitespace-nowrap", row.isLate ? "font-semibold text-warning-primary" : "text-tertiary")}>{daysText(row.daysInStatus)}</span>;
}

function SortHeader({ filters, sort, children, className }: { filters: ContainerFilters | null; sort: ContainerSort; children: React.ReactNode; className?: string }) {
    if (!filters) {
        return (
            <th scope="col" className={cx("px-3 py-3 font-medium", className)}>
                {children}
            </th>
        );
    }
    const active = filters.sort === sort || (!filters.sort && sort === "registered");
    const dir = active ? (filters.dir ?? (sort === "registered" ? "desc" : "asc")) : null;
    const nextDir = dir === "asc" ? "desc" : "asc";
    const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ChevronSelectorVertical;
    return (
        <th scope="col" aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"} className={cx("px-3 py-3 font-medium", className)}>
            <a href={listQuery(filters, { sort, dir: nextDir, page: 1 }) || "?"} className="inline-flex items-center gap-1 hover:text-secondary">
                {children}
                <Icon className={cx("size-3.5", active ? "text-fg-secondary" : "text-fg-quaternary")} aria-hidden="true" />
            </a>
        </th>
    );
}

/** Containers as a hairline table on desktop and cards on phones (PRD §8.3, §8.4). Without filters the headers don't sort. */
export function ContainersList({ rows, filters }: { rows: ContainerRow[]; filters: ContainerFilters | null }) {
    return (
        <>
            <div className="hidden md:block">
                <table className="w-full table-fixed border-collapse text-md">
                    <thead>
                        <tr className="border-b border-secondary text-start text-sm text-tertiary">
                            <SortHeader filters={filters} sort="number" className="w-[19%] text-start">
                                رقم الحاوية
                            </SortHeader>
                            <SortHeader filters={filters} sort="trader" className="w-[18%] text-start">
                                التاجر
                            </SortHeader>
                            <th scope="col" className="w-[13%] px-3 py-3 text-start font-medium">
                                البضاعة
                            </th>
                            <SortHeader filters={filters} sort="status" className="w-[15%] text-start">
                                الحالة
                            </SortHeader>
                            <th scope="col" className="w-[9%] px-3 py-3 text-start font-medium">
                                منذ
                            </th>
                            <SortHeader filters={filters} sort="registered" className="w-[11%] text-start">
                                التسجيل
                            </SortHeader>
                            <th scope="col" className="w-[15%] px-3 py-3 text-end font-medium">
                                المصاريف
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id} className="group relative border-b border-secondary transition-colors duration-100 hover:bg-primary_hover">
                                <td className="px-3 py-3.5">
                                    <a href={`/containers/${r.id}`} className="flex flex-col outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:outline-focus-ring">
                                        <bdi className="cn self-start font-semibold text-primary">{r.containerNumber}</bdi>
                                        <span className="truncate text-sm text-tertiary">{r.shippingLineName}</span>
                                    </a>
                                </td>
                                <td className="px-3 py-3.5 text-secondary">
                                    <Traders names={r.traderNames} />
                                </td>
                                <td className="truncate px-3 py-3.5 text-tertiary">{r.goods ?? "—"}</td>
                                <td className="px-3 py-3.5">
                                    <StatusDot status={r.status} short />
                                </td>
                                <td className="px-3 py-3.5">
                                    <Since row={r} />
                                </td>
                                <td className="px-3 py-3.5 text-tertiary">
                                    <bdi className="num">{formatDate(r.registeredOn)}</bdi>
                                </td>
                                <td className="px-3 py-3.5 text-end text-secondary">
                                    <Totals totals={r.totals} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ul className="flex flex-col divide-y divide-secondary border-y border-secondary md:hidden">
                {rows.map((r) => (
                    <li key={r.id}>
                        <a href={`/containers/${r.id}`} className="flex flex-col gap-1.5 py-4 outline-focus-ring focus-visible:outline-2 active:bg-primary_hover">
                            <span className="flex items-center justify-between gap-3">
                                <bdi className="cn text-lg font-semibold text-primary">{r.containerNumber}</bdi>
                                <StatusDot status={r.status} short />
                            </span>
                            <span className="flex items-center justify-between gap-3 text-md text-secondary">
                                <Traders names={r.traderNames} />
                                <Since row={r} />
                            </span>
                            <span className="flex items-center justify-between gap-3 text-sm text-tertiary">
                                <span className="truncate">{[r.goods, r.shippingLineName].filter(Boolean).join(" · ")}</span>
                                <Totals totals={r.totals} />
                            </span>
                        </a>
                    </li>
                ))}
            </ul>
        </>
    );
}
