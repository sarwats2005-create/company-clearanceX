"use client";

import type { PropsWithChildren } from "react";
import { I18nProvider } from "react-aria-components";
import { Toaster } from "sonner";
import { RouteProvider } from "@/providers/router-provider";
import { Theme } from "@/providers/theme";

/** Arabic (Iraq), Gregorian calendar, Latin digits (PRD §10.5 item 9). */
export const APP_LOCALE = "ar-IQ-u-ca-gregory-nu-latn";

/** `nonce`: this request's CSP nonce, for the small inline script next-themes adds. */
export function AppProviders({ children, nonce }: PropsWithChildren<{ nonce?: string }>) {
    return (
        <RouteProvider>
            <I18nProvider locale={APP_LOCALE}>
                <Theme nonce={nonce}>
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
