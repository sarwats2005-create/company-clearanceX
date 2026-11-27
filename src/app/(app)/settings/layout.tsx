import type { ReactNode } from "react";
import { Settings01 } from "@untitledui/icons";
import { PageHeader } from "@/components/app/page-header";
import { SettingsNav } from "@/components/app/settings/settings-nav";
import { requireSession } from "@/lib/auth";
import { t } from "@/lib/i18n";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
    await requireSession();
    return (
        <div className="flex flex-col gap-6">
            <PageHeader icon={Settings01} iconColor="gray" title={t("nav.settings")} description="كل ما يتحكم بطريقة عمل البرنامج" className="hidden lg:flex" />
            <div className="flex items-start gap-8">
                <SettingsNav />
                {children}
            </div>
        </div>
    );
}
