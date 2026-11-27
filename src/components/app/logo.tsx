import { cx } from "@/utils/cx";

/** Brand mark: a gold container profile on a navy tile. `onDark` swaps the tile for a light glass one (sidebar). */
export function LogoMark({ className, onDark = false }: { className?: string; onDark?: boolean }) {
    return (
        <svg viewBox="0 0 32 32" aria-hidden="true" className={cx("size-8 shrink-0", className)}>
            <defs>
                <linearGradient id="logo-tile" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="rgb(46 82 200)" />
                    <stop offset="1" stopColor="rgb(11 26 77)" />
                </linearGradient>
            </defs>
            <rect width="32" height="32" rx="9" fill={onDark ? "rgb(255 255 255 / 0.14)" : "url(#logo-tile)"} />
            <rect x="7" y="10" width="18" height="12" rx="1.5" className="fill-none stroke-accent-400" strokeWidth="1.75" />
            <path d="M11.5 12.5v7M16 12.5v7M20.5 12.5v7" className="stroke-accent-400" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

export function Logo({ name, className }: { name: string; className?: string }) {
    return (
        <span className={cx("flex items-center gap-2.5", className)}>
            <LogoMark />
            <span className="truncate text-md font-semibold text-primary">{name}</span>
        </span>
    );
}
