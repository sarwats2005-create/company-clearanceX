"use client";

import { Plus } from "@untitledui/icons";
import { Button as AriaButton } from "react-aria-components";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { NEW_ITEMS } from "@/components/app/nav-items";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";

/** "+ جديد" quick-create menu. Quiet (outlined) so the page keeps its single navy button. */
export function NewMenu({ compact = false }: { compact?: boolean }) {
    return (
        <Dropdown.Root>
            <AriaButton
                aria-label={t("nav.new")}
                className={cx(
                    "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3.5 text-md font-semibold text-secondary ring-1 ring-primary outline-focus-ring transition-[background-color,transform] duration-150 ease-smooth ring-inset hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2 data-pressed:scale-[0.97]",
                    compact && "size-11 justify-center px-0",
                )}
            >
                <Plus className="size-5 text-fg-quaternary" />
                {!compact && t("nav.new")}
            </AriaButton>
            <Dropdown.Popover className="w-60">
                <Dropdown.Menu>
                    {NEW_ITEMS.map((item) => (
                        <Dropdown.Item key={item.href} href={item.href} label={t(item.label)} />
                    ))}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown.Root>
    );
}
