import type { FC, ReactNode, SVGProps } from "react";
import { cx } from "@/utils/cx";

export type TileColor = "brand" | "blue" | "sky" | "green" | "teal" | "orange" | "gold" | "red" | "purple" | "pink" | "indigo" | "gray" | "whatsapp";
type Icon = FC<SVGProps<SVGSVGElement>>;

const TILE: Record<TileColor, string> = {
    brand: "tile-brand",
    blue: "tile-blue",
    sky: "tile-sky",
    green: "tile-green",
    teal: "tile-teal",
    orange: "tile-orange",
    gold: "tile-gold",
    red: "tile-red",
    purple: "tile-purple",
    pink: "tile-pink",
    indigo: "tile-indigo",
    gray: "tile-gray",
    whatsapp: "tile-whatsapp",
};

const SIZE = {
    sm: { box: "size-8 rounded-lg", icon: "size-4" },
    md: { box: "size-10 rounded-xl", icon: "size-5" },
    lg: { box: "size-12 rounded-2xl", icon: "size-6" },
    xl: { box: "size-14 rounded-2xl", icon: "size-7" },
} as const;

/**
 * A colored square with a white icon, like the icons in a phone's Settings app.
 * The color tells the owner which kind of thing this is before they read the words.
 * Decorative: always put a text label next to it.
 */
export function IconTile({ icon: Icon, color = "brand", size = "md", className }: { icon: Icon; color?: TileColor; size?: keyof typeof SIZE; className?: string }) {
    const s = SIZE[size];
    return (
        <span
            aria-hidden="true"
            className={cx(
                "inline-flex shrink-0 items-center justify-center text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_4px_10px_-4px_rgb(16_24_40/0.35)]",
                TILE[color],
                s.box,
                className,
            )}
        >
            <Icon className={s.icon} strokeWidth={2} />
        </span>
    );
}

/** A card title row: icon tile, title, optional hint and actions. */
export function CardTitle({
    icon,
    color,
    title,
    hint,
    actions,
    id,
    className,
}: {
    icon: Icon;
    color?: TileColor;
    title: ReactNode;
    hint?: ReactNode;
    actions?: ReactNode;
    id?: string;
    className?: string;
}) {
    return (
        <div className={cx("flex flex-wrap items-center justify-between gap-3", className)}>
            <div className="flex min-w-0 items-center gap-3">
                <IconTile icon={icon} color={color} size="md" />
                <div className="flex min-w-0 flex-col">
                    <h2 id={id} className="text-lg font-semibold text-primary">
                        {title}
                    </h2>
                    {hint && <p className="text-sm text-tertiary">{hint}</p>}
                </div>
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}
