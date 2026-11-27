/**
 * Auth without Next.js dependencies (testable): credential check with layered rate limits, and session records.
 * src/lib/auth.ts wraps these with cookies.
 *
 * Limits (OWASP Authentication / Session Management cheat sheets):
 * - 5 failures per username + IP, 20 per username from any IP, 30 per IP for any username, each in 15 minutes.
 *   The per-username limit holds even if an attacker fakes or rotates IP addresses.
 * - Sessions: 30 days absolute; they also end when unused for 14 days ("تذكرني") or 12 hours (without it).
 */
import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, gt, lt, ne, or, type SQL, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { loginAttempts, sessions, users } from "@/db/schema";
import { MAX_PASSWORD_LENGTH, hashPassword, needsRehash, verifyPassword } from "@/lib/password";

export const SESSION_DAYS = 30;
export const IDLE_HOURS_REMEMBER = 14 * 24;
export const IDLE_HOURS_SHORT = 12;
/** last_seen_at is written at most this often, to keep page loads cheap. */
export const TOUCH_EVERY_MS = 5 * 60_000;

export const MAX_FAILURES = 5;
export const MAX_USER_FAILURES = 20;
export const MAX_IP_FAILURES = 30;
export const LOCK_MINUTES = 15;
/** Old login attempts are kept this long for the record, then removed. */
export const ATTEMPTS_KEEP_DAYS = 90;

export type AuthResult = { ok: true; userId: string; name: string } | { ok: false; error: "invalid" | "rate_limited" };

export interface SessionMeta {
    remember?: boolean;
    userAgent?: string | null;
    ip?: string | null;
}

let dummyHash: Promise<string> | null = null;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const clip = (s: string | null | undefined, n: number) => (s ? s.slice(0, n) : null);

/** Failures matching `who` since the later of (15 minutes ago, the last success matching `who`). */
async function failuresSince(db: DbOrTx, who: SQL): Promise<number> {
    const since = new Date(Date.now() - LOCK_MINUTES * 60_000);
    const [lastOk] = await db
        .select({ at: loginAttempts.at })
        .from(loginAttempts)
        .where(and(who, eq(loginAttempts.success, true), gt(loginAttempts.at, since)))
        .orderBy(desc(loginAttempts.at))
        .limit(1);
    const [row] = await db
        .select({ n: count() })
        .from(loginAttempts)
        .where(and(who, eq(loginAttempts.success, false), gt(loginAttempts.at, lastOk?.at ?? since)));
    return Number(row?.n ?? 0);
}

export async function isRateLimited(db: DbOrTx, uname: string, ip: string): Promise<boolean> {
    const [pair, user, fromIp] = await Promise.all([
        failuresSince(db, eq(loginAttempts.key, `${uname}|${ip}`)),
        failuresSince(db, eq(loginAttempts.username, uname)),
        ip === "unknown" ? Promise.resolve(0) : failuresSince(db, eq(loginAttempts.ip, ip)),
    ]);
    return pair >= MAX_FAILURES || user >= MAX_USER_FAILURES || fromIp >= MAX_IP_FAILURES;
}

/** Records one password check (login, or the "current password" when changing it), for the limits above. */
export async function recordLoginAttempt(db: DbOrTx, username: string, ip: string, success: boolean) {
    const uname = username.trim().toLowerCase().slice(0, 100);
    await db.insert(loginAttempts).values({ key: `${uname}|${ip}`, username: uname, ip, success });
}

export async function authenticate(db: DbOrTx, username: string, password: string, ip: string): Promise<AuthResult> {
    const uname = username.trim().toLowerCase().slice(0, 100);
    const record = (success: boolean) => recordLoginAttempt(db, uname, ip, success);
    if (await isRateLimited(db, uname, ip)) return { ok: false, error: "rate_limited" };

    const [user] = await db.select().from(users).where(sql`lower(${users.username}) = ${uname}`);
    let ok = false;
    if (password.length > MAX_PASSWORD_LENGTH) ok = false;
    else if (user && user.isActive) ok = await verifyPassword(password, user.passwordHash);
    else await verifyPassword(password, await (dummyHash ??= hashPassword("timing-equalizer"))); // same work for unknown users

    await record(ok);
    if (!ok || !user) return { ok: false, error: "invalid" };
    // Old, cheaper hashes are upgraded silently now that we know the password.
    if (needsRehash(user.passwordHash)) await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, user.id));
    return { ok: true, userId: user.id, name: user.name };
}

export async function createSessionRecord(db: DbOrTx, userId: string, meta: SessionMeta = {}): Promise<{ token: string; expiresAt: Date; id: string }> {
    const token = randomBytes(32).toString("base64url");
    const id = sha256(token);
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    await db.insert(sessions).values({
        id,
        userId,
        expiresAt,
        remember: meta.remember ?? true,
        userAgent: clip(meta.userAgent, 300),
        ip: clip(meta.ip, 64),
    });
    return { token, expiresAt, id };
}

const idleLimitMs = (remember: boolean) => (remember ? IDLE_HOURS_REMEMBER : IDLE_HOURS_SHORT) * 3_600_000;

export async function findSessionByToken(db: DbOrTx, token: string): Promise<{ userId: string; name: string; username: string; sessionId: string } | null> {
    if (!token || token.length > 200) return null;
    const id = sha256(token);
    const [row] = await db
        .select({
            userId: users.id,
            name: users.name,
            username: users.username,
            expiresAt: sessions.expiresAt,
            lastSeenAt: sessions.lastSeenAt,
            remember: sessions.remember,
            isActive: users.isActive,
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(sessions.id, id));
    if (!row) return null;
    const now = Date.now();
    if (!row.isActive || row.expiresAt.getTime() <= now || now - row.lastSeenAt.getTime() > idleLimitMs(row.remember)) {
        await db.delete(sessions).where(eq(sessions.id, id));
        return null;
    }
    if (now - row.lastSeenAt.getTime() > TOUCH_EVERY_MS) await db.update(sessions).set({ lastSeenAt: new Date(now) }).where(eq(sessions.id, id));
    return { userId: row.userId, name: row.name, username: row.username, sessionId: id };
}

export async function deleteSessionRecord(db: DbOrTx, token: string) {
    await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

export async function deleteUserSessions(db: DbOrTx, userId: string) {
    await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** "تسجيل الخروج من الأجهزة الأخرى": every session of this user except the current one. */
export async function deleteOtherSessions(db: DbOrTx, userId: string, keepSessionId: string): Promise<number> {
    const gone = await db
        .delete(sessions)
        .where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)))
        .returning({ id: sessions.id });
    return gone.length;
}

/** The devices signed in as this user, newest use first (Settings → الحساب). */
export async function listUserSessions(db: DbOrTx, userId: string) {
    return db
        .select({ id: sessions.id, createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt, userAgent: sessions.userAgent, ip: sessions.ip, remember: sessions.remember })
        .from(sessions)
        .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
        .orderBy(desc(sessions.lastSeenAt));
}

/** Housekeeping: drop ended sessions and old login attempts so the tables don't grow forever. */
export async function pruneAuthTables(db: DbOrTx) {
    const now = new Date();
    await db.delete(sessions).where(or(lt(sessions.expiresAt, now), lt(sessions.lastSeenAt, new Date(now.getTime() - IDLE_HOURS_REMEMBER * 3_600_000))));
    await db.delete(loginAttempts).where(lt(loginAttempts.at, new Date(now.getTime() - ATTEMPTS_KEEP_DAYS * 86_400_000)));
}
