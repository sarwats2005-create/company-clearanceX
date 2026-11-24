import { cx } from "@/utils/cx";

/** Brand mark: a brass container profile on a navy tile (accent #B88A44 lives only here and on the nav marker). */
export function LogoMark({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 32 32" aria-hidden="true" className={cx("size-8 shrink-0", className)}>
            <rect width="32" height="32" rx="9" className="fill-fg-brand-primary" />
            <rect x="7" y="10" width="18" height="12" rx="1.5" className="fill-none stroke-accent-500" strokeWidth="1.75" />
            <path d="M11.5 12.5v7M16 12.5v7M20.5 12.5v7" className="stroke-accent-500" strokeWidth="1.5" strokeLinecap="round" />
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
