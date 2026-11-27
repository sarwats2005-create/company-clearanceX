"use client";

import { usePathname } from "next/navigation";
import { IconTile } from "@/components/app/icon-tile";
import { cx } from "@/utils/cx";
import { SETTINGS_GROUPS } from "./sections";

/** Desktop sub-navigation for Settings (start side): the same groups and icons as the Settings home. */
export function SettingsNav() {
    const pathname = usePathname();
    // The Settings home already shows every section as cards.
    if (pathname === "/settings") return null;
    return (
        <nav aria-label="أقسام الإعدادات" className="surface sticky top-6 hidden w-72 shrink-0 p-2 lg:block">
            {SETTINGS_GROUPS.map((g) => (
                <div key={g.title} className="flex flex-col gap-0.5 py-1.5 [&+&]:border-t [&+&]:border-secondary">
                    <p className="px-3 pt-1 pb-1 text-xs font-semibold text-quaternary">{g.title}</p>
                    <ul className="flex flex-col gap-0.5">
                        {g.sections.map((s) => {
                            const active = pathname === `/settings/${s.slug}`;
                            return (
                                <li key={s.slug}>
                                    <a
                                        href={`/settings/${s.slug}`}
                                        aria-current={active ? "page" : undefined}
                                        className={cx(
                                            "flex min-h-11 items-center gap-3 rounded-xl px-2 text-md outline-focus-ring transition-colors duration-150 ease-smooth focus-visible:outline-2",
                                            active ? "bg-brand-primary_alt font-semibold text-primary" : "text-secondary hover:bg-primary_hover",
                                        )}
                                    >
                                        <IconTile icon={s.icon} color={s.color} size="sm" />
                                        {s.title}
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>
    );
}
