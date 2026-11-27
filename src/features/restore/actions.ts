"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, withTx } from "@/db";
import { users } from "@/db/schema";
import { type Session, clientIp, requireSession } from "@/lib/auth";
import { isRateLimited, recordLoginAttempt } from "@/lib/auth-core";
import { DomainError } from "@/lib/errors";
import { MAX_PASSWORD_LENGTH, verifyPassword } from "@/lib/password";
import { runAction } from "@/lib/run-action";
import * as service from "./service";

const everything = () => revalidatePath("/", "layout");

/**
 * Restoring and starting fresh replace the business data, so they ask for the password again (OWASP: re-check
 * the user before a sensitive action). Wrong passwords count toward the same limits as logging in.
 */
async function confirmPassword(s: Session, password: unknown) {
    const ip = await clientIp();
    if (await isRateLimited(db, s.username, ip)) throw new DomainError("محاولات كثيرة. حاول مرة أخرى بعد 15 دقيقة", "password");
    const pw = typeof password === "string" ? password : "";
    if (!pw) throw new DomainError("اكتب كلمة المرور للتأكيد", "password");
    const [user] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, s.userId));
    const ok = !!user && pw.length <= MAX_PASSWORD_LENGTH && (await verifyPassword(pw, user.hash));
    if (!ok) {
        await recordLoginAttempt(db, s.username, ip, false);
        throw new DomainError("كلمة المرور غير صحيحة", "password");
    }
}

export async function createRestorePointAction(input: { label?: string }) {
    return runAction(async () => {
        const s = await requireSession();
        const label = z.object({ label: z.string().max(200).optional() }).parse(input).label ?? "";
        const id = await withTx((tx) => service.createRestorePoint(tx, label, s.userId));
        everything();
        return { id };
    });
}

export async function restoreFromPointAction(input: { id: string; password: string }) {
    return runAction(async () => {
        const s = await requireSession();
        const data = z.object({ id: z.string().uuid(), password: z.string().max(1000) }).parse(input);
        await confirmPassword(s, data.password);
        const backup = await withTx((tx) => service.restoreFromPoint(tx, data.id, s.userId));
        everything();
        return { backup };
    });
}

export async function resetDataAction(input: { keepSettings: boolean; password: string }) {
    return runAction(async () => {
        const s = await requireSession();
        const data = z.object({ keepSettings: z.boolean(), password: z.string().max(1000) }).parse(input);
        await confirmPassword(s, data.password);
        const backup = await withTx((tx) => service.resetData(tx, data.keepSettings, s.userId));
        everything();
        return { backup };
    });
}

export async function deleteRestorePointAction(id: string) {
    return runAction(async () => {
        const s = await requireSession();
        await withTx((tx) => service.deleteRestorePoint(tx, z.string().uuid().parse(id), s.userId));
        everything();
        return null;
    });
}
