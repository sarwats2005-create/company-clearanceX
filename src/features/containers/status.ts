/** Container status rules (PRD §5.1). Pure: used by the service and by the status dialog. */
import type { ContainerStatus } from "@/db/schema";
import { DomainError } from "@/lib/errors";

export const STATUS_ORDER: readonly ContainerStatus[] = ["confirmed", "on_the_way", "arrived", "delivered"];

export const statusIndex = (s: ContainerStatus) => STATUS_ORDER.indexOf(s);

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
    if (!ISO_DATE.test(value)) return false;
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export interface StatusPlan {
    /** One history row per step; skipped steps are recorded with the same date. */
    steps: { from: ContainerStatus; to: ContainerStatus }[];
    isBackward: boolean;
    /** Only the dates that change. null clears a date. */
    dates: { arrivedOn?: string | null; deliveredOn?: string | null };
}

export function planStatusChange(
    current: { status: ContainerStatus; arrivedOn: string | null; deliveredOn: string | null },
    to: ContainerStatus,
    date: string,
    note?: string | null,
): StatusPlan {
    const from = statusIndex(current.status);
    const target = statusIndex(to);
    if (target < 0) throw new DomainError("اختر المرحلة", "to");
    if (target === from) throw new DomainError("الحاوية في هذه المرحلة مسبقاً", "to");
    if (!isIsoDate(date)) throw new DomainError("اختر التاريخ", "date");

    if (target < from) {
        if (!note?.trim()) throw new DomainError("اكتب سبب الرجوع إلى مرحلة سابقة", "note");
        const dates: StatusPlan["dates"] = {};
        if (target < statusIndex("arrived")) dates.arrivedOn = null;
        if (target < statusIndex("delivered")) dates.deliveredOn = null;
        return { steps: [{ from: current.status, to }], isBackward: true, dates };
    }

    const steps: StatusPlan["steps"] = [];
    for (let i = from; i < target; i++) steps.push({ from: STATUS_ORDER[i], to: STATUS_ORDER[i + 1] });
    const dates: StatusPlan["dates"] = {};
    if (from < statusIndex("arrived") && target >= statusIndex("arrived")) dates.arrivedOn = date;
    if (target === statusIndex("delivered")) dates.deliveredOn = date;
    return { steps, isBackward: false, dates };
}
