import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLog, loginAttempts, sessions, users } from "@/db/schema";
import {
    IDLE_HOURS_SHORT,
    MAX_USER_FAILURES,
    authenticate,
    createSessionRecord,
    deleteOtherSessions,
    deleteSessionRecord,
    findSessionByToken,
    listUserSessions,
    pruneAuthTables,
} from "@/lib/auth-core";
import { hashPassword, needsRehash, passwordProblems, verifyPassword } from "@/lib/password";
import { closeDb, resetDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(closeDb);

describe("password hashing", () => {
    it("verifies the right password and rejects a wrong one", async () => {
        const hash = await hashPassword("correct horse");
        expect(hash).toMatch(/^scrypt\$/);
        expect(await verifyPassword("correct horse", hash)).toBe(true);
        expect(await verifyPassword("wrong horse", hash)).toBe(false);
    });
    it("salts every hash", async () => {
        expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
    });
    it("rejects a malformed stored hash instead of throwing", async () => {
        expect(await verifyPassword("x", "garbage")).toBe(false);
    });
});

describe("authenticate", () => {
    beforeEach(async () => {
        await db.insert(users).values({ name: "أبو علي", username: "owner", passwordHash: await hashPassword("owner-pass-123") });
    });

    it("logs in with the right password (username is case-insensitive)", async () => {
        const r = await authenticate(db, "Owner", "owner-pass-123", "1.2.3.4");
        expect(r).toMatchObject({ ok: true, name: "أبو علي" });
    });

    it("refuses a wrong password and an unknown user the same way", async () => {
        expect(await authenticate(db, "owner", "nope", "1.2.3.4")).toEqual({ ok: false, error: "invalid" });
        expect(await authenticate(db, "ghost", "nope", "1.2.3.4")).toEqual({ ok: false, error: "invalid" });
    });

    it("locks the username + IP after 5 failures in 15 minutes, even with the right password", async () => {
        for (let i = 0; i < 5; i++) await authenticate(db, "owner", "nope", "1.2.3.4");
        expect(await authenticate(db, "owner", "owner-pass-123", "1.2.3.4")).toEqual({ ok: false, error: "rate_limited" });
        // another IP is not locked
        expect(await authenticate(db, "owner", "owner-pass-123", "5.6.7.8")).toMatchObject({ ok: true });
    });

    it("a success resets the failure count", async () => {
        for (let i = 0; i < 4; i++) await authenticate(db, "owner", "nope", "1.2.3.4");
        expect(await authenticate(db, "owner", "owner-pass-123", "1.2.3.4")).toMatchObject({ ok: true });
        for (let i = 0; i < 4; i++) await authenticate(db, "owner", "nope", "1.2.3.4");
        expect(await authenticate(db, "owner", "owner-pass-123", "1.2.3.4")).toMatchObject({ ok: true });
    });

    it("refuses an inactive user", async () => {
        await db.update(users).set({ isActive: false });
        expect(await authenticate(db, "owner", "owner-pass-123", "1.2.3.4")).toEqual({ ok: false, error: "invalid" });
    });
});

describe("sessions", () => {
    it("stores only the token hash and finds the user by token", async () => {
        const [u] = await db.insert(users).values({ name: "أبو علي", username: "owner", passwordHash: "scrypt$x" }).returning();
        const { token, expiresAt } = await createSessionRecord(db, u.id);
        expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
        const rows = await db.select().from(sessions);
        expect(rows[0].id).not.toBe(token);
        expect(rows[0].id).toHaveLength(64);
        expect(await findSessionByToken(db, token)).toMatchObject({ userId: u.id, name: "أبو علي" });
        expect(await findSessionByToken(db, "forged")).toBeNull();
        await deleteSessionRecord(db, token);
        expect(await findSessionByToken(db, token)).toBeNull();
    });

    it("ignores expired sessions", async () => {
        const [u] = await db.insert(users).values({ name: "x", username: "x", passwordHash: "scrypt$x" }).returning();
        const { token } = await createSessionRecord(db, u.id);
        await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, u.id));
        expect(await findSessionByToken(db, token)).toBeNull();
    });
});

describe("security hardening: passwords", () => {
    it("refuses short, common, all-digit and username-containing passwords, and accepts a long passphrase", () => {
        expect(passwordProblems("short")).not.toEqual([]);
        expect(passwordProblems("password123")).not.toEqual([]);
        expect(passwordProblems("07701234567")).not.toEqual([]);
        expect(passwordProblems("aaaaaaaaaaaa")).not.toEqual([]);
        expect(passwordProblems("owner-is-me-2026", "owner")).not.toEqual([]);
        expect(passwordProblems("Basra docks at dawn", "owner")).toEqual([]);
    });

    it("refuses an absurdly long password without hashing it", async () => {
        const hash = await hashPassword("Basra docks at dawn");
        expect(await verifyPassword("x".repeat(10_000), hash)).toBe(false);
    });

    it("upgrades an old, cheaper hash after a successful login", async () => {
        // A hash made with the previous settings (N=16384, r=8, p=1).
        const { scryptSync, randomBytes } = await import("node:crypto");
        const salt = randomBytes(16);
        const key = scryptSync("Basra docks at dawn".normalize("NFKC"), salt, 64, { N: 16384, r: 8, p: 1 });
        const old = ["scrypt", 16384, 8, 1, salt.toString("base64"), key.toString("base64")].join("$");
        expect(needsRehash(old)).toBe(true);
        const [u] = await db.insert(users).values({ name: "x", username: "owner", passwordHash: old }).returning();
        expect(await authenticate(db, "owner", "Basra docks at dawn", "1.1.1.1")).toMatchObject({ ok: true });
        const [row] = await db.select().from(users).where(eq(users.id, u.id));
        expect(row.passwordHash).not.toBe(old);
        expect(needsRehash(row.passwordHash)).toBe(false);
        expect(await verifyPassword("Basra docks at dawn", row.passwordHash)).toBe(true);
    });
});

describe("security hardening: login limits", () => {
    beforeEach(async () => {
        await db.insert(users).values({ name: "أبو علي", username: "owner", passwordHash: await hashPassword("owner-pass-123") });
    });

    it("locks a username after 20 failures even when every attempt comes from a different IP", async () => {
        for (let i = 0; i < MAX_USER_FAILURES; i++) await authenticate(db, "owner", "nope", `10.0.0.${i}`);
        expect(await authenticate(db, "owner", "owner-pass-123", "10.9.9.9")).toEqual({ ok: false, error: "rate_limited" });
    });

    it("locks an IP that tries many usernames", async () => {
        for (let i = 0; i < 30; i++) await authenticate(db, `user${i}`, "nope", "6.6.6.6");
        expect(await authenticate(db, "owner", "owner-pass-123", "6.6.6.6")).toEqual({ ok: false, error: "rate_limited" });
        expect(await authenticate(db, "owner", "owner-pass-123", "7.7.7.7")).toMatchObject({ ok: true });
    });

    it("records the username and IP of every attempt", async () => {
        await authenticate(db, "Owner", "nope", "1.2.3.4");
        const [row] = await db.select().from(loginAttempts);
        expect(row).toMatchObject({ username: "owner", ip: "1.2.3.4", success: false });
    });
});

describe("security hardening: sessions", () => {
    let userId: string;
    beforeEach(async () => {
        [{ id: userId }] = await db.insert(users).values({ name: "x", username: "owner", passwordHash: await hashPassword("owner-pass-123") }).returning();
    });

    it("ends a session that was not used for too long, and deletes it", async () => {
        const { token, id } = await createSessionRecord(db, userId, { remember: false });
        await db.update(sessions).set({ lastSeenAt: new Date(Date.now() - (IDLE_HOURS_SHORT + 1) * 3_600_000) }).where(eq(sessions.id, id));
        expect(await findSessionByToken(db, token)).toBeNull();
        expect(await db.select().from(sessions)).toHaveLength(0);
    });

    it("keeps a remembered session alive across a short idle", async () => {
        const { token, id } = await createSessionRecord(db, userId, { remember: true });
        await db.update(sessions).set({ lastSeenAt: new Date(Date.now() - 3 * 24 * 3_600_000) }).where(eq(sessions.id, id));
        expect(await findSessionByToken(db, token)).toMatchObject({ userId, sessionId: id });
        // ...and the visit refreshes last_seen_at.
        const [row] = await db.select().from(sessions).where(eq(sessions.id, id));
        expect(Date.now() - row.lastSeenAt.getTime()).toBeLessThan(60_000);
    });

    it("lists the owner's devices and signs out all but the current one", async () => {
        const a = await createSessionRecord(db, userId, { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", ip: "1.1.1.1" });
        await createSessionRecord(db, userId, { userAgent: "Mozilla/5.0 (Windows NT 10.0)", ip: "2.2.2.2" });
        await createSessionRecord(db, userId, {});
        expect(await listUserSessions(db, userId)).toHaveLength(3);
        expect(await deleteOtherSessions(db, userId, a.id)).toBe(2);
        const left = await listUserSessions(db, userId);
        expect(left.map((x) => x.id)).toEqual([a.id]);
        expect(left[0]).toMatchObject({ ip: "1.1.1.1" });
    });

    it("never accepts an oversized token", async () => {
        expect(await findSessionByToken(db, "x".repeat(5000))).toBeNull();
    });

    it("housekeeping removes ended sessions and old login attempts", async () => {
        const { id } = await createSessionRecord(db, userId);
        await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.id, id));
        await db.insert(loginAttempts).values({ key: "a|b", username: "a", ip: "b", success: false, at: new Date(Date.now() - 200 * 86_400_000) });
        await pruneAuthTables(db);
        expect(await db.select().from(sessions)).toHaveLength(0);
        expect(await db.select().from(loginAttempts)).toHaveLength(0);
    });
});

describe("security hardening: database guards", () => {
    it("the audit log can't be changed or deleted", async () => {
        await db.insert(auditLog).values({ tableName: "users", action: "login" });
        await expect(db.update(auditLog).set({ tableName: "x" })).rejects.toThrow();
        await expect(db.delete(auditLog)).rejects.toThrow();
        expect(await db.select().from(auditLog)).toHaveLength(1);
    });

    it("refuses impossible values stored directly in the database", async () => {
        await expect(db.insert(users).values({ name: "x", username: "y", passwordHash: "plain-text-password" })).rejects.toThrow();
        await expect(db.insert(sessions).values({ id: "short", userId: "00000000-0000-0000-0000-000000000000", expiresAt: new Date() })).rejects.toThrow();
    });
});
