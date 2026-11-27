"use client";

import { usePathname } from "next/navigation";
import { cx } from "@/utils/cx";
import { SETTINGS_SECTIONS } from "./sections";

/** Desktop sub-navigation for Settings (start side). */
export function SettingsNav() {
    const pathname = usePathname();
    return (
        <nav aria-label="أقسام الإعدادات" className="hidden w-60 shrink-0 lg:block">
            <ul className="sticky top-6 flex flex-col gap-0.5">
                {SETTINGS_SECTIONS.map((s) => {
                    const active = pathname === `/settings/${s.slug}`;
                    return (
                        <li key={s.slug}>
                            <a
                                href={`/settings/${s.slug}`}
                                aria-current={active ? "page" : undefined}
                                className={cx(
                                    "flex h-10 items-center rounded-lg px-3 text-md outline-focus-ring transition-colors duration-150 ease-smooth focus-visible:outline-2",
                                    active ? "bg-secondary font-semibold text-primary" : "text-tertiary hover:bg-primary_hover hover:text-secondary",
                                )}
                            >
                                {s.title}
                            </a>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
