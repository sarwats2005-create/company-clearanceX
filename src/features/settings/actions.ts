"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db, withTx } from "@/db";
import type { ReceiptKind } from "@/db/schema";
import { SESSION_COOKIE, requireSession } from "@/lib/auth";
import { createSessionRecord } from "@/lib/auth-core";
import { runAction } from "@/lib/run-action";
import { TEXT_SIZE_COOKIE, type TextSize, parseTextSize } from "@/lib/text-size";
import type { ChargeTypeInput, PartyInput } from "./schemas";
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

export async function changePasswordAction(input: { current: string; next: string }) {
    return runAction(async () => {
        const s = await requireSession();
        await withTx((tx) => service.changePassword(tx, s.userId, input.current, input.next));
        // Other devices are signed out; keep this one signed in with a fresh session.
        const { token, expiresAt } = await createSessionRecord(db, s.userId);
        (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
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
