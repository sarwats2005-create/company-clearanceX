"use client";

import { useState } from "react";
import { cx } from "@/utils/cx";

export interface ShippingLineBrand {
    name: string;
    logo?: string | null;
    website?: string | null;
}

/** The icon a website publishes, at 128px. Only the line's domain is sent, nothing about the business. */
export function websiteIconUrl(website: string) {
    const domain = website
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/\/.*$/, "");
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

/**
 * Sharp logos of the common lines, shipped with the app (public/shipping-lines). The owner asked for them on
 * 2026-11-28 because the website icons were blurry or missing. Matched by website first, so a renamed line
 * keeps its logo, then by name.
 */
const BUILT_IN: Record<string, string> = {
    msc: "msc.svg",
    maersk: "maersk.svg",
    "cma-cgm": "cma-cgm.svg",
    cmacgm: "cma-cgm.svg",
    cosco: "cosco.svg",
    coscoshipping: "cosco.svg",
    "hapag-lloyd": "hapag-lloyd.svg",
    hapaglloyd: "hapag-lloyd.svg",
    one: "one.svg",
    "one-line": "one.svg",
    evergreen: "evergreen.svg",
    "evergreen-line": "evergreen.svg",
    "yang-ming": "yang-ming.png",
    yangming: "yang-ming.png",
    zim: "zim.svg",
    hmm: "hmm.svg",
    hmm21: "hmm.svg",
};

/** "www.Hapag-Lloyd.com/en" → "hapag-lloyd"; "Yang Ming" → "yang-ming". */
function key(text: string) {
    return text
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/[/.].*$/, "")
        .replace(/\s+/g, "-");
}

export function builtInLogo(line: ShippingLineBrand): string | null {
    const file = (line.website && BUILT_IN[key(line.website)]) || BUILT_IN[key(line.name)];
    return file ? `/shipping-lines/${file}` : null;
}

const MONO_COLORS = ["tile-brand", "tile-blue", "tile-teal", "tile-orange", "tile-purple", "tile-pink", "tile-indigo", "tile-green"];

function monogram(name: string) {
    const latin = name.replace(/[^A-Za-z0-9 ]/g, "").trim();
    const words = latin.split(/\s+/).filter(Boolean);
    if (!words.length) return name.trim().slice(0, 2);
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words
        .slice(0, 3)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
}

function colorFor(name: string) {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return MONO_COLORS[h % MONO_COLORS.length];
}

const SIZE = {
    sm: "size-8 rounded-lg text-[0.6rem]",
    md: "size-10 rounded-xl text-xs",
    lg: "size-14 rounded-2xl text-sm",
    xl: "size-16 rounded-2xl text-md",
} as const;

/**
 * A shipping line's logo on a white tile: the logo the owner uploaded, else the app's own logo for the common
 * lines, else the icon of the line's website, else its letters on a color. Decorative: the line's name is always written next to it.
 */
export function ShippingLineLogo({ line, size = "md", className }: { line: ShippingLineBrand; size?: keyof typeof SIZE; className?: string }) {
    const [failed, setFailed] = useState(false);
    const src = line.logo || builtInLogo(line) || (line.website && !failed ? websiteIconUrl(line.website) : null);

    if (!src) {
        return (
            <span
                aria-hidden="true"
                className={cx(
                    "inline-flex shrink-0 items-center justify-center font-bold tracking-tight text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]",
                    colorFor(line.name),
                    SIZE[size],
                    className,
                )}
            >
                <bdi>{monogram(line.name)}</bdi>
            </span>
        );
    }
    return (
        <span
            aria-hidden="true"
            className={cx("inline-flex shrink-0 items-center justify-center overflow-hidden bg-white p-1.5 shadow-xs ring-1 ring-secondary ring-inset", SIZE[size], className)}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setFailed(true)}
                // The icon service answers "no icon" with a tiny 16px globe: show the letters instead.
                onLoad={(e) => src.startsWith("https://") && e.currentTarget.naturalWidth <= 16 && setFailed(true)}
                className="size-full object-contain"
            />
        </span>
    );
}
