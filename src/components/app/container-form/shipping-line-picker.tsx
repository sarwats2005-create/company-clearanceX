"use client";

import { Check, Plus } from "@untitledui/icons";
import { Radio as AriaRadio, RadioGroup as AriaRadioGroup, Label as AriaLabel } from "react-aria-components";
import { ShippingLineLogo } from "@/components/app/shipping-line-logo";
import { cx } from "@/utils/cx";

export interface PickerLine {
    id: string;
    name: string;
    logo: string | null;
    website: string | null;
    isActive: boolean;
}

/**
 * Pick the shipping line by its logo: a grid of big tiles. Recognising a logo is faster and surer than
 * reading a list of names, especially for an owner who doesn't read English easily.
 */
export function ShippingLinePicker({
    lines,
    value,
    onChange,
    onAdd,
    isInvalid,
    hint,
}: {
    lines: PickerLine[];
    value: string | null;
    onChange: (id: string) => void;
    onAdd: () => void;
    isInvalid?: boolean;
    hint?: React.ReactNode;
}) {
    const shown = lines.filter((l) => l.isActive || l.id === value);
    return (
        <div className="flex flex-col gap-2">
            <AriaRadioGroup value={value ?? ""} onChange={onChange} isInvalid={isInvalid} aria-describedby={hint ? "line-hint" : undefined} className="flex flex-col gap-2">
                <AriaLabel className="text-sm font-medium text-secondary">
                    خط الشحن <span className="text-brand-tertiary">*</span>
                </AriaLabel>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {shown.map((l) => (
                        <AriaRadio
                            key={l.id}
                            value={l.id}
                            className={({ isSelected, isFocusVisible }) =>
                                cx(
                                    "relative flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-primary p-2 text-center ring-1 transition-[box-shadow,transform,background-color] duration-150 ease-smooth ring-inset select-none data-pressed:scale-[0.96]",
                                    isSelected ? "bg-brand-primary_alt shadow-card ring-2 ring-brand" : "shadow-xs ring-secondary hover:shadow-card",
                                    isFocusVisible && "outline-2 outline-offset-2 outline-focus-ring",
                                )
                            }
                        >
                            {({ isSelected }) => (
                                <>
                                    <ShippingLineLogo line={l} size="lg" />
                                    <bdi className={cx("text-sm leading-tight", isSelected ? "font-semibold text-primary" : "text-secondary")}>{l.name}</bdi>
                                    {isSelected && (
                                        <span aria-hidden="true" className="absolute -top-1.5 -end-1.5 inline-flex size-6 items-center justify-center rounded-full bg-brand-solid text-white shadow-md">
                                            <Check className="size-4" strokeWidth={3} />
                                        </span>
                                    )}
                                </>
                            )}
                        </AriaRadio>
                    ))}
                    <button
                        type="button"
                        onClick={onAdd}
                        className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary p-2 text-sm text-tertiary outline-focus-ring transition-colors duration-150 hover:border-brand hover:text-brand-secondary focus-visible:outline-2 active:scale-[0.96]"
                    >
                        <span aria-hidden="true" className="inline-flex size-14 items-center justify-center rounded-2xl bg-secondary">
                            <Plus className="size-6" />
                        </span>
                        خط جديد
                    </button>
                </div>
            </AriaRadioGroup>
            {hint && (
                <p id="line-hint" className={cx("text-sm", isInvalid ? "text-error-primary" : "text-tertiary")}>
                    {hint}
                </p>
            )}
        </div>
    );
}
