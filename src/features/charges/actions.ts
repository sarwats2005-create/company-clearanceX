"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, withTx } from "@/db";
import { type VaultOutflow, vaultShortfalls } from "@/features/ledger/vault-check";
import { requireSession } from "@/lib/auth";
import { runAction } from "@/lib/run-action";
import { type AddChargesInput, cancelChargeSchema } from "./schemas";
import * as service from "./service";

const done = () => revalidatePath("/", "layout");

export async function addChargesAction(input: AddChargesInput) {
    return runAction(async () => {
        const s = await requireSession();
        const { charges } = await withTx((tx) => service.addCharges(tx, input, s.userId));
        done();
        return { count: charges.length, receiptNos: charges.map((c) => c.receiptNo).filter((n): n is string => !!n) };
    });
}

const outflowsSchema = z
    .array(z.object({ vaultId: z.string().uuid(), currency: z.enum(["IQD", "USD"]), amount: z.string().regex(/^\d+(\.\d{1,2})?$/) }))
    .max(50);

/** Which vaults would go below zero; the sheet shows the warning in its confirmation (PRD §6.4). */
export async function checkVaultsAction(outflows: VaultOutflow[]) {
    return runAction(async () => {
        await requireSession();
        return vaultShortfalls(db, outflowsSchema.parse(outflows));
    });
}

export async function cancelChargeAction(input: { chargeId: string; reason: string }) {
    return runAction(async () => {
        const s = await requireSession();
        const data = cancelChargeSchema.parse(input);
        const result = await withTx((tx) => service.cancelCharge(tx, data.chargeId, data.reason, s.userId));
        done();
        return { receiptNo: result.receiptNo };
    });
}

export async function resplitChargesAction(containerId: string) {
    return runAction(async () => {
        const s = await requireSession();
        const result = await withTx((tx) => service.resplitCharges(tx, z.string().uuid().parse(containerId), s.userId));
        done();
        return result;
    });
}
