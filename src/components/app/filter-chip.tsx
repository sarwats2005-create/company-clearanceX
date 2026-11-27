import type { ReactNode } from "react";
import Link from "next/link";
import { cx } from "@/utils/cx";

const chipClass = (pressed: boolean, className?: string) =>
    cx(
        "inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap ring-1 outline-focus-ring transition-[background-color,color,transform] duration-150 ease-smooth ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.97]",
        pressed ? "bg-brand-gradient font-semibold text-white shadow-button-brand ring-transparent" : "bg-primary text-secondary shadow-xs ring-secondary hover:bg-primary_hover",
        className,
    );

/** A pill that toggles a filter on or off (journal kinds, statement ranges, "debts only"). */
export function FilterChip({ pressed, onClick, children, className }: { pressed: boolean; onClick: () => void; children: ReactNode; className?: string }) {
    return (
        <button type="button" aria-pressed={pressed} onClick={onClick} className={chipClass(pressed, className)}>
            {children}
        </button>
    );
}

/** The same pill as a link, for filters that live in the URL of a server page (home status chips). Keeps the scroll position. */
export function FilterChipLink({ href, current, children }: { href: string; current: boolean; children: ReactNode }) {
    return (
        <Link href={href} scroll={false} aria-current={current ? "true" : undefined} className={chipClass(current)}>
            {children}
        </Link>
    );
}
