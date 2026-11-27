"use server";

import { revalidatePath } from "next/cache";
import { db, withTx } from "@/db";
import { requireSession } from "@/lib/auth";
import { runAction } from "@/lib/run-action";
import { type MoneyInput, cancelReceiptSchema } from "./schemas";
import * as service from "./service";

const done = () => revalidatePath("/", "layout");

/** Saves one money action and returns its receipt (PRD §8.7: the receipt page opens next). */
export async function postMoneyAction(input: MoneyInput) {
    return runAction(async () => {
        const s = await requireSession();
        const result = await withTx((tx) => service.postMoney(tx, input, s.userId));
        done();
        return result;
    });
}

/** Vaults this action would take below zero; the confirmation shows the warning (PRD §6.4). */
export async function checkMoneyAction(input: MoneyInput) {
    return runAction(async () => {
        await requireSession();
        return service.willGoNegative(db, input);
    });
}

export async function cancelReceiptAction(input: { entryId: string; reason: string }) {
    return runAction(async () => {
        const s = await requireSession();
        const data = cancelReceiptSchema.parse(input);
        const result = await withTx((tx) => service.cancelReceipt(tx, data.entryId, data.reason, s.userId));
        done();
        return { entryId: result.entryId, receiptNo: result.receiptNo };
    });
}
