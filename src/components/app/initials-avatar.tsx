import { cx } from "@/utils/cx";

/** Initials in a soft gray circle (no cartoon avatars, Part F). Arabic names: first letter of the first two words. */
export function initialsOf(name: string) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return words
        .slice(0, 2)
        .map((w) => w[0])
        .join(" ");
}

export function InitialsAvatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cx(
                "inline-flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-tertiary ring-1 ring-secondary ring-inset",
                size === "sm" && "size-8 text-xs",
                size === "md" && "size-10 text-sm",
                size === "lg" && "size-12 text-md",
                className,
            )}
        >
            {initialsOf(name)}
        </span>
    );
}
