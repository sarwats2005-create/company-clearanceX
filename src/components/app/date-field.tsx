"use client";

import { type ReactNode, useContext } from "react";
import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
import { Calendar as CalendarIcon } from "@untitledui/icons";
import {
    Button as AriaButton,
    CalendarStateContext as AriaCalendarStateContext,
    DateInput as AriaDateInput,
    DatePicker as AriaDatePicker,
    DateSegment as AriaDateSegment,
    Dialog as AriaDialog,
    Group as AriaGroup,
    Popover as AriaPopover,
} from "react-aria-components";
import { Calendar } from "@/components/application/date-picker/calendar";
import { Button } from "@/components/base/buttons/button";
import { HintText } from "@/components/base/input/hint-text";
import { Label } from "@/components/base/input/label";
import { cx } from "@/utils/cx";

function TodayButton() {
    const state = useContext(AriaCalendarStateContext);
    return (
        <Button
            slot={null}
            size="sm"
            color="secondary"
            className="w-full"
            onClick={() => {
                const d = today(getLocalTimeZone());
                state?.setValue(d);
                state?.setFocusedDate(d);
            }}
        >
            اليوم
        </Button>
    );
}

const toValue = (v: string | null | undefined) => {
    if (!v) return null;
    try {
        return parseDate(v);
    } catch {
        return null;
    }
};

interface DateFieldProps {
    label?: ReactNode;
    "aria-label"?: string;
    /** yyyy-mm-dd or null */
    value: string | null;
    onChange: (value: string | null) => void;
    hint?: ReactNode;
    isInvalid?: boolean;
    isRequired?: boolean;
    isDisabled?: boolean;
    className?: string;
}

/**
 * Date in dd/MM/yyyy with Latin digits (PRD §10.5 item 9): type it, or pick it from the calendar.
 * The digits sit on the same start edge as the Arabic label above (dir=ltr, text-end).
 */
export function DateField({ label, value, onChange, hint, isInvalid, isRequired, isDisabled, className, ...rest }: DateFieldProps) {
    return (
        <AriaDatePicker
            aria-label={rest["aria-label"]}
            value={toValue(value)}
            onChange={(d) => onChange(d ? d.toString() : null)}
            isInvalid={isInvalid}
            isRequired={isRequired}
            isDisabled={isDisabled}
            granularity="day"
            shouldForceLeadingZeros
            className={cx("group flex flex-col gap-1.5", className)}
        >
            {label && <Label isRequired={isRequired}>{label}</Label>}
            <AriaGroup
                className={({ isFocusWithin, isInvalid: invalid, isDisabled: disabled }) =>
                    cx(
                        "flex h-12 w-full items-center gap-2 rounded-lg bg-primary ps-3.5 pe-1.5 shadow-xs ring-1 ring-primary transition-shadow duration-100 ease-linear ring-inset",
                        isFocusWithin && "ring-2 ring-brand",
                        invalid && "ring-error_subtle",
                        invalid && isFocusWithin && "ring-2 ring-error",
                        disabled && "cursor-not-allowed opacity-50",
                    )
                }
            >
                <AriaDateInput dir="ltr" className="flex flex-1 justify-end text-md text-primary tabular-nums">
                    {(segment) => (
                        <AriaDateSegment
                            segment={segment}
                            className={({ isPlaceholder, isFocused }) =>
                                cx(
                                    "rounded px-0.5 outline-hidden",
                                    segment.type === "literal" && "px-0 text-quaternary",
                                    isPlaceholder && "text-placeholder",
                                    isFocused && "bg-brand-solid text-white",
                                )
                            }
                        />
                    )}
                </AriaDateInput>
                <AriaButton
                    aria-label="اختر من التقويم"
                    className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-quaternary outline-focus-ring transition-[color,transform] duration-150 ease-smooth hover:text-fg-secondary focus-visible:outline-2 data-pressed:scale-[0.97]"
                >
                    <CalendarIcon className="size-5" aria-hidden="true" />
                </AriaButton>
            </AriaGroup>
            {hint && <HintText isInvalid={isInvalid}>{hint}</HintText>}
            <AriaPopover
                offset={8}
                placement="bottom end"
                className={({ isEntering, isExiting }) =>
                    cx(
                        "origin-(--trigger-anchor-point) will-change-transform",
                        isEntering && "duration-150 ease-smooth animate-in fade-in zoom-in-95",
                        isExiting && "duration-100 ease-smooth animate-out fade-out zoom-out-95",
                    )
                }
            >
                <AriaDialog aria-label="التقويم" className="rounded-2xl bg-primary p-4 shadow-xl ring ring-secondary_alt outline-hidden">
                    <Calendar>
                        <TodayButton />
                    </Calendar>
                </AriaDialog>
            </AriaPopover>
        </AriaDatePicker>
    );
}
