import type { Metadata } from "next";
import { ChevronLeft, Settings01 } from "@untitledui/icons";
import { IconTile } from "@/components/app/icon-tile";
import { PageHeader } from "@/components/app/page-header";
import { SETTINGS_GROUPS } from "@/components/app/settings/sections";
import { requireSession } from "@/lib/auth";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: "الإعدادات" };

/** Settings home: grouped white cards, one row per page, each with its colored icon (phone-settings style). */
export default async function SettingsIndex() {
    await requireSession();
    return (
        <div className="flex min-w-0 flex-1 flex-col gap-6">
            <PageHeader icon={Settings01} iconColor="gray" title={t("nav.settings")} description="كل ما يتحكم بطريقة عمل البرنامج" className="lg:hidden" />
            <div className="grid gap-6 xl:grid-cols-2">
                {SETTINGS_GROUPS.map((g) => (
                    <section key={g.title} aria-labelledby={`g-${g.title}`} className="flex flex-col gap-2">
                        <h2 id={`g-${g.title}`} className="px-1 text-sm font-semibold text-tertiary">
                            {g.title}
                        </h2>
                        <ul className="surface flex flex-col divide-y divide-secondary overflow-hidden">
                            {g.sections.map((s) => (
                                <li key={s.slug}>
                                    <a
                                        href={`/settings/${s.slug}`}
                                        className="group flex min-h-18 items-center gap-4 px-4 py-3 outline-focus-ring transition-colors duration-100 hover:bg-primary_hover focus-visible:outline-2 focus-visible:-outline-offset-2 active:bg-secondary"
                                    >
                                        <IconTile icon={s.icon} color={s.color} size="md" />
                                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                            <span className="text-md font-semibold text-primary">{s.title}</span>
                                            <span className="text-sm text-tertiary">{s.description}</span>
                                        </div>
                                        <ChevronLeft className="size-5 shrink-0 text-fg-quaternary transition-transform duration-150 ease-smooth group-hover:-translate-x-0.5" />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        </div>
    );
}
