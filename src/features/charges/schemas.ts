/** Charges input (PRD §5.4). Shared by the server actions and the charges sheet. */
import { z } from "zod";
import { ISO_DATE } from "@/features/containers/status";
import { parseAmount, parseTypedDecimal } from "@/lib/money";
import type { ChargeSplit } from "./allocate";

const id = z.string().uuid();
const optId = z
    .string()
    .uuid()
    .nullish()
    .or(z.literal("").transform(() => null));

export const chargeRowSchema = z
    .object({
        chargeTypeId: id,
        amount: z.string(),
        currency: z.enum(["IQD", "USD"]),
        paidByPartyId: optId,
        vaultId: optId,
        /** Dollar rate when a dollar expense is paid by the branch (its vault is dinar only): the charge is saved in dinar. */
        fxRate: z.string().nullish(),
        splitMode: z.enum(["by_share", "single_trader", "manual"]).default("by_share"),
        splitTraderId: optId,
        manual: z.record(z.string(), z.string()).optional(),
        note: z
            .string()
            .trim()
            .max(500, "الملاحظة طويلة جداً")
            .nullish()
            .transform((v) => v || null),
    })
    .transform((r, ctx) => {
        const amount = parseAmount(r.amount, r.currency);
        if (amount === null || Number(amount) <= 0) {
            ctx.addIssue({ code: "custom", path: ["amount"], message: "اكتب المبلغ" });
            return z.NEVER;
        }
        const split: ChargeSplit =
            r.splitMode === "single_trader"
                ? { mode: "single_trader", traderId: r.splitTraderId ?? "" }
                : r.splitMode === "manual"
                  ? { mode: "manual", amounts: r.manual ?? {} }
                  : { mode: "by_share" };
        return {
            chargeTypeId: r.chargeTypeId,
            amount,
            currency: r.currency,
            paidByPartyId: r.paidByPartyId ?? null,
            vaultId: r.vaultId ?? null,
            fxRate: r.fxRate ? parseTypedDecimal(r.fxRate) : null,
            split,
            note: r.note,
        };
    });

export const addChargesSchema = z.object({
    containerId: id,
    date: z.string().regex(ISO_DATE, "اختر التاريخ"),
    rows: z.array(chargeRowSchema).min(1, "اختر نوع مصروف واحد على الأقل"),
    allowNegative: z.boolean().optional(),
});

export const cancelChargeSchema = z.object({
    chargeId: id,
    reason: z.string().trim().min(1, "اكتب سبب الإلغاء").max(300, "السبب طويل جداً"),
});

export type ChargeRowInput = z.input<typeof chargeRowSchema>;
export type AddChargesInput = z.input<typeof addChargesSchema>;
export type ChargeRow = z.output<typeof chargeRowSchema>;
