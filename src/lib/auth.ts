import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { type AuthResult, authenticate, createSessionRecord, deleteSessionRecord, findSessionByToken, pruneAuthTables } from "@/lib/auth-core";

/**
 * In production the cookie uses the "__Host-" prefix: the browser then only accepts it over HTTPS, for this exact
 * host, on path "/", so no other site or subdomain can set or overwrite it (OWASP ASVS V3.4).
 */
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-cc_session" : "cc_session";
/** Both names, for the optimistic check in proxy.ts. */
export const SESSION_COOKIE_NAMES = ["__Host-cc_session", "cc_session"];

export interface Session {
    userId: string;
    name: string;
    username: string;
    /** SHA-256 id of the current session (to mark "this device" and keep it when signing out the others). */
    sessionId: string;
}

/** The signed-in owner, or null. Cached for the duration of one request. */
export const getSession = cache(async (): Promise<Session | null> => {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return findSessionByToken(db, token);
});

/** Every page and every server action calls this first (PRD §14.4). */
export async function requireSession(): Promise<Session> {
    const session = await getSession();
    if (!session) redirect("/login");
    return session;
}

/**
 * Client IP for rate limits. Cloudflare's header is used only when TRUST_CLOUDFLARE=1 (the app is reached only
 * through Cloudflare); otherwise anyone could fake it. Without it, the last address added by the hosting proxy
 * (Railway appends the real client address to X-Forwarded-For) is used. The per-username limit doesn't depend
 * on this at all.
 */
export async function clientIp(): Promise<string> {
    const h = await headers();
    if (process.env.TRUST_CLOUDFLARE === "1") {
        const cf = h.get("cf-connecting-ip");
        if (cf) return cf.trim().slice(0, 64);
    }
    const chain = (h.get("x-forwarded-for") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return (chain.at(-1) ?? h.get("x-real-ip") ?? "unknown").slice(0, 64);
}

/** Sets the session cookie: HttpOnly (scripts can't read it), Secure in production, SameSite=Lax. */
export async function setSessionCookie(token: string, expiresAt: Date, remember: boolean) {
    (await cookies()).set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        // Without "remember me" it is a browser-session cookie (gone when the browser closes).
        ...(remember ? { expires: expiresAt } : {}),
    });
}

export async function login(username: string, password: string, ip: string, remember = true): Promise<AuthResult> {
    const result = await authenticate(db, username, password, ip);
    if (!result.ok) return result;
    const userAgent = (await headers()).get("user-agent");
    const { token, expiresAt } = await createSessionRecord(db, result.userId, { remember, userAgent, ip });
    await setSessionCookie(token, expiresAt, remember);
    // Cheap housekeeping on each successful login.
    await pruneAuthTables(db).catch((err) => console.error("[auth] prune failed", err));
    return result;
}

export async function logout() {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) await deleteSessionRecord(db, token);
    store.delete(SESSION_COOKIE);
}
