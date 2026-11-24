import type { Metadata } from "next";
import { ChevronLeft } from "@untitledui/icons";
import { PageHeader } from "@/components/app/page-header";
import { SETTINGS_SECTIONS } from "@/components/app/settings/sections";
import { requireSession } from "@/lib/auth";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: "الإعدادات" };

export default async function SettingsIndex() {
    await requireSession();
    return (
        <div className="flex min-w-0 flex-1 flex-col gap-6">
            <PageHeader title={t("nav.settings")} className="lg:hidden" />
            <ul className="flex flex-col divide-y divide-secondary">
                {SETTINGS_SECTIONS.map((s) => (
                    <li key={s.slug}>
                        <a href={`/settings/${s.slug}`} className="group flex items-center gap-4 py-4">
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="text-md font-semibold text-primary">{s.title}</span>
                                <span className="truncate text-sm text-tertiary">{s.description}</span>
                            </div>
                            <ChevronLeft className="size-5 shrink-0 text-fg-quaternary transition-transform duration-150 ease-smooth group-hover:-translate-x-0.5" />
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
