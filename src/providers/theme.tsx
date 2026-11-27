"use client";

import { ThemeProvider } from "next-themes";

/** v1 is forced light (PRD §3.2: dark mode is Phase 2). */
export function Theme({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
    return (
        <ThemeProvider attribute="class" value={{ light: "light-mode", dark: "dark-mode" }} forcedTheme="light" enableSystem={false} nonce={nonce}>
            {children}
        </ThemeProvider>
    );
}
