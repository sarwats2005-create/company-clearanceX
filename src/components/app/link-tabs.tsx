import type { FC, ReactNode, SVGProps } from "react";
import { cx } from "@/utils/cx";

export interface LinkTab {
    href: string;
    label: ReactNode;
    isActive: boolean;
    icon?: FC<SVGProps<SVGSVGElement>>;
}

/** Big pill tabs that are plain links (server-rendered, the page lives in the URL). The active one is white and raised. */
export function LinkTabs({ items, label, className }: { items: LinkTab[]; label: string; className?: string }) {
    return (
        <nav aria-label={label} className={cx("-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0", className)}>
            <ul className="inline-flex min-w-max gap-1 rounded-2xl bg-white/60 p-1 shadow-[inset_0_0_0_1px_rgb(16_24_40/0.06)] backdrop-blur-md">
                {items.map((t) => (
                    <li key={t.href}>
                        <a
                            href={t.href}
                            aria-current={t.isActive ? "page" : undefined}
                            className={cx(
                                "flex h-12 items-center gap-2 rounded-xl px-4 text-md outline-focus-ring transition-[background-color,color,box-shadow] duration-150 ease-smooth focus-visible:outline-2",
                                t.isActive ? "bg-primary font-semibold text-primary shadow-card" : "text-tertiary hover:bg-white/70 hover:text-secondary",
                            )}
                        >
                            {t.icon && <t.icon aria-hidden="true" className={cx("size-5", t.isActive ? "text-fg-brand-primary" : "text-fg-quaternary")} />}
                            {t.label}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
