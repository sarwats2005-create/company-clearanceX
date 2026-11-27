/** Containers list URL ⇄ filters (PRD §8.4). Bad values are ignored, never an error page. */
import type { ContainerStatus } from "@/db/schema";
import { isUuid } from "@/lib/ids";
import type { ContainerFilters, ContainerSort } from "./queries";
import { STATUS_ORDER, isIsoDate } from "./status";

export type ListSearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const SORTS: ContainerSort[] = ["number", "trader", "status", "registered", "arrived"];

export function parseListParams(sp: ListSearchParams): ContainerFilters {
    const statuses = one(sp.status)
        .split(",")
        .filter((s): s is ContainerStatus => (STATUS_ORDER as readonly string[]).includes(s));
    const sort = one(sp.sort) as ContainerSort;
    const page = Number.parseInt(one(sp.page), 10);
    return {
        q: one(sp.q).trim().slice(0, 100) || undefined,
        statuses: statuses.length ? statuses : undefined,
        traderId: isUuid(one(sp.trader)) ? one(sp.trader) : undefined,
        shippingLineId: isUuid(one(sp.line)) ? one(sp.line) : undefined,
        from: isIsoDate(one(sp.from)) ? one(sp.from) : undefined,
        to: isIsoDate(one(sp.to)) ? one(sp.to) : undefined,
        lateOnly: one(sp.late) === "1" || undefined,
        sort: SORTS.includes(sort) ? sort : undefined,
        dir: one(sp.dir) === "asc" ? "asc" : one(sp.dir) === "desc" ? "desc" : undefined,
        page: Number.isFinite(page) && page > 0 ? page : 1,
    };
}

/** Back to a query string; empty values are dropped. */
export function listQuery(f: ContainerFilters, patch: Partial<ContainerFilters> = {}): string {
    const v = { ...f, ...patch };
    const p = new URLSearchParams();
    if (v.q) p.set("q", v.q);
    if (v.statuses?.length) p.set("status", v.statuses.join(","));
    if (v.traderId) p.set("trader", v.traderId);
    if (v.shippingLineId) p.set("line", v.shippingLineId);
    if (v.from) p.set("from", v.from);
    if (v.to) p.set("to", v.to);
    if (v.lateOnly) p.set("late", "1");
    if (v.sort) p.set("sort", v.sort);
    if (v.dir) p.set("dir", v.dir);
    if (v.page && v.page > 1) p.set("page", String(v.page));
    const s = p.toString();
    return s ? `?${s}` : "";
}

export const activeFilterCount = (f: ContainerFilters) => [f.statuses?.length, f.traderId, f.shippingLineId, f.from || f.to, f.lateOnly].filter(Boolean).length;
