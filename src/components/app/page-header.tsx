import type { FC, ReactNode, SVGProps } from "react";
import { IconTile, type TileColor } from "@/components/app/icon-tile";
import { cx } from "@/utils/cx";

interface PageHeaderProps {
    title: ReactNode;
    description?: ReactNode;
    /** Actions sit at the end of the row (left in RTL). */
    actions?: ReactNode;
    /** Small line above the title (e.g. breadcrumb / back link). */
    eyebrow?: ReactNode;
    /** Icon tile shown before the title, so every page says what it is at a glance. */
    icon?: FC<SVGProps<SVGSVGElement>>;
    iconColor?: TileColor;
    className?: string;
}

/** Page title block: a colored icon tile, a large title and the page's actions. */
export function PageHeader({ title, description, actions, eyebrow, icon, iconColor = "brand", className }: PageHeaderProps) {
    return (
        <header className={cx("flex flex-col gap-4 md:flex-row md:items-center md:justify-between", className)}>
            <div className="flex min-w-0 flex-col gap-2">
                {eyebrow && <div className="text-sm text-tertiary">{eyebrow}</div>}
                <div className="flex min-w-0 items-center gap-3.5">
                    {icon && <IconTile icon={icon} color={iconColor} size="lg" />}
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <h1 className="text-display-xs font-semibold text-primary">{title}</h1>
                        {description && <p className="text-md text-tertiary">{description}</p>}
                    </div>
                </div>
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 md:shrink-0">{actions}</div>}
        </header>
    );
}
