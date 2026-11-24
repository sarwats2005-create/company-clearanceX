import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

interface PageHeaderProps {
    title: ReactNode;
    description?: ReactNode;
    /** Actions sit at the end of the row (left in RTL). Keep ONE primary button per screen. */
    actions?: ReactNode;
    /** Small line above the title (e.g. breadcrumb / back link). */
    eyebrow?: ReactNode;
    className?: string;
}

/** Page title block with the brand signature: a short 2px navy rule over the hairline (Part F). */
export function PageHeader({ title, description, actions, eyebrow, className }: PageHeaderProps) {
    return (
        <header className={cx("relative flex flex-col gap-4 border-b border-secondary pb-5 md:flex-row md:items-end md:justify-between", className)}>
            <div className="flex min-w-0 flex-col gap-1">
                {eyebrow && <div className="text-sm text-tertiary">{eyebrow}</div>}
                <h1 className="text-display-xs font-semibold text-primary">{title}</h1>
                {description && <p className="text-md text-tertiary">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 md:shrink-0">{actions}</div>}
            <span aria-hidden="true" className="absolute start-0 -bottom-px h-0.5 w-10 rounded-full bg-brand-solid" />
        </header>
    );
}
