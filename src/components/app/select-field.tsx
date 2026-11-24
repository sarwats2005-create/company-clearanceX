"use client";

import { Select } from "@/components/base/select/select";

export interface Option {
    id: string;
    label: string;
    supportingText?: string;
    isDisabled?: boolean;
}

interface SelectFieldProps {
    label?: string;
    "aria-label"?: string;
    items: Option[];
    value: string | null;
    onChange: (id: string) => void;
    placeholder?: string;
    hint?: string;
    isInvalid?: boolean;
    isRequired?: boolean;
    isDisabled?: boolean;
    className?: string;
}

/** Kit Select with our defaults (large, Arabic placeholder). */
export function SelectField({ label, items, value, onChange, placeholder = "اختر", hint, isInvalid, isRequired, isDisabled, className, ...rest }: SelectFieldProps) {
    return (
        <Select
            label={label}
            aria-label={rest["aria-label"] ?? label}
            size="lg"
            items={items}
            selectedKey={value}
            onSelectionChange={(k) => k !== null && onChange(String(k))}
            placeholder={placeholder}
            hint={hint}
            isInvalid={isInvalid}
            isRequired={isRequired}
            isDisabled={isDisabled}
            className={className}
        >
            {(item) => <Select.Item id={item.id} label={item.label} supportingText={item.supportingText} isDisabled={item.isDisabled} />}
        </Select>
    );
}
