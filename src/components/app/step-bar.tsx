import { Check } from "@untitledui/icons";
import { cx } from "@/utils/cx";

/** The add-container journey: the container, then its expenses, then done. Shown on both screens. */
export const ADD_CONTAINER_STEPS = ["الحاوية", "المصاريف", "تم"];

/** Numbered steps in a row; finished steps get a check. `current` is 0-based. */
export function StepBar({ steps = ADD_CONTAINER_STEPS, current, className }: { steps?: string[]; current: number; className?: string }) {
    return (
        <ol aria-label="الخطوات" className={cx("flex items-center gap-2", className)}>
            {steps.map((label, i) => {
                const done = i < current;
                const here = i === current;
                return (
                    <li key={label} aria-current={here ? "step" : undefined} className="flex flex-1 items-center gap-2 last:flex-none">
                        <span
                            className={cx(
                                "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-colors duration-200",
                                done && "bg-success-solid text-white",
                                here && "bg-brand-gradient text-white shadow-button-brand",
                                !done && !here && "bg-primary text-tertiary ring-1 ring-secondary ring-inset",
                            )}
                        >
                            {done ? <Check className="size-5" strokeWidth={3} aria-hidden="true" /> : i + 1}
                        </span>
                        <span className={cx("text-md whitespace-nowrap", here ? "font-semibold text-primary" : done ? "text-success-primary" : "text-tertiary")}>
                            {label}
                            {done && <span className="sr-only"> (تم)</span>}
                        </span>
                        {i < steps.length - 1 && <span aria-hidden="true" className={cx("h-0.5 flex-1 rounded-full", done ? "bg-success-solid" : "bg-border-secondary")} />}
                    </li>
                );
            })}
        </ol>
    );
}
