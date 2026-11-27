"use client";

import type { ReactNode } from "react";
import { Heading as AriaHeading } from "react-aria-components";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { cx } from "@/utils/cx";

interface AppDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    title: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
    footer?: ReactNode;
    size?: "sm" | "md" | "lg";
    /** Money confirmations must not close on an outside tap. */
    isDismissable?: boolean;
}

/** Centered dialog with a title, a body and actions at the bottom (end-aligned). */
export function AppDialog({ isOpen, onOpenChange, title, description, children, footer, size = "md", isDismissable = true }: AppDialogProps) {
    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={isDismissable}>
            <Modal className={cx(size === "sm" && "max-w-md", size === "md" && "max-w-xl", size === "lg" && "max-w-3xl")}>
                <Dialog>
                    {() => (
                        <div className="flex flex-col">
                            <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
                                <div className="flex flex-col gap-1">
                                    <AriaHeading slot="title" className="text-lg font-semibold text-primary">
                                        {title}
                                    </AriaHeading>
                                    {description && <p className="text-md text-tertiary">{description}</p>}
                                </div>
                                <CloseButton size="md" />
                            </div>
                            {children && <div className="flex flex-col gap-5 px-5 pt-5 sm:px-6">{children}</div>}
                            {footer && <div className="mt-6 flex flex-col-reverse gap-3 border-t border-secondary px-5 py-4 sm:flex-row sm:justify-end sm:px-6">{footer}</div>}
                            {!footer && <div className="h-6" />}
                        </div>
                    )}
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
