"use server";

import { revalidatePath } from "next/cache";
import { db, withTx } from "@/db";
import { requireSession } from "@/lib/auth";
import { runAction } from "@/lib/run-action";
import { createTrader } from "@/features/traders/service";
import { checkContainerNumber } from "./queries";
import type { ContainerInput, StatusChangeInput, TraderInput } from "./schemas";
import * as service from "./service";

const done = () => revalidatePath("/", "layout");

export async function createContainerAction(input: ContainerInput) {
    return runAction(async () => {
        const s = await requireSession();
        const result = await withTx((tx) => service.createContainer(tx, input, s.userId));
        done();
        return result;
    });
}

export async function updateContainerAction(id: string, input: ContainerInput) {
    return runAction(async () => {
        const s = await requireSession();
        await withTx((tx) => service.updateContainer(tx, id, input, s.userId));
        done();
        return { id };
    });
}

export async function changeStatusAction(id: string, input: StatusChangeInput) {
    return runAction(async () => {
        const s = await requireSession();
        await withTx((tx) => service.changeStatus(tx, id, input, s.userId));
        done();
        return null;
    });
}

export async function setShareDeliveredAction(containerId: string, traderId: string, date: string | null) {
    return runAction(async () => {
        const s = await requireSession();
        await withTx((tx) => service.setShareDelivered(tx, containerId, traderId, date, s.userId));
        done();
        return null;
    });
}

export async function archiveContainerAction(id: string) {
    return runAction(async () => {
        const s = await requireSession();
        await withTx((tx) => service.archiveContainer(tx, id, s.userId));
        done();
        return null;
    });
}

export async function checkContainerNumberAction(raw: string, exceptId?: string) {
    return runAction(async () => {
        await requireSession();
        return checkContainerNumber(db, raw, exceptId);
    });
}

export async function createTraderAction(input: TraderInput) {
    return runAction(async () => {
        const s = await requireSession();
        const id = await withTx((tx) => createTrader(tx, input, s.userId));
        done();
        return { id, name: input.name.trim() };
    });
}
