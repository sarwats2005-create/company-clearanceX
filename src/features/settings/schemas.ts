import { z } from "zod";
import { t } from "@/lib/i18n";
import { parseAmount, parseTypedDecimal } from "@/lib/money";

export const requiredText = (max = 100) =>
    z
        .string({ error: t("error.required") })
        .trim()
        .min(1, t("error.required"))
        .max(max, `الحد الأقصى ${max} حرفاً`);

export const optionalText = (max = 200) =>
    z
        .string()
        .trim()
        .max(max, `الحد الأقصى ${max} حرفاً`)
        .optional()
        .nullable()
        .transform((v) => (v ? v : null));

/** A decimal typed by the owner (Arabic digits/commas allowed) → normalized string, or null when blank. */
export const optionalDecimal = (max = 1_000_000) =>
    z
        .union([z.string(), z.number()])
        .optional()
        .nullable()
        .transform((v, ctx) => {
            if (v === null || v === undefined || String(v).trim() === "") return null;
            const s = parseTypedDecimal(String(v));
            if (s === null || Number(s) > max) {
                ctx.addIssue({ code: "custom", message: "اكتب رقماً صحيحاً" });
                return z.NEVER;
            }
            return s;
        });

export const currencySchema = z.enum(["IQD", "USD"], { error: "اختر العملة" });

export const simpleItemSchema = z.object({ id: z.uuid().optional(), name: requiredText(80) });

export const sizeSchema = z.object({
    id: z.uuid().optional(),
    label: requiredText(40),
    lengthM: optionalDecimal(100),
    volumeM3: optionalDecimal(1000),
});

export const partySchema = z.object({
    id: z.uuid().optional(),
    name: requiredText(100),
    kind: z.enum(["self", "clearance_company", "partner", "other"]),
    phone: optionalText(30),
    notes: optionalText(500),
    isActive: z.boolean(),
    isDefaultCompany: z.boolean(),
});

export const chargeTypeSchema = z.object({
    id: z.uuid().optional(),
    name: requiredText(80),
    defaultCurrency: currencySchema,
    defaultPartyId: z.uuid().nullable(),
    isFee: z.boolean(),
    isActive: z.boolean(),
    /** Already on the expenses page when it opens. Left out = unchanged. */
    isDefaultLine: z.boolean().optional(),
    /** container size id → typed amount ("" = no default) */
    defaults: z.record(z.string(), z.string()),
});

/** Mark an expense type as a default line (from the expenses page or Settings), with its default currency. */
export const chargeTypeDefaultLineSchema = z.object({
    id: z.uuid(),
    isDefaultLine: z.boolean(),
    defaultCurrency: currencySchema.optional(),
});

/** A small uploaded logo (PNG/JPEG/WebP as a data: URL, ≤ 150 KB) and/or the line's website. */
export const shippingLineBrandSchema = z.object({
    id: z.uuid(),
    logo: z
        .string()
        .max(200_000, "الصورة كبيرة جداً. اختر صورة أصغر")
        .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "اختر صورة PNG أو JPG")
        .nullable()
        .optional(),
    website: z
        .string()
        .trim()
        .max(120)
        .transform((v) =>
            v
                .replace(/^https?:\/\//i, "")
                .replace(/\/.*$/, "")
                .toLowerCase(),
        )
        .refine((v) => v === "" || /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v), "اكتب عنوان الموقع مثل maersk.com")
        .transform((v) => v || null)
        .nullable()
        .optional(),
});

export const receiptSequenceSchema = z.object({
    prefix: requiredText(6),
    nextNumber: z.coerce.number({ error: "اكتب رقماً صحيحاً" }).int("اكتب رقماً صحيحاً").min(1, "اكتب رقماً صحيحاً").max(999_999, "الحد الأقصى 999999"),
});

export const companySchema = z.object({
    name: requiredText(100),
    phone: optionalText(60),
    address: optionalText(200),
    receiptFooter: optionalText(300),
});

export const currencyAlertsSchema = z.object({
    defaultUsdIqdRate: z.string().transform((v, ctx) => {
        const parsed = parseAmount(v, "USD");
        if (!parsed || Number(parsed) <= 0) {
            ctx.addIssue({ code: "custom", message: "اكتب سعر الصرف، مثل 1310" });
            return z.NEVER;
        }
        return parsed;
    }),
    arrivedWarningDays: z.coerce.number({ error: "اكتب عدد الأيام" }).int("اكتب عدد الأيام").min(1, "يوم واحد على الأقل").max(365, "الحد الأقصى 365 يوماً"),
});

export const passwordSchema = z.object({
    current: z.string().min(1, t("error.required")).max(256),
    next: z.string().min(10, "كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل").max(256, "كلمة المرور طويلة جداً"),
});

export type PartyInput = z.input<typeof partySchema>;
export type ChargeTypeInput = z.input<typeof chargeTypeSchema>;
export type ChargeTypeDefaultLineInput = z.input<typeof chargeTypeDefaultLineSchema>;
export type ShippingLineBrandInput = z.input<typeof shippingLineBrandSchema>;
