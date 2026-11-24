import type { ReactNode } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SettingsNav } from "@/components/app/settings/settings-nav";
import { requireSession } from "@/lib/auth";
import { t } from "@/lib/i18n";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
    await requireSession();
    return (
        <div className="flex flex-col gap-8">
            <PageHeader title={t("nav.settings")} className="hidden lg:flex" />
            <div className="flex gap-10">
                <SettingsNav />
                {children}
            </div>
        </div>
    );
}
