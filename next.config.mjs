/**
 * Security headers on every response (OWASP Secure Headers / Next.js security guidance).
 * The Content-Security-Policy is set per request in src/proxy.ts because it carries a fresh nonce.
 */
const securityHeaders = [
    // HTTPS only for two years, subdomains included. ("preload" is left out on purpose: it is hard to undo.)
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    // Never guess a file's type: a download can't be turned into a script.
    { key: "X-Content-Type-Options", value: "nosniff" },
    // No other site may frame the app (older browsers; CSP frame-ancestors covers the rest).
    { key: "X-Frame-Options", value: "DENY" },
    // Don't send our page addresses (they contain record ids) to other sites such as wa.me or Google.
    { key: "Referrer-Policy", value: "same-origin" },
    // The app needs none of these powerful features.
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), browsing-topics=()" },
    // Keep the app's window separate from windows it opens (WhatsApp, print) and from sites that open it.
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Don't advertise the framework.
    poweredByHeader: false,
    experimental: {
        optimizePackageImports: ["@untitledui/icons"],
    },
    async headers() {
        return [
            { source: "/:path*", headers: securityHeaders },
            // Pages with business data and the Excel exports must never be stored by a browser or a shared cache.
            {
                source: "/((?!_next/static|_next/image|favicon.ico|icon.png).*)",
                headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
            },
        ];
    },
};

export default nextConfig;
