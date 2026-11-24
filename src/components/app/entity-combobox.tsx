"use client";

import { type FC, type ReactNode, useMemo, useState } from "react";
import { ComboBox } from "@/components/base/select/combobox";
import { Select } from "@/components/base/select/select";
import { arabicIncludes } from "@/lib/text";

const NEW_KEY = "__new__";

export interface EntityOption {
    id: string;
    label: string;
    supportingText?: string;
}

interface EntityComboboxProps {
    label?: ReactNode;
    "aria-label": string;
    items: EntityOption[];
    value: string | null;
    onChange: (id: string | null) => void;
    /** Text of the last option, e.g. "إضافة خط جديد". Shown only with onAdd. */
    addLabel?: string;
    /** Called with what the owner typed, to open the quick-add dialog. */
    onAdd?: (typed: string) => void;
    placeholder?: string;
    hint?: ReactNode;
    icon?: FC;
    isRequired?: boolean;
    isInvalid?: boolean;
    isDisabled?: boolean;
    autoFocus?: boolean;
    className?: string;
}

/**
 * Searchable picker (PRD §5.2): forgiving Arabic matching, and a last option "+ إضافة …"
 * that adds a missing name without leaving the form.
 */
export function EntityCombobox({ items, value, onChange, addLabel, onAdd, placeholder = "اختر أو ابحث", label, ...rest }: EntityComboboxProps) {
    const [typed, setTyped] = useState("");
    const addText = addLabel ? `+ ${addLabel}` : "";
    const withAdd = !!(onAdd && addLabel);
    const list = useMemo(() => (withAdd ? [...items, { id: NEW_KEY, label: addText }] : items), [items, withAdd, addText]);
    const selectedLabel = items.find((i) => i.id === value)?.label ?? "";

    return (
        <ComboBox
            label={label}
            aria-label={rest["aria-label"]}
            size="lg"
            shortcut={false}
            icon={rest.icon}
            placeholder={placeholder}
            hint={rest.hint}
            isRequired={rest.isRequired}
            isInvalid={rest.isInvalid}
            isDisabled={rest.isDisabled}
            autoFocus={rest.autoFocus}
            className={rest.className}
            items={list}
            selectedKey={value}
            onInputChange={setTyped}
            defaultFilter={(text, input) => text === addText || arabicIncludes(text, input)}
            onSelectionChange={(key) => {
                if (key === NEW_KEY) {
                    onAdd?.(typed.trim() === selectedLabel ? "" : typed.trim());
                    return;
                }
                onChange(key === null ? null : String(key));
            }}
        >
            {(item) => (
                <Select.Item
                    id={item.id}
                    label={item.label}
                    supportingText={item.supportingText}
                    className={item.id === NEW_KEY ? "border-t border-secondary font-semibold *:text-brand-secondary" : undefined}
                />
            )}
        </ComboBox>
    );
}
