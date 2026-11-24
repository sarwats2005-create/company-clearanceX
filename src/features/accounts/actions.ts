"use server";

import { revalidatePath } from "next/cache";
import { withTx } from "@/db";
import { requireSession } from "@/lib/auth";
import { runAction } from "@/lib/run-action";
import type { TraderUpdateInput, VaultInput } from "./schemas";
import * as service from "./service";

const done = () => revalidatePath("/", "layout");

export async function updateTraderAction(input: TraderUpdateInput) {
    return runAction(async () => {
        const s = await requireSession();
        await withTx((tx) => service.updateTrader(tx, input, s.userId));
        done();
        return null;
    });
}

export async function saveVaultAction(input: VaultInput) {
    return runAction(async () => {
        const s = await requireSession();
        const id = await withTx((tx) => service.saveVault(tx, input, s.userId));
        done();
        return { id };
    });
}

export async function setVaultActiveAction(id: string, isActive: boolean) {
    return runAction(async () => {
        const s = await requireSession();
        await withTx((tx) => service.setVaultActive(tx, id, isActive, s.userId));
        done();
        return null;
    });
}
