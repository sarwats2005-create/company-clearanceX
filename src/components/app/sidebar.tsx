"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { InitialsAvatar } from "@/components/app/initials-avatar";
import { Logo } from "@/components/app/logo";
import { NAV_ITEMS, isActive } from "@/components/app/nav-items";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";

/** Desktop sidebar on the start side (right in RTL), light #FAFAFA with a hairline edge (Part F). */
export function Sidebar({ companyName, userName, footer }: { companyName: string; userName: string; footer?: ReactNode }) {
    const pathname = usePathname();

    return (
        <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-secondary bg-sidebar lg:flex">
            <div className="px-5 pt-6 pb-8">
                <Logo name={companyName} />
            </div>
            <nav aria-label={t("nav.menu")} className="flex-1 px-3">
                <ul className="flex flex-col gap-1">
                    {NAV_ITEMS.map((item) => {
                        const active = isActive(pathname, item.href);
                        const Icon = item.icon;
                        return (
                            <li key={item.href}>
                                <a
                                    href={item.href}
                                    aria-current={active ? "page" : undefined}
                                    className={cx(
                                        "relative flex h-11 items-center gap-3 rounded-lg px-3 text-md outline-focus-ring transition-colors duration-150 ease-smooth focus-visible:outline-2",
                                        active
                                            ? "bg-primary font-semibold text-brand-secondary ring-1 ring-secondary ring-inset"
                                            : "text-secondary hover:bg-primary_hover hover:text-primary",
                                    )}
                                >
                                    {active && <span aria-hidden="true" className="absolute inset-y-2.5 -start-3 w-[3px] rounded-e-full bg-accent-500" />}
                                    <Icon className={cx("size-5 shrink-0", active ? "text-fg-brand-primary" : "text-fg-quaternary")} strokeWidth={1.75} />
                                    {t(item.label)}
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </nav>
            <div className="flex items-center gap-3 border-t border-secondary px-5 py-4">
                <InitialsAvatar name={userName} />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-primary">{userName}</p>
                </div>
                {footer}
            </div>
        </aside>
    );
}
