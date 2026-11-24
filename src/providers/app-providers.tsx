"use client";

import type { PropsWithChildren } from "react";
import { I18nProvider } from "react-aria-components";
import { Toaster } from "sonner";
import { RouteProvider } from "@/providers/router-provider";
import { Theme } from "@/providers/theme";

/** Arabic (Iraq), Gregorian calendar, Latin digits (PRD §10.5 item 9). */
export const APP_LOCALE = "ar-IQ-u-ca-gregory-nu-latn";

export function AppProviders({ children }: PropsWithChildren) {
    return (
        <RouteProvider>
            <I18nProvider locale={APP_LOCALE}>
                <Theme>
                    {children}
                    <Toaster
                        dir="rtl"
                        position="top-center"
                        richColors
                        closeButton
                        toastOptions={{ style: { fontFamily: "var(--font-body)", fontSize: "1rem" } }}
                    />
                </Theme>
            </I18nProvider>
        </RouteProvider>
    );
}
