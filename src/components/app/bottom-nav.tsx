"use client";

import { type ReactNode, useState } from "react";
import { DotsGrid } from "@untitledui/icons";
import { usePathname } from "next/navigation";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { IconTile } from "@/components/app/icon-tile";
import { NAV_ITEMS, type NavItem, isActive } from "@/components/app/nav-items";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";

/** Phone tabs: home, containers, the main vault, accounts. Money and settings live under "المزيد". */
const PRIMARY_HREFS = ["/", "/containers", "/vault", "/accounts"];
const PRIMARY = PRIMARY_HREFS.map((h) => NAV_ITEMS.find((i) => i.href === h)!) as NavItem[];
const MORE = NAV_ITEMS.filter((i) => !PRIMARY_HREFS.includes(i.href));
/** Focused tasks hide the bottom navigation on phones; their own action bar replaces it. */
const FOCUSED = [/^\/containers\/new$/, /^\/containers\/[^/]+\/edit$/];

/** Floating, frosted phone/tablet tab bar. The active tab shows its colored icon tile. */
export function BottomNav({ moreFooter }: { moreFooter?: ReactNode }) {
    const pathname = usePathname();
    const [moreOpen, setMoreOpen] = useState(false);
    const moreActive = MORE.some((i) => isActive(pathname, i));
    if (FOCUSED.some((re) => re.test(pathname))) return null;

    const itemClass = (active: boolean) =>
        cx(
            "flex h-[4.25rem] flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl text-xs outline-focus-ring transition-[color,transform] duration-150 ease-smooth focus-visible:outline-2 focus-visible:-outline-offset-2 active:scale-[0.96]",
            active ? "font-semibold text-primary" : "text-tertiary",
        );
    const iconBox = (active: boolean, item: NavItem | null) =>
        active && item ? (
            <IconTile icon={item.icon} color={item.color} size="sm" />
        ) : (
            <span aria-hidden="true" className="inline-flex size-8 items-center justify-center">
                {item ? <item.icon className="size-6 text-fg-tertiary" strokeWidth={1.75} /> : <DotsGrid className="size-6 text-fg-tertiary" strokeWidth={1.75} />}
            </span>
        );

    return (
        <>
            <nav
                aria-label={t("nav.menu")}
                className="glass no-print fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 rounded-3xl p-1 shadow-[0_0_0_1px_rgb(16_24_40/0.06),0_16px_40px_-12px_rgb(11_31_92/0.35)] lg:hidden"
            >
                <ul className="flex">
                    {PRIMARY.map((item) => {
                        const active = isActive(pathname, item);
                        return (
                            <li key={item.href} className="flex flex-1">
                                <a href={item.href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
                                    {iconBox(active, item)}
                                    {t(item.label)}
                                </a>
                            </li>
                        );
                    })}
                    <li className="flex flex-1">
                        <button type="button" onClick={() => setMoreOpen(true)} className={itemClass(moreActive)}>
                            {moreActive ? (
                                <IconTile icon={DotsGrid} color="gray" size="sm" />
                            ) : (
                                iconBox(false, null)
                            )}
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
                    <ul className="grid grid-cols-2 gap-3">
                        {NAV_ITEMS.map((item) => (
                            <li key={item.href}>
                                <a
                                    href={item.href}
                                    onClick={() => setMoreOpen(false)}
                                    aria-current={isActive(pathname, item) ? "page" : undefined}
                                    className="surface flex h-28 flex-col items-start justify-between p-4 text-md font-semibold text-primary outline-focus-ring transition-transform duration-150 ease-smooth focus-visible:outline-2 active:scale-[0.97] aria-[current=page]:ring-2 aria-[current=page]:ring-brand"
                                >
                                    <IconTile icon={item.icon} color={item.color} size="md" />
                                    {t(item.label)}
                                </a>
                            </li>
                        ))}
                    </ul>
                </SlideoutMenu.Content>
                {moreFooter && <SlideoutMenu.Footer>{moreFooter}</SlideoutMenu.Footer>}
            </SlideoutMenu>
        </>
    );
}
