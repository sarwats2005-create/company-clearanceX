/**
 * Auth without Next.js dependencies (testable): credential check with a rate limit,
 * and session records. src/lib/auth.ts wraps these with cookies.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { loginAttempts, sessions, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";

export const SESSION_DAYS = 30;
export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 15;

export type AuthResult = { ok: true; userId: string; name: string } | { ok: false; error: "invalid" | "rate_limited" };

let dummyHash: Promise<string> | null = null;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Failures for this key since the later of (15 minutes ago, last success). */
async function recentFailures(db: DbOrTx, key: string): Promise<number> {
    const since = new Date(Date.now() - LOCK_MINUTES * 60_000);
    const [lastOk] = await db
        .select({ at: loginAttempts.at })
        .from(loginAttempts)
        .where(and(eq(loginAttempts.key, key), eq(loginAttempts.success, true)))
        .orderBy(desc(loginAttempts.at))
        .limit(1);
    const from = lastOk && lastOk.at > since ? lastOk.at : since;
    const [row] = await db
        .select({ n: count() })
        .from(loginAttempts)
        .where(and(eq(loginAttempts.key, key), eq(loginAttempts.success, false), gt(loginAttempts.at, from)));
    return Number(row?.n ?? 0);
}

export async function authenticate(db: DbOrTx, username: string, password: string, ip: string): Promise<AuthResult> {
    const uname = username.trim().toLowerCase();
    const key = `${uname}|${ip}`;
    if ((await recentFailures(db, key)) >= MAX_FAILURES) return { ok: false, error: "rate_limited" };

    const [user] = await db.select().from(users).where(sql`lower(${users.username}) = ${uname}`);
    let ok = false;
    if (user && user.isActive) ok = await verifyPassword(password, user.passwordHash);
    else await verifyPassword(password, await (dummyHash ??= hashPassword("timing-equalizer"))); // same work for unknown users

    await db.insert(loginAttempts).values({ key, success: ok });
    if (!ok || !user) return { ok: false, error: "invalid" };
    return { ok: true, userId: user.id, name: user.name };
}

export async function createSessionRecord(db: DbOrTx, userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
    return { token, expiresAt };
}

export async function findSessionByToken(db: DbOrTx, token: string): Promise<{ userId: string; name: string; username: string } | null> {
    const [row] = await db
        .select({ userId: users.id, name: users.name, username: users.username, expiresAt: sessions.expiresAt, isActive: users.isActive })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(sessions.id, sha256(token)));
    if (!row || !row.isActive || row.expiresAt.getTime() <= Date.now()) return null;
    return { userId: row.userId, name: row.name, username: row.username };
}

export async function deleteSessionRecord(db: DbOrTx, token: string) {
    await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

export async function deleteUserSessions(db: DbOrTx, userId: string) {
    await db.delete(sessions).where(eq(sessions.userId, userId));
}
