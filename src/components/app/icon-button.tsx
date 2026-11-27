"use client";

import type { FC } from "react";
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import { Tooltip } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";

interface IconButtonProps extends Omit<AriaButtonProps, "children" | "className"> {
    icon: FC<{ className?: string }>;
    /** Always required: read by screen readers and shown as a tooltip (PRD §10.5 rule 3). */
    label: string;
    tone?: "default" | "danger";
    size?: "md" | "lg";
    className?: string;
}

/** Quiet icon-only button (44px) with an Arabic tooltip on hover/focus. */
export function IconButton({ icon: Icon, label, tone = "default", size = "md", className, ...props }: IconButtonProps) {
    return (
        <Tooltip title={label} placement="top">
            <AriaButton
                {...props}
                aria-label={label}
                className={({ isDisabled, isFocusVisible }) =>
                    cx(
                        "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg outline-focus-ring transition-[background-color,color,transform] duration-150 ease-smooth data-pressed:scale-[0.97]",
                        size === "md" ? "size-11" : "size-12",
                        tone === "danger" ? "text-fg-error-secondary hover:bg-error-primary" : "text-fg-quaternary hover:bg-primary_hover hover:text-fg-quaternary_hover",
                        isFocusVisible && "outline-2 outline-offset-2",
                        isDisabled && "cursor-not-allowed opacity-40",
                        className,
                    )
                }
            >
                <Icon className="size-5" />
            </AriaButton>
        </Tooltip>
    );
}
