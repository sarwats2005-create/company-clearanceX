"use client";

import { Plus } from "@untitledui/icons";
import { Button as AriaButton } from "react-aria-components";
import { IconTile } from "@/components/app/icon-tile";
import { NEW_ITEMS } from "@/components/app/nav-items";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";

/** "+ جديد": the one bright button in the top bar. Every choice has its own colored icon. */
export function NewMenu({ compact = false }: { compact?: boolean }) {
    return (
        <Dropdown.Root>
            <AriaButton
                aria-label={t("nav.new")}
                className={cx(
                    "bg-brand-gradient inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl px-4 text-md font-semibold text-white shadow-button-brand outline-focus-ring transition-[filter,transform] duration-150 ease-smooth hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 data-pressed:scale-[0.97]",
                    compact && "px-3",
                )}
            >
                <Plus className="size-5" strokeWidth={2.25} />
                {t("nav.new")}
            </AriaButton>
            <Dropdown.Popover className="w-72 rounded-2xl py-1.5 shadow-xl">
                <Dropdown.Menu>
                    {NEW_ITEMS.map((item) => (
                        <Dropdown.Item key={item.href} id={item.href} href={item.href} textValue={t(item.label)} className="group outline-none" unstyled>
                            <span className="mx-1.5 flex min-h-13 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-1.5 text-md font-medium text-primary transition-colors duration-100 group-data-focused:bg-primary_hover group-data-hovered:bg-primary_hover">
                                <IconTile icon={item.icon} color={item.color} size="md" />
                                {t(item.label)}
                            </span>
                        </Dropdown.Item>
                    ))}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown.Root>
    );
}
