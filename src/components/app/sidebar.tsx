"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { IconTile } from "@/components/app/icon-tile";
import { InitialsAvatar } from "@/components/app/initials-avatar";
import { LogoMark } from "@/components/app/logo";
import { NAV_ITEMS, isActive } from "@/components/app/nav-items";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";

/** Desktop sidebar on the start side (right in RTL): deep navy gradient, a colored icon tile per item. */
export function Sidebar({ companyName, userName, footer }: { companyName: string; userName: string; footer?: ReactNode }) {
    const pathname = usePathname();

    return (
        <aside className="no-print fixed inset-y-3 start-3 z-30 hidden w-64 flex-col overflow-hidden rounded-[1.75rem] bg-hero shadow-hero lg:flex">
            <a href="/" className="flex items-center gap-3 px-5 pt-6 pb-7 outline-focus-ring focus-visible:outline-2">
                <LogoMark className="size-10" onDark />
                <span className="flex min-w-0 flex-col">
                    <span className="truncate text-md font-semibold text-white">{companyName}</span>
                    <span className="text-xs text-white/60">إدارة تخليص الحاويات</span>
                </span>
            </a>
            <nav aria-label={t("nav.menu")} className="flex-1 overflow-y-auto px-3">
                <ul className="flex flex-col gap-1.5">
                    {NAV_ITEMS.map((item) => {
                        const active = isActive(pathname, item);
                        return (
                            <li key={item.href}>
                                <a
                                    href={item.href}
                                    aria-current={active ? "page" : undefined}
                                    className={cx(
                                        "relative flex h-13 items-center gap-3 rounded-2xl px-2.5 text-md outline-white transition-[background-color,transform] duration-150 ease-smooth focus-visible:outline-2 active:scale-[0.98]",
                                        active ? "bg-white/15 font-semibold text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)]" : "text-white/80 hover:bg-white/8 hover:text-white",
                                    )}
                                >
                                    <IconTile icon={item.icon} color={item.color} size="sm" />
                                    {t(item.label)}
                                    {active && <span aria-hidden="true" className="ms-auto size-2 rounded-full bg-accent-400" />}
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </nav>
            <div className="m-3 flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-3">
                <InitialsAvatar name={userName} className="bg-white/15 text-white ring-white/20" />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{userName}</p>
                    <p className="text-xs text-white/60">المالك</p>
                </div>
                {footer}
            </div>
        </aside>
    );
}
