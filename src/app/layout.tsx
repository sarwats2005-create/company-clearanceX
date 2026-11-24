import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import { cookies } from "next/headers";
import { AppProviders } from "@/providers/app-providers";
import "@/styles/globals.css";
import { cx } from "@/utils/cx";
import { t } from "@/lib/i18n";
import { TEXT_SIZE_COOKIE, parseTextSize } from "@/lib/text-size";

const plexArabic = IBM_Plex_Sans_Arabic({
    subsets: ["arabic", "latin"],
    weight: ["400", "500", "600"],
    display: "swap",
    variable: "--font-plex-arabic",
});

const plexMono = IBM_Plex_Mono({
    subsets: ["latin"],
    weight: ["400", "500", "600"],
    display: "swap",
    variable: "--font-plex-mono",
});

export const metadata: Metadata = {
    title: { default: t("app.name"), template: `%s · ${t("app.name")}` },
    description: t("app.tagline"),
};

export const viewport: Viewport = {
    themeColor: "#1E3A8A",
    colorScheme: "light",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const textSize = parseTextSize((await cookies()).get(TEXT_SIZE_COOKIE)?.value);

    return (
        <html lang="ar" dir="rtl" data-text-size={textSize} className="light-mode" suppressHydrationWarning>
            <body className={cx(plexArabic.variable, plexMono.variable, "bg-primary text-primary antialiased")}>
                <AppProviders>{children}</AppProviders>
            </body>
        </html>
    );
}
