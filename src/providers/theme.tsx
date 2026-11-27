"use client";

import { ThemeProvider } from "next-themes";

/** v1 is forced light (PRD §3.2: dark mode is Phase 2). */
export function Theme({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider attribute="class" value={{ light: "light-mode", dark: "dark-mode" }} forcedTheme="light" enableSystem={false}>
            {children}
        </ThemeProvider>
    );
}
