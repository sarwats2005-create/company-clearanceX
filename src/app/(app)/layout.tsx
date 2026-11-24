import type { ReactNode } from "react";
import { BottomNav } from "@/components/app/bottom-nav";
import { GlobalSearch } from "@/components/app/global-search";
import { LogoutButton, LogoutIconButton } from "@/components/app/logout-button";
import { MobileHeader } from "@/components/app/mobile-header";
import { NewMenu } from "@/components/app/new-menu";
import { Sidebar } from "@/components/app/sidebar";
import { getCompanyName } from "@/features/settings/queries";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
    const [session, companyName] = await Promise.all([requireSession(), getCompanyName()]);

    return (
        <div className="min-h-dvh bg-primary">
            <Sidebar companyName={companyName} userName={session.name} footer={<LogoutIconButton />} />
            <MobileHeader companyName={companyName} search={<GlobalSearch variant="icon" />} />
            <div className="lg:ps-64">
                <div className="no-print hidden items-center justify-between gap-3 px-8 pt-6 lg:flex">
                    <GlobalSearch variant="bar" />
                    <NewMenu />
                </div>
                <main className="mx-auto w-full max-w-[1280px] px-4 pt-6 pb-28 md:px-6 lg:px-8 lg:pt-6 lg:pb-12">{children}</main>
            </div>
            <BottomNav moreFooter={<LogoutButton />} />
        </div>
    );
}
