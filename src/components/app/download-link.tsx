import type { ReactNode } from "react";
import { Download01 } from "@untitledui/icons";
import { cx } from "@/utils/cx";

/**
 * A quiet (secondary) button that downloads a file. A plain <a>, not the kit Button, so the app
 * router never tries to open the spreadsheet as a page. No `download` attribute: with it Chrome
 * names the file "download"; without it the server's Arabic file name (Content-Disposition) is used.
 */
export function DownloadLink({ href, children, size = "lg", className }: { href: string; children: ReactNode; size?: "md" | "lg"; className?: string }) {
    return (
        <a
            href={href}
            className={cx(
                "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary font-semibold whitespace-nowrap text-secondary ring-1 ring-primary outline-focus-ring transition-[background-color,transform] duration-150 ease-smooth ring-inset hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.97]",
                size === "lg" ? "h-11 px-4 text-md" : "h-10 px-3.5 text-sm",
                className,
            )}
        >
            <Download01 className="size-5 text-fg-quaternary" aria-hidden="true" />
            {children}
        </a>
    );
}
