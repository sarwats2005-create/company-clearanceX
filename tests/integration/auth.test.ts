import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { authenticate, createSessionRecord, deleteSessionRecord, findSessionByToken } from "@/lib/auth-core";
import { hashPassword, verifyPassword } from "@/lib/password";
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
        const [u] = await db.insert(users).values({ name: "أبو علي", username: "owner", passwordHash: "x" }).returning();
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
        const [u] = await db.insert(users).values({ name: "x", username: "x", passwordHash: "x" }).returning();
        const { token } = await createSessionRecord(db, u.id);
        await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, u.id));
        expect(await findSessionByToken(db, token)).toBeNull();
    });
});
