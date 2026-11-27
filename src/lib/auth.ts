import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { authenticate, createSessionRecord, deleteSessionRecord, findSessionByToken, type AuthResult } from "@/lib/auth-core";

export const SESSION_COOKIE = "cc_session";

export interface Session {
    userId: string;
    name: string;
    username: string;
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

/** Client IP: Cloudflare's header first, then the proxy chain. */
export async function clientIp(): Promise<string> {
    const h = await headers();
    return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

export async function login(username: string, password: string, ip: string, remember = true): Promise<AuthResult> {
    const result = await authenticate(db, username, password, ip);
    if (!result.ok) return result;
    const { token, expiresAt } = await createSessionRecord(db, result.userId);
    (await cookies()).set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        ...(remember ? { expires: expiresAt } : {}),
    });
    return result;
}

export async function logout() {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) await deleteSessionRecord(db, token);
    store.delete(SESSION_COOKIE);
}
