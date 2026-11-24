"use client";

import { useState, type ReactNode } from "react";
import { DotsHorizontal } from "@untitledui/icons";
import { usePathname } from "next/navigation";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { NAV_ITEMS, isActive } from "@/components/app/nav-items";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";

const PRIMARY = NAV_ITEMS.slice(0, 4);
/** Focused tasks hide the bottom navigation on phones (PRD §8.5.4); their own action bar replaces it. */
const FOCUSED = [/^\/containers\/new$/, /^\/containers\/[^/]+\/edit$/];
const MORE = NAV_ITEMS.slice(4);

/** Phone/tablet bottom navigation: 4 main items + "المزيد" (PRD §8.1). */
export function BottomNav({ moreFooter }: { moreFooter?: ReactNode }) {
    const pathname = usePathname();
    const [moreOpen, setMoreOpen] = useState(false);
    const moreActive = MORE.some((i) => isActive(pathname, i.href));
    if (FOCUSED.some((re) => re.test(pathname))) return null;

    const itemClass = (active: boolean) =>
        cx(
            "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs outline-focus-ring transition-[color,transform] duration-150 ease-smooth focus-visible:outline-2 focus-visible:-outline-offset-2 active:scale-[0.97]",
            active ? "font-semibold text-brand-secondary" : "text-tertiary",
        );

    return (
        <>
            <nav
                aria-label={t("nav.menu")}
                className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-secondary bg-primary/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
            >
                <ul className="flex">
                    {PRIMARY.map((item) => {
                        const active = isActive(pathname, item.href);
                        const Icon = item.icon;
                        return (
                            <li key={item.href} className="flex flex-1">
                                <a href={item.href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
                                    <Icon className={cx("size-6", active ? "text-fg-brand-primary" : "text-fg-quaternary")} strokeWidth={1.75} />
                                    {t(item.label)}
                                </a>
                            </li>
                        );
                    })}
                    <li className="flex flex-1">
                        <button type="button" onClick={() => setMoreOpen(true)} className={itemClass(moreActive)}>
                            <DotsHorizontal className={cx("size-6", moreActive ? "text-fg-brand-primary" : "text-fg-quaternary")} strokeWidth={1.75} />
                            {t("nav.more")}
                        </button>
                    </li>
                </ul>
            </nav>

            <SlideoutMenu isOpen={moreOpen} onOpenChange={setMoreOpen} isDismissable>
                <SlideoutMenu.Header onClose={() => setMoreOpen(false)}>
                    <h2 className="text-lg font-semibold text-primary">{t("nav.more")}</h2>
                </SlideoutMenu.Header>
                <SlideoutMenu.Content>
                    <ul className="flex flex-col divide-y divide-secondary">
                        {MORE.map((item) => {
                            const Icon = item.icon;
                            return (
                                <li key={item.href}>
                                    <a href={item.href} className="flex h-14 items-center gap-3 text-md text-primary" onClick={() => setMoreOpen(false)}>
                                        <Icon className="size-5 text-fg-quaternary" strokeWidth={1.75} />
                                        {t(item.label)}
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                </SlideoutMenu.Content>
                {moreFooter && <SlideoutMenu.Footer>{moreFooter}</SlideoutMenu.Footer>}
            </SlideoutMenu>
        </>
    );
}
