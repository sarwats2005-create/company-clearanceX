import "server-only";
import { desc, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/db";
import { type RestorePointKind, restorePoints } from "@/db/schema";
import { seedLists } from "@/db/seed";
import { audit } from "@/features/audit/log";
import { DomainError } from "@/lib/errors";

/**
 * Restore points and "start fresh". The copying, restoring and wiping is done by the database's own functions
 * (src/db/sql/0003_restore_points.sql); this file only calls them and turns their refusals into Arabic.
 */

export interface RestorePointRow {
    id: string;
    label: string;
    kind: RestorePointKind;
    counts: Record<string, number>;
    createdOn: string;
    createdAt: Date;
}

/** Restore points need a bit longer than a normal request (a whole copy of the data). */
const LONG_TIMEOUT = sql`SET LOCAL statement_timeout = '120s'`;

const ERRORS: Record<string, string> = {
    cc_too_many_points: "عندك 30 نقطة استرجاع. احذف نقطة قديمة أولاً.",
    cc_point_not_found: "نقطة الاسترجاع غير موجودة.",
    cc_point_unknown_format: "هذه النقطة من نسخة أخرى من البرنامج ولا يمكن استرجاعها.",
    cc_point_damaged: "هذه النقطة تالفة ولا يمكن استرجاعها. لم يتغير أي شيء.",
    cc_no_point_today: "احفظ نقطة استرجاع اليوم أولاً، ثم يمكنك البدء من جديد.",
    cc_point_is_automatic: "النقاط التلقائية تُحذف وحدها بعد 30 يوماً.",
    cc_point_is_from_today: "لا يمكن حذف نقطة محفوظة اليوم. يمكنك حذفها من الغد.",
};

/** Turns the database function's refusal (RAISE EXCEPTION 'cc_…') into the owner's message. */
function friendly(err: unknown): never {
    const e = err as { message?: string; cause?: { message?: string } };
    const code = e?.cause?.message ?? e?.message ?? "";
    const message = ERRORS[code];
    if (message) throw new DomainError(message);
    throw err;
}

const idSchema = z.string().uuid();
const labelSchema = z.string().trim().max(80, "الاسم طويل جداً (80 حرفاً على الأكثر)");

export async function listRestorePoints(db: DbOrTx): Promise<RestorePointRow[]> {
    return db
        .select({
            id: restorePoints.id,
            label: restorePoints.label,
            kind: restorePoints.kind,
            counts: restorePoints.counts,
            createdOn: restorePoints.createdOn,
            createdAt: restorePoints.createdAt,
        })
        .from(restorePoints)
        .orderBy(desc(restorePoints.createdAt));
}

/** The rule for "start fresh": the owner saved a point himself today (Baghdad time). */
export async function hasManualPointToday(db: DbOrTx): Promise<boolean> {
    const rows = await db.execute<{ ok: boolean }>(
        sql`SELECT EXISTS (SELECT 1 FROM restore_points WHERE kind = 'manual' AND created_on = (now() AT TIME ZONE 'Asia/Baghdad')::date) AS ok`,
    );
    return Boolean(rows.rows[0]?.ok);
}

export async function createRestorePoint(tx: DbOrTx, label: string, userId: string): Promise<string> {
    const name = labelSchema.parse(label);
    await tx.execute(LONG_TIMEOUT);
    try {
        const rows = await tx.execute<{ id: string }>(sql`SELECT cc_create_restore_point(${name}, 'manual', ${userId}::uuid) AS id`);
        const id = rows.rows[0].id;
        await audit(tx, { table: "restore_points", recordId: id, action: "create", after: { label: name || null }, userId });
        return id;
    } catch (err) {
        friendly(err);
    }
}

/** Puts every business record back as it was at that point. Returns the automatic point saved just before. */
export async function restoreFromPoint(tx: DbOrTx, pointId: string, userId: string): Promise<string> {
    const id = idSchema.parse(pointId);
    await tx.execute(LONG_TIMEOUT);
    try {
        const rows = await tx.execute<{ backup: string }>(sql`SELECT cc_restore_from_point(${id}::uuid, ${userId}::uuid) AS backup`);
        const backup = rows.rows[0].backup;
        await audit(tx, { table: "restore_points", recordId: id, action: "restore", after: { savedBefore: backup }, userId });
        return backup;
    } catch (err) {
        friendly(err);
    }
}

/**
 * "Start fresh". keepSettings: remove containers and money only (lists and settings stay, balances go to zero);
 * otherwise remove everything and put back the original starting lists. Logins are never touched.
 */
export async function resetData(tx: DbOrTx, keepSettings: boolean, userId: string): Promise<string> {
    await tx.execute(LONG_TIMEOUT);
    try {
        const rows = await tx.execute<{ backup: string }>(sql`SELECT cc_reset_data(${keepSettings}, ${userId}::uuid) AS backup`);
        const backup = rows.rows[0].backup;
        if (!keepSettings) await seedLists(tx);
        await audit(tx, { table: "restore_points", recordId: backup, action: "reset", after: { keepSettings, savedBefore: backup }, userId });
        return backup;
    } catch (err) {
        friendly(err);
    }
}

export async function deleteRestorePoint(tx: DbOrTx, pointId: string, userId: string) {
    const id = idSchema.parse(pointId);
    try {
        await tx.execute(sql`SELECT cc_delete_restore_point(${id}::uuid)`);
        await audit(tx, { table: "restore_points", recordId: id, action: "archive", after: { deleted: true }, userId });
    } catch (err) {
        friendly(err);
    }
}
