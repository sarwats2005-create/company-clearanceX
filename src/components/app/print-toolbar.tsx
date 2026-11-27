"use client";

import { useEffect } from "react";
import { Printer } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";

/**
 * Screen-only bar above a print page (PRD §8.11), hidden when printing. With ?autoprint=1 the print
 * dialog opens by itself once the fonts are ready.
 */
export function PrintToolbar({ autoPrint, backHref, backLabel }: { autoPrint: boolean; backHref: string; backLabel: string }) {
    useEffect(() => {
        if (!autoPrint) return;
        let cancelled = false;
        document.fonts.ready.then(() => {
            if (!cancelled) window.setTimeout(() => window.print(), 150);
        });
        return () => {
            cancelled = true;
        };
    }, [autoPrint]);

    return (
        <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-secondary bg-primary/95 px-4 py-3 backdrop-blur-md">
            <Button size="md" color="link-gray" href={backHref}>
                {backLabel}
            </Button>
            <Button size="md" iconLeading={Printer} onClick={() => window.print()}>
                طباعة
            </Button>
        </div>
    );
}
