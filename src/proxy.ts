import { type NextRequest, NextResponse } from "next/server";

const PUBLIC = ["/login", "/api/health"];

/** Optimistic check: no session cookie → login. The real check is requireSession() in every page and action. */
export function proxy(request: NextRequest) {
    const { pathname, search } = request.nextUrl;
    if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
    if (request.cookies.has("cc_session")) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|svg|woff2?)$).*)"],
};
