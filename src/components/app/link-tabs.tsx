import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

export interface LinkTab {
    href: string;
    label: ReactNode;
    isActive: boolean;
}

/** Underline tabs that are plain links (server-rendered, the page lives in the URL). The active tab carries the navy rule. */
export function LinkTabs({ items, label, className }: { items: LinkTab[]; label: string; className?: string }) {
    return (
        <nav aria-label={label} className={cx("-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0", className)}>
            <ul className="flex min-w-max gap-6 border-b border-secondary">
                {items.map((t) => (
                    <li key={t.href}>
                        <a
                            href={t.href}
                            aria-current={t.isActive ? "page" : undefined}
                            className={cx(
                                "relative -mb-px flex h-12 items-center rounded-t-md px-0.5 text-md outline-focus-ring transition-colors duration-100 ease-linear focus-visible:outline-2",
                                t.isActive ? "font-semibold text-primary" : "text-tertiary hover:text-secondary",
                            )}
                        >
                            {t.label}
                            {t.isActive && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-solid" />}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
