import type { ReactNode } from "react";
import { BottomNav } from "@/components/app/bottom-nav";
import { MobileHeader } from "@/components/app/mobile-header";
import { NewMenu } from "@/components/app/new-menu";
import { Sidebar } from "@/components/app/sidebar";
import { t } from "@/lib/i18n";

export default async function AppLayout({ children }: { children: ReactNode }) {
    const companyName = t("app.name");
    const userName = "المالك";

    return (
        <div className="min-h-dvh bg-primary">
            <Sidebar companyName={companyName} userName={userName} />
            <MobileHeader companyName={companyName} />
            <div className="lg:ps-64">
                <div className="no-print hidden items-center justify-end gap-3 px-8 pt-6 lg:flex">
                    <NewMenu />
                </div>
                <main className="mx-auto w-full max-w-[1280px] px-4 pt-6 pb-28 md:px-6 lg:px-8 lg:pt-6 lg:pb-12">{children}</main>
            </div>
            <BottomNav />
        </div>
    );
}
