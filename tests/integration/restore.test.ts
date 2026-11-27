import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, withTx } from "@/db";
import { demo } from "@/db/demo";
import { auditLog, containers, journalEntries, receiptSequences, restorePoints, sessions, shippingLines, traders, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { createSessionRecord } from "@/lib/auth-core";
import * as restore from "@/features/restore/service";
import { closeDb, resetDb } from "../helpers/db";

let ownerId: string;

beforeEach(async () => {
    await resetDb();
    await seed(db, { username: "owner", password: "owner-pass-123", name: "أبو علي" });
    ownerId = (await db.select().from(users))[0].id;
    await demo(db, ownerId);
});
afterAll(closeDb);

/** One hash per business table: equal hashes = exactly the same rows, numbers to the last digit. */
async function fingerprint(): Promise<Record<string, string>> {
    const tables = (await db.execute<{ t: string }>(sql`SELECT unnest(cc_restore_tables()) AS t`)).rows.map((r) => r.t);
    const out: Record<string, string> = {};
    for (const t of tables) {
        const r = await db.execute<{ h: string }>(
            sql`SELECT md5(coalesce(string_agg(to_jsonb(x)::text, '|' ORDER BY to_jsonb(x)::text), '')) AS h FROM ${sql.identifier(t)} x`,
        );
        out[t] = r.rows[0].h;
    }
    return out;
}

/** Tests only: change a saved point (the app can't; the trigger is lifted for this one statement). */
async function tamper(id: string, set: ReturnType<typeof sql>) {
    await db.transaction(async (tx) => {
        await tx.execute(sql`ALTER TABLE restore_points DISABLE TRIGGER cc_restore_points_immutable`);
        await tx.execute(sql`UPDATE restore_points SET ${set} WHERE id = ${id}`);
        await tx.execute(sql`ALTER TABLE restore_points ENABLE TRIGGER cc_restore_points_immutable`);
    });
}

const newTrader = () => db.insert(traders).values({ name: "تاجر جديد بعد النقطة" });

describe("restore points", () => {
    it("saves a full copy with counts and a checksum", async () => {
        const id = await withTx((tx) => restore.createRestorePoint(tx, "قبل نهاية الشهر", ownerId));
        const [p] = await db.select().from(restorePoints).where(eq(restorePoints.id, id));
        expect(p.label).toBe("قبل نهاية الشهر");
        expect(p.kind).toBe("manual");
        expect(p.counts.containers).toBe(30);
        expect(p.counts.traders).toBe(10);
        expect(p.counts.journal_entries).toBe(await db.$count(journalEntries));
        expect(p.checksum).toMatch(/^[0-9a-f]{64}$/);
        // Logins and history are never inside a point.
        expect(Object.keys(p.data as object)).not.toContain("users");
        expect(Object.keys(p.data as object)).not.toContain("audit_log");
        const [a] = await db.select().from(auditLog).where(eq(auditLog.recordId, id));
        expect(a.action).toBe("create");
    });

    it("gets a default name when none is typed", async () => {
        const id = await withTx((tx) => restore.createRestorePoint(tx, "   ", ownerId));
        const [p] = await db.select().from(restorePoints).where(eq(restorePoints.id, id));
        expect(p.label).toBe("نقطة استرجاع");
    });

    it("puts every record back exactly, keeps logins, and saves an automatic point first so it can be undone", async () => {
        const before = await fingerprint();
        const point = await withTx((tx) => restore.createRestorePoint(tx, "", ownerId));
        await createSessionRecord(db, ownerId);
        const sessionsBefore = await db.$count(sessions);

        // Work done after the point…
        await newTrader();
        await db.update(shippingLines).set({ name: "اسم مغيّر" }).where(eq(shippingLines.name, "MSC"));
        const later = await fingerprint();
        expect(later).not.toEqual(before);

        // …is gone after the restore, and everything else is identical.
        const backup = await withTx((tx) => restore.restoreFromPoint(tx, point, ownerId));
        expect(await fingerprint()).toEqual(before);
        expect(await db.$count(users)).toBe(1);
        expect(await db.$count(sessions)).toBe(sessionsBefore);

        const [b] = await db.select().from(restorePoints).where(eq(restorePoints.id, backup));
        expect(b.kind).toBe("before_restore");
        const [a] = await db.select().from(auditLog).where(eq(auditLog.action, "restore"));
        expect(a.recordId).toBe(point);

        // Undo: restoring the automatic point brings the later work back.
        await withTx((tx) => restore.restoreFromPoint(tx, backup, ownerId));
        expect(await fingerprint()).toEqual(later);
    });

    it("refuses a damaged point and changes nothing", async () => {
        const point = await withTx((tx) => restore.createRestorePoint(tx, "", ownerId));
        await tamper(point, sql`data = jsonb_set(data, '{traders}', '[]'::jsonb)`);
        await newTrader();
        const now = await fingerprint();
        await expect(withTx((tx) => restore.restoreFromPoint(tx, point, ownerId))).rejects.toThrow("تالفة");
        expect(await fingerprint()).toEqual(now);
    });

    it("a saved point can't be changed, even directly in the database", async () => {
        const point = await withTx((tx) => restore.createRestorePoint(tx, "", ownerId));
        await expect(db.update(restorePoints).set({ label: "x" }).where(eq(restorePoints.id, point))).rejects.toThrow();
    });

    it("deletes only old manual points: not today's (the undo for a fresh start) and not automatic ones", async () => {
        const point = await withTx((tx) => restore.createRestorePoint(tx, "", ownerId));
        await expect(withTx((tx) => restore.deleteRestorePoint(tx, point, ownerId))).rejects.toThrow("اليوم");

        const backup = await withTx((tx) => restore.restoreFromPoint(tx, point, ownerId));
        await tamper(backup, sql`created_on = created_on - 3`);
        await expect(withTx((tx) => restore.deleteRestorePoint(tx, backup, ownerId))).rejects.toThrow("التلقائية");

        await tamper(point, sql`created_on = created_on - 3`);
        await withTx((tx) => restore.deleteRestorePoint(tx, point, ownerId));
        expect(await db.$count(restorePoints, eq(restorePoints.id, point))).toBe(0);
    });

    it("stops at 30 manual points", async () => {
        await db.execute(sql`SELECT cc_create_restore_point('x', 'manual', NULL) FROM generate_series(1, 30)`);
        await expect(withTx((tx) => restore.createRestorePoint(tx, "", ownerId))).rejects.toThrow("30");
    });

    it("covers every table: each one is either in a point or deliberately left out", async () => {
        const inPoint = (await db.execute<{ t: string }>(sql`SELECT unnest(cc_restore_tables()) AS t`)).rows.map((r) => r.t);
        const leftOut = ["users", "sessions", "login_attempts", "audit_log", "restore_points"];
        const all = (await db.execute<{ t: string }>(sql`SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public'`)).rows.map((r) => r.t);
        // A new table must be added to cc_restore_tables() (src/db/sql/0003_restore_points.sql) or to leftOut here.
        expect(all.filter((t) => !inPoint.includes(t) && !leftOut.includes(t))).toEqual([]);
    });
});

describe("start fresh (البدء من جديد)", () => {
    it("is refused unless the owner saved a point himself today", async () => {
        await expect(withTx((tx) => restore.resetData(tx, true, ownerId))).rejects.toThrow("احفظ نقطة استرجاع اليوم");
        expect(await restore.hasManualPointToday(db)).toBe(false);

        // An automatic point doesn't count, nor does yesterday's.
        await db.execute(sql`SELECT cc_create_restore_point('x', 'before_restore', NULL)`);
        const old = await withTx((tx) => restore.createRestorePoint(tx, "", ownerId));
        await tamper(old, sql`created_on = created_on - 1`);
        expect(await restore.hasManualPointToday(db)).toBe(false);
        await expect(withTx((tx) => restore.resetData(tx, true, ownerId))).rejects.toThrow("احفظ نقطة استرجاع اليوم");
        expect(await db.$count(containers)).toBe(30);

        await withTx((tx) => restore.createRestorePoint(tx, "", ownerId));
        expect(await restore.hasManualPointToday(db)).toBe(true);
    });

    it("keeping the settings: removes containers and money, keeps the lists, and today's point undoes it", async () => {
        const before = await fingerprint();
        const point = await withTx((tx) => restore.createRestorePoint(tx, "", ownerId));
        const lines = await db.$count(shippingLines);

        const backup = await withTx((tx) => restore.resetData(tx, true, ownerId));
        expect(await db.$count(containers)).toBe(0);
        expect(await db.$count(journalEntries)).toBe(0);
        expect(await db.$count(traders)).toBe(10);
        expect(await db.$count(shippingLines)).toBe(lines);
        expect((await db.select().from(receiptSequences)).every((r) => r.nextNumber === 1)).toBe(true);
        expect(await db.$count(users)).toBe(1);
        const [b] = await db.select().from(restorePoints).where(eq(restorePoints.id, backup));
        expect(b.kind).toBe("before_reset");
        expect(await db.$count(auditLog, eq(auditLog.action, "reset"))).toBe(1);

        await withTx((tx) => restore.restoreFromPoint(tx, point, ownerId));
        expect(await fingerprint()).toEqual(before);
    });

    it("everything: back to the original starting lists, owner login kept", async () => {
        await withTx((tx) => restore.createRestorePoint(tx, "", ownerId));
        await db.update(shippingLines).set({ name: "اسم مغيّر" }).where(eq(shippingLines.name, "MSC"));

        await withTx((tx) => restore.resetData(tx, false, ownerId));
        expect(await db.$count(containers)).toBe(0);
        expect(await db.$count(traders)).toBe(0);
        expect(await db.$count(shippingLines, eq(shippingLines.name, "MSC"))).toBe(1);
        expect(await db.$count(shippingLines, eq(shippingLines.name, "اسم مغيّر"))).toBe(0);
        expect(await db.$count(users)).toBe(1);
        // Restore points survive a fresh start (that's how it is undone).
        expect(await db.$count(restorePoints)).toBe(2);
    });
});
