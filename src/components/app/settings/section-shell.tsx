import type { ReactNode } from "react";
import { ChevronRight, Settings01 } from "@untitledui/icons";
import { IconTile } from "@/components/app/icon-tile";
import { SETTINGS_SECTIONS } from "./sections";

/** Title block of one settings page (its colored icon, title, hint), with a back link to the list on phones. */
export function SectionShell({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
    const section = SETTINGS_SECTIONS.find((s) => s.title === title);
    return (
        <section className="flex min-w-0 flex-1 flex-col gap-5">
            <a href="/settings" className="flex min-h-9 w-fit items-center gap-1 rounded-md text-sm text-tertiary outline-focus-ring hover:text-secondary focus-visible:outline-2 lg:hidden">
                <ChevronRight className="size-4" />
                الإعدادات
            </a>
            <div className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
                <div className="flex items-center gap-4">
                    <IconTile icon={section?.icon ?? Settings01} color={section?.color ?? "gray"} size="lg" />
                    <div className="flex flex-col gap-0.5">
                        <h2 className="text-xl font-semibold text-primary">{title}</h2>
                        {description && <p className="text-md text-tertiary">{description}</p>}
                    </div>
                </div>
                {actions}
            </div>
            {children}
        </section>
    );
}
