"use client";

import type { FC, ReactNode } from "react";
import { ChevronDown } from "@untitledui/icons";
import { cx } from "@/utils/cx";

interface FormSectionProps {
    id: string;
    step: string;
    title: string;
    icon: FC<{ className?: string; "aria-hidden"?: boolean | "true" }>;
    /** "مطلوب" instead of "اختياري · n من m" */
    required?: boolean;
    filled?: number;
    total?: number;
    /** One line of what is filled, shown while folded. */
    preview?: string;
    isOpen: boolean;
    /** Leave out for a section that cannot fold. */
    onToggle?: () => void;
    /** The essentials card: 2px brand start border (PRD §8.5.5 rule 7). */
    accent?: boolean;
    children: ReactNode;
}

/** One numbered card of the container form (PRD §8.5.2, §8.5.5). */
export function FormSection({ id, step, title, icon: Icon, required, filled = 0, total = 0, preview, isOpen, onToggle, accent, children }: FormSectionProps) {
    const status = required ? "مطلوب" : `اختياري · ${filled} من ${total}`;
    const head = (
        <>
            <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary tabular-nums ring-1 ring-secondary">
                {step}
            </span>
            <Icon className="size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-start">
                <span className="text-lg font-semibold text-primary">{title}</span>
                {!isOpen && preview && <span className="w-full truncate text-sm text-tertiary">{preview}</span>}
            </span>
            <span className={cx("shrink-0 text-sm", required ? "font-semibold text-brand-secondary" : "text-tertiary")}>{status}</span>
            {onToggle && (
                <ChevronDown aria-hidden="true" className={cx("size-5 shrink-0 text-fg-quaternary transition-transform duration-200 ease-smooth", isOpen && "rotate-180")} />
            )}
        </>
    );

    return (
        <section id={id} aria-labelledby={`${id}-title`} className={cx("scroll-mt-6 rounded-xl bg-primary shadow-xs ring-1 ring-secondary", accent && "border-s-2 border-brand")}>
            {onToggle ? (
                <h2 id={`${id}-title`} className="m-0">
                    <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`${id}-body`}
                        onClick={onToggle}
                        className={cx(
                            "flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 outline-focus-ring focus-visible:outline-2 md:px-6",
                            isOpen && "rounded-b-none border-b border-secondary",
                        )}
                    >
                        {head}
                    </button>
                </h2>
            ) : (
                <h2 id={`${id}-title`} className="m-0 flex min-h-16 items-center gap-3 border-b border-secondary px-4 py-3 md:px-6">
                    {head}
                </h2>
            )}
            {isOpen && (
                <div id={`${id}-body`} className="flex animate-in flex-col gap-5 px-4 pt-5 pb-4 duration-200 ease-smooth fade-in slide-in-from-top-1 md:px-6 md:pb-6">
                    {children}
                </div>
            )}
        </section>
    );
}
