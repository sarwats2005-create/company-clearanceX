import type { ContainerStatus } from "@/db/schema";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";

/** Status color per PRD §5.1: gray, amber, blue, green. Shown as a dot + text (DECISIONS: Part F). */
export const STATUS_DOT: Record<ContainerStatus, string> = {
    confirmed: "bg-fg-quaternary",
    on_the_way: "bg-warning-solid",
    arrived: "bg-utility-blue-500",
    delivered: "bg-success-solid",
};

export function StatusDot({ status, short, className }: { status: ContainerStatus; short?: boolean; className?: string }) {
    return (
        <span className={cx("inline-flex items-center gap-2 text-sm whitespace-nowrap text-secondary", className)}>
            <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", STATUS_DOT[status])} />
            {t(short ? `statusShort.${status}` : `status.${status}`)}
        </span>
    );
}
