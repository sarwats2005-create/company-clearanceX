"use client";

import type { ReactNode } from "react";
import { Radio as AriaRadio, RadioGroup as AriaRadioGroup } from "react-aria-components";
import { cx } from "@/utils/cx";

export interface SegmentOption<T extends string> {
    value: T;
    label: ReactNode;
    isDisabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
    label?: string;
    "aria-label"?: string;
    value: T | null;
    onChange: (value: T) => void;
    options: SegmentOption<T>[];
    size?: "md" | "lg";
    fullWidth?: boolean;
    className?: string;
    isDisabled?: boolean;
}

/** Big, tappable one-of-N buttons (currency, size, split unit, text size). React Aria RadioGroup underneath. */
export function SegmentedControl<T extends string>({ label, value, onChange, options, size = "lg", fullWidth, className, isDisabled, ...rest }: SegmentedControlProps<T>) {
    return (
        <AriaRadioGroup
            aria-label={rest["aria-label"] ?? label}
            value={value ?? ""}
            onChange={(v) => onChange(v as T)}
            orientation="horizontal"
            isDisabled={isDisabled}
            className={cx("flex flex-col gap-1.5", className)}
        >
            {label && <span className="text-sm font-medium text-secondary">{label}</span>}
            <div className={cx("flex gap-1 rounded-2xl bg-secondary p-1 ring-1 ring-secondary ring-inset", fullWidth ? "w-full" : "w-fit max-w-full flex-wrap")}>
                {options.map((o) => (
                    <AriaRadio
                        key={o.value}
                        value={o.value}
                        isDisabled={o.isDisabled}
                        className={({ isSelected, isFocusVisible, isDisabled: d }) =>
                            cx(
                                "flex cursor-pointer items-center justify-center rounded-xl px-4 text-md whitespace-nowrap outline-focus-ring transition-[background-color,color,box-shadow,transform] duration-150 ease-smooth select-none data-pressed:scale-[0.97]",
                                size === "lg" ? "h-11" : "h-9 text-sm",
                                fullWidth && "flex-1",
                                isSelected ? "bg-primary font-semibold text-brand-secondary shadow-card ring-1 ring-secondary" : "text-tertiary hover:text-secondary",
                                isFocusVisible && "outline-2 outline-offset-2",
                                d && "cursor-not-allowed opacity-50",
                            )
                        }
                    >
                        {o.label}
                    </AriaRadio>
                ))}
            </div>
        </AriaRadioGroup>
    );
}
