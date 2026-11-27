import { type NextRequest, NextResponse } from "next/server";

const PUBLIC = ["/login", "/api/health"];
const SESSION_COOKIE_NAMES = ["__Host-cc_session", "cc_session"];

/**
 * Content Security Policy with a fresh nonce per request (Next.js CSP guide). Only scripts carrying the nonce
 * run, so an injected <script> or event handler is refused by the browser even if it ever got into a page.
 * - img-src: our own files, data:/blob: (logos and the WhatsApp picture), and Google's site-icon service
 *   for shipping-line logos.
 * - style-src keeps 'unsafe-inline' because React style attributes and the UI kit set inline styles; styles
 *   can't run code.
 * - frame-ancestors 'none': no other site can put the app in a frame (clickjacking).
 */
function contentSecurityPolicy(nonce: string) {
    const dev = process.env.NODE_ENV === "development";
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://www.google.com https://*.gstatic.com",
        "font-src 'self' data:",
        `connect-src 'self'${dev ? " ws: wss:" : ""}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "frame-src 'none'",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        ...(dev ? [] : ["upgrade-insecure-requests"]),
    ].join("; ");
}

function withCsp(request: NextRequest, response: (headers: Headers) => NextResponse) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const csp = contentSecurityPolicy(nonce);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    const res = response(requestHeaders);
    res.headers.set("Content-Security-Policy", csp);
    return res;
}

/** Optimistic check: no session cookie → login. The real check is requireSession() in every page and action. */
export function proxy(request: NextRequest) {
    const { pathname, search } = request.nextUrl;
    const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    const hasCookie = SESSION_COOKIE_NAMES.some((n) => request.cookies.has(n));
    if (isPublic || hasCookie) return withCsp(request, (headers) => NextResponse.next({ request: { headers } }));
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
}

export const config = {
    matcher: [
        {
            source: "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|svg|woff2?)$).*)",
            missing: [
                { type: "header", key: "next-router-prefetch" },
                { type: "header", key: "purpose", value: "prefetch" },
            ],
        },
    ],
};
