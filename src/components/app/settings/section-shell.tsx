import type { ReactNode } from "react";
import { ChevronRight } from "@untitledui/icons";

/** Title block of one settings page, with a back link to the list on phones. */
export function SectionShell({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
    return (
        <section className="flex min-w-0 flex-1 flex-col gap-6">
            <a href="/settings" className="flex w-fit items-center gap-1 text-sm text-tertiary hover:text-secondary lg:hidden">
                <ChevronRight className="size-4" />
                الإعدادات
            </a>
            <div className="flex flex-col gap-4 border-b border-secondary pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-semibold text-primary">{title}</h2>
                    {description && <p className="text-md text-tertiary">{description}</p>}
                </div>
                {actions}
            </div>
            {children}
        </section>
    );
}
