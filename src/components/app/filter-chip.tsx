import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

/** A pill that toggles a filter on or off (journal kinds, statement ranges, "debts only"). */
export function FilterChip({ pressed, onClick, children, className }: { pressed: boolean; onClick: () => void; children: ReactNode; className?: string }) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            onClick={onClick}
            className={cx(
                "inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm whitespace-nowrap ring-1 outline-focus-ring transition-[background-color,color,transform] duration-150 ease-smooth ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.97]",
                pressed
                    ? "bg-brand-primary_alt font-semibold text-brand-secondary ring-brand-300"
                    : "bg-primary text-secondary ring-primary hover:bg-primary_hover",
                className,
            )}
        >
            {children}
        </button>
    );
}
