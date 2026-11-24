import { z } from "zod";
import { currencySchema, optionalText, requiredText } from "@/features/settings/schemas";

export const traderUpdateSchema = z.object({
    id: z.uuid(),
    name: requiredText(100),
    phone: optionalText(30),
    city: optionalText(60),
    notes: optionalText(500),
});
export type TraderUpdateInput = z.input<typeof traderUpdateSchema>;

export const vaultSchema = z.object({
    id: z.uuid().optional(),
    name: requiredText(80),
    kind: z.enum(["main", "usd", "person", "exchange_shop", "trader", "other"], { error: "اختر نوع القاصة" }),
    allowedCurrencies: z
        .array(currencySchema)
        .min(1, "اختر عملة واحدة على الأقل")
        .transform((cs) => (["IQD", "USD"] as const).filter((c) => cs.includes(c))),
    notes: optionalText(500),
});
export type VaultInput = z.input<typeof vaultSchema>;
