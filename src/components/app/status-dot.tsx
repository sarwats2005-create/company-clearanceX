import type { FC, SVGProps } from "react";
import { Anchor, CheckCircle, PackageCheck, Route } from "@untitledui/icons";
import type { TileColor } from "@/components/app/icon-tile";
import type { ContainerStatus } from "@/db/schema";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";

/** Status color per PRD §5.1: gray-blue, amber, blue, green. */
export const STATUS_DOT: Record<ContainerStatus, string> = {
    confirmed: "bg-fg-quaternary",
    on_the_way: "bg-warning-solid",
    arrived: "bg-utility-blue-500",
    delivered: "bg-success-solid",
};

/** Each status has its own icon, so the owner recognizes it without reading. */
export const STATUS_META: Record<ContainerStatus, { icon: FC<SVGProps<SVGSVGElement>>; tile: TileColor; pill: string }> = {
    confirmed: { icon: CheckCircle, tile: "gray", pill: "bg-utility-gray-50 text-utility-gray-700 ring-utility-gray-200" },
    on_the_way: { icon: Route, tile: "orange", pill: "bg-utility-orange-50 text-utility-orange-700 ring-utility-orange-200" },
    arrived: { icon: Anchor, tile: "blue", pill: "bg-utility-blue-50 text-utility-blue-700 ring-utility-blue-200" },
    delivered: { icon: PackageCheck, tile: "green", pill: "bg-utility-green-50 text-utility-green-700 ring-utility-green-200" },
};

/** A soft colored pill with the status icon and its name. */
export function StatusDot({ status, short, className }: { status: ContainerStatus; short?: boolean; className?: string }) {
    const m = STATUS_META[status];
    return (
        <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium whitespace-nowrap ring-1 ring-inset", m.pill, className)}>
            <m.icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
            {t(short ? `statusShort.${status}` : `status.${status}`)}
        </span>
    );
}
