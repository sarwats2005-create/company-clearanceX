"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db, withTx } from "@/db";
import { sessions } from "@/db/schema";
import { audit } from "@/features/audit/log";
import type { ReceiptKind } from "@/db/schema";
import { clientIp, requireSession, setSessionCookie } from "@/lib/auth";
import { createSessionRecord, deleteOtherSessions, isRateLimited, listUserSessions, recordLoginAttempt } from "@/lib/auth-core";
import { DomainError } from "@/lib/errors";
import { runAction } from "@/lib/run-action";
import { TEXT_SIZE_COOKIE, type TextSize, parseTextSize } from "@/lib/text-size";
import type { ChargeTypeDefaultLineInput, ChargeTypeInput, PartyInput, ShippingLineBrandInput } from "./schemas";
import * as service from "./service";

const done = () => revalidatePath("/", "layout");

export async function saveSimpleItemAction(kind: service.SimpleKind, input: { id?: string; name: string }) {
    return runAction(async () => {
        const s = await requireSession();
        const id = await withTx((tx) => service.saveSimpleItem(tx, kind, input, s.userId));
        done();
        return { id };
    });
}

export async function moveItemAction(kind: service.OrderedKind, id: string, direction: "up" | "down") {
    return runAction(async () => {
        await requireSession();
        await withTx((tx) => service.moveItem(tx, kind, id, direction));
        done();
        return null;
    });
}

export async function setItemActiveAction(kind: service.ActivatableKind, id: string, isActive: boolean) {
    return runAction(async () => {
        const s = await requireSession();
        await withTx((tx) => service.setItemActive(tx, kind, id, isActive, s.userId));
        done();
        return null;
    });
}

export async function saveSizeAction(input: { id?: string; label: string; lengthM?: string | null; volumeM3?: string | null }) {
    return runAction(async () => {
        const s = await requireSession();
        const id = await withTx((tx) => service.saveSize(tx, input, s.userId));
        done();
        return { id };
    });
}

export async function savePartyAction(input: PartyInput) {
    return runAction(async () => {
        const s = await requireSession();
        const id = await withTx((tx) => service.saveParty(tx, input, s.userId));
        done();
        return { id };
    });
}

export async function saveChargeTypeAction(input: ChargeTypeInput) {
    return runAction(async () => {
        const s = await requireSession();
        const id = await withTx((tx) => service.saveChargeType(tx, input, s.userId));
        done();
        return { id };
    });
}

export async function setChargeTypeDefaultLineAction(input: ChargeTypeDefaultLineInput) {
    return runAction(async () => {
        const s = await requireSession();
        await withTx((tx) => service.setChargeTypeDefaultLine(tx, input, s.userId));
        done();
        return null;
    });
}

export async function saveShippingLineBrandAction(input: ShippingLineBrandInput) {
    return runAction(async () => {
        const s = await requireSession();
        await withTx((tx) => service.saveShippingLineBrand(tx, input, s.userId));
        done();
        return null;
    });
}

export async function updateReceiptSequenceAction(kind: ReceiptKind, input: { prefix: string; nextNumber: string }) {
    return runAction(async () => {
        const s = await requireSession();
        await withTx((tx) => service.updateReceiptSequence(tx, kind, input, s.userId));
        done();
        return null;
    });
}

export async function updateCompanyAction(input: { name: string; phone: string; address: string; receiptFooter: string }) {
    return runAction(async () => {
        const s = await requireSession();
        await withTx((tx) => service.updateCompany(tx, input, s.userId));
        done();
        return null;
    });
}

export async function updateCurrencyAlertsAction(input: { defaultUsdIqdRate: string; arrivedWarningDays: string }) {
    return runAction(async () => {
        const s = await requireSession();
        await withTx((tx) => service.updateCurrencyAndAlerts(tx, input, s.userId));
        done();
        return null;
    });
}

export async function setDefaultVaultsAction(input: { IQD: string; USD: string }) {
    return runAction(async () => {
        const s = await requireSession();
        await withTx((tx) => service.setDefaultVaults(tx, input, s.userId));
        done();
        return null;
    });
}

export async function changePasswordAction(input: { current: string; next: string }) {
    return runAction(async () => {
        const s = await requireSession();
        // The current password is a password check like a login: same limits, so a stolen session can't guess it.
        const ip = await clientIp();
        if (await isRateLimited(db, s.username, ip)) throw new DomainError("محاولات كثيرة. حاول مرة أخرى بعد 15 دقيقة", "current");
        try {
            await withTx((tx) => service.changePassword(tx, s.userId, input.current, input.next));
        } catch (err) {
            if (err instanceof DomainError && err.field === "current") await recordLoginAttempt(db, s.username, ip, false);
            throw err;
        }
        // Every session ended (other devices are signed out); keep this one signed in with a fresh session.
        const userAgent = (await headers()).get("user-agent");
        const { token, expiresAt } = await createSessionRecord(db, s.userId, { remember: true, userAgent, ip });
        await setSessionCookie(token, expiresAt, true);
        return null;
    });
}

/** Signs out every other device of the owner (for a lost or shared phone). Keeps this one. */
export async function signOutOtherDevicesAction() {
    return runAction(async () => {
        const s = await requireSession();
        const count = await deleteOtherSessions(db, s.userId, s.sessionId);
        await audit(db, { table: "sessions", recordId: s.userId, action: "update", after: { signedOutOtherDevices: count }, userId: s.userId });
        done();
        return { count };
    });
}

/** Signs out one device. Only the owner's own sessions can be touched, never someone else's. */
export async function signOutDeviceAction(sessionId: string) {
    return runAction(async () => {
        const s = await requireSession();
        if (sessionId === s.sessionId) throw new DomainError("هذا هو الجهاز الحالي. استخدم «تسجيل الخروج»");
        const mine = (await listUserSessions(db, s.userId)).some((x) => x.id === sessionId);
        if (!mine) throw new DomainError("الجهاز غير موجود");
        await db.delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, s.userId)));
        await audit(db, { table: "sessions", recordId: s.userId, action: "update", after: { signedOutDevice: true }, userId: s.userId });
        done();
        return null;
    });
}

export async function setTextSizeAction(size: TextSize) {
    return runAction(async () => {
        await requireSession();
        (await cookies()).set(TEXT_SIZE_COOKIE, parseTextSize(size), { path: "/", maxAge: 60 * 60 * 24 * 365 * 5, sameSite: "lax" });
        done();
        return null;
    });
}
