"use client";

import type { FC, ReactNode, SVGProps } from "react";
import { ChevronDown } from "@untitledui/icons";
import { IconTile, type TileColor } from "@/components/app/icon-tile";
import { cx } from "@/utils/cx";

interface FormSectionProps {
    id: string;
    step: string;
    title: string;
    icon: FC<SVGProps<SVGSVGElement>>;
    color?: TileColor;
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
export function FormSection({ id, step, title, icon, color = "brand", required, filled = 0, total = 0, preview, isOpen, onToggle, accent, children }: FormSectionProps) {
    const status = required ? "مطلوب" : `اختياري · ${filled} من ${total}`;
    const head = (
        <>
            <span className="relative">
                <IconTile icon={icon} color={color} size="md" />
                <span
                    aria-hidden="true"
                    className="absolute -end-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[0.65rem] font-bold text-secondary tabular-nums shadow-xs ring-1 ring-secondary"
                >
                    {step}
                </span>
            </span>
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
        <section id={id} aria-labelledby={`${id}-title`} className={cx("surface scroll-mt-6", accent && "ring-2 ring-brand/30")}>
            {onToggle ? (
                <h2 id={`${id}-title`} className="m-0">
                    <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`${id}-body`}
                        onClick={onToggle}
                        className={cx(
                            "flex min-h-18 w-full cursor-pointer items-center gap-3 rounded-[1.25rem] px-4 py-3 outline-focus-ring focus-visible:outline-2 md:px-6",
                            isOpen && "rounded-b-none border-b border-secondary",
                        )}
                    >
                        {head}
                    </button>
                </h2>
            ) : (
                <h2 id={`${id}-title`} className="m-0 flex min-h-18 items-center gap-3 border-b border-secondary px-4 py-3 md:px-6">
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
