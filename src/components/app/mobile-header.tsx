import type { ReactNode } from "react";
import { LogoMark } from "@/components/app/logo";
import { NewMenu } from "@/components/app/new-menu";

/** Phone/tablet header: logo at the start, search + "جديد" at the end, frosted over the gradient. */
export function MobileHeader({ companyName, search }: { companyName: string; search?: ReactNode }) {
    return (
        <header className="glass no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-white/60 px-4 shadow-[0_1px_0_rgb(16_24_40/0.04)] lg:hidden">
            <a href="/" className="flex min-w-0 items-center gap-2.5">
                <LogoMark className="size-9" />
                <span className="truncate text-md font-semibold text-primary">{companyName}</span>
            </a>
            <div className="flex items-center gap-2">
                {search}
                <NewMenu compact />
            </div>
        </header>
    );
}
