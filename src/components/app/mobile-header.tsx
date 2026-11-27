import type { ReactNode } from "react";
import { LogoMark } from "@/components/app/logo";
import { NewMenu } from "@/components/app/new-menu";

/** Phone/tablet header: logo at the start, search + new at the end (PRD §8.1). */
export function MobileHeader({ companyName, search }: { companyName: string; search?: ReactNode }) {
    return (
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-secondary bg-primary/95 px-4 backdrop-blur-md lg:hidden">
            <a href="/" className="flex min-w-0 items-center gap-2.5">
                <LogoMark />
                <span className="truncate text-md font-semibold text-primary">{companyName}</span>
            </a>
            <div className="flex items-center gap-2">
                {search}
                <NewMenu compact />
            </div>
        </header>
    );
}
