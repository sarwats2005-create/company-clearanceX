import type { ReactNode } from "react";
import { ArrowRight, ChevronLeft } from "@untitledui/icons";

/** Header of a focused form page (PRD §8.5.3/§8.5.5): breadcrumb, 16px, title, 4px, description. */
export function FormPageHeader({
    parent,
    title,
    crumb,
    description,
}: {
    parent: { href: string; label: string };
    title: ReactNode;
    /** Short last crumb when the title is long; defaults to the title. */
    crumb?: ReactNode;
    description?: ReactNode;
}) {
    return (
        <header className="mb-5 lg:mb-6">
            <nav aria-label="مسار الصفحة" className="text-sm text-tertiary">
                <a href={parent.href} className="inline-flex items-center gap-1.5 rounded-md outline-focus-ring hover:text-secondary focus-visible:outline-2 md:hidden">
                    <ArrowRight className="size-5" aria-hidden="true" />
                    <bdi>{parent.label}</bdi>
                </a>
                <span className="hidden items-center gap-1.5 md:inline-flex">
                    <a href={parent.href} className="rounded-md outline-focus-ring hover:text-secondary focus-visible:outline-2">
                        <bdi>{parent.label}</bdi>
                    </a>
                    <ChevronLeft className="size-4 text-fg-quaternary" aria-hidden="true" />
                    <span className="text-secondary">{crumb ?? title}</span>
                </span>
            </nav>
            <h1 className="mt-3 text-display-xs font-semibold text-primary">{title}</h1>
            {description && <p className="mt-1 text-md text-tertiary">{description}</p>}
        </header>
    );
}
