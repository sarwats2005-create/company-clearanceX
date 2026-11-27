/** Home list chips ⇄ URL ⇄ list filters (PRD §8.3). Pure, so pages and tests share it. */
import type { ContainerStatus } from "@/db/schema";
import type { ContainerFilters } from "@/features/containers/queries";
import { containersText, daysText } from "@/lib/format";

export const HOME_PAGE_SIZE = 25;
export const HOME_FILTERS = ["all", "confirmed", "on_the_way", "arrived", "delivered"] as const;
export type HomeFilter = (typeof HOME_FILTERS)[number];
export interface HomeParams {
    filter: HomeFilter;
    page: number;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseHomeParams(sp: Record<string, string | string[] | undefined>): HomeParams {
    const status = one(sp.status);
    const page = Number.parseInt(one(sp.page), 10);
    return {
        filter: HOME_FILTERS.find((f) => f !== "all" && f === status) ?? "all",
        page: Number.isFinite(page) && page > 0 ? page : 1,
    };
}

/** "all" = still moving plus delivered in the last 7 days; "delivered" = this month, matching its figure. */
export function homeListFilters(p: HomeParams, today: string): ContainerFilters {
    const base = { page: p.page, pageSize: HOME_PAGE_SIZE };
    if (p.filter === "all") return { current: true, ...base };
    if (p.filter === "delivered") return { statuses: ["delivered"], deliveredFrom: `${today.slice(0, 7)}-01`, ...base };
    return { statuses: [p.filter as ContainerStatus], ...base };
}

export function homeQuery(p: HomeParams): string {
    const q = new URLSearchParams();
    if (p.filter !== "all") q.set("status", p.filter);
    if (p.page > 1) q.set("page", String(p.page));
    const s = q.toString();
    return s ? `/?${s}` : "/";
}

/** "3 حاويات في أم قصر منذ أكثر من 7 أيام" (after من the dual is يومين). */
export function lateArrivedText(count: number, warningDays: number): string {
    return `${containersText(count)} في أم قصر منذ أكثر من ${warningDays === 2 ? "يومين" : daysText(warningDays)}`;
}

export function lateOnTheWayText(count: number): string {
    return `${containersText(count)} في الطريق بعد موعد الوصول المتوقع`;
}
