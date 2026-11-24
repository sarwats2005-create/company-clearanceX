/** Container form validation (PRD §5.2, §5.3). Shared by the server and the form. */
import Decimal from "decimal.js";
import { z } from "zod";
import { optionalDecimal, optionalText } from "@/features/settings/schemas";
import { normalizeContainerNumber } from "@/lib/container-number";
import { t } from "@/lib/i18n";
import { normalizeDigits } from "@/lib/money";
import { isIsoDate } from "./status";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const requiredId = (message: string) => z.string({ error: message }).regex(UUID, message);

const optionalId = z
    .string()
    .nullish()
    .transform((v, ctx) => {
        if (!v) return null;
        if (!UUID.test(v)) {
            ctx.addIssue({ code: "custom", message: "اختيار غير صحيح" });
            return z.NEVER;
        }
        return v;
    });

const optionalInt = (min: number, max = 1_000_000) =>
    z
        .union([z.string(), z.number()])
        .nullish()
        .transform((v, ctx) => {
            if (v === null || v === undefined || String(v).trim() === "") return null;
            const s = normalizeDigits(String(v)).replace(/[\s,٬]/g, "");
            if (!/^\d+$/.test(s) || Number(s) < min || Number(s) > max) {
                ctx.addIssue({ code: "custom", message: min > 0 ? `اكتب رقماً صحيحاً (${min} أو أكثر)` : "اكتب رقماً صحيحاً" });
                return z.NEVER;
            }
            return Number(s);
        });

const optionalDate = z
    .string()
    .nullish()
    .transform((v, ctx) => {
        if (!v) return null;
        if (!isIsoDate(v)) {
            ctx.addIssue({ code: "custom", message: "تاريخ غير صحيح" });
            return z.NEVER;
        }
        return v;
    });

export const splitUnitSchema = z.enum(["meters", "cbm", "percent", "equal"]);

export const shareSchema = z.object({
    traderId: z.string({ error: "اختر التاجر" }).trim(),
    shareValue: optionalDecimal(1_000_000),
    goods: optionalText(200),
    cartons: optionalInt(0),
    weightKg: optionalDecimal(10_000_000),
});

export const containerInputSchema = z
    .object({
        containerNumber: z
            .string({ error: t("error.required") })
            .transform(normalizeContainerNumber)
            .pipe(z.string().min(1, t("error.required")).max(20, "رقم الحاوية طويل جداً")),
        shippingLineId: requiredId("اختر خط الشحن"),
        isShared: z.boolean().default(false),
        splitUnit: splitUnitSchema.nullish(),
        shares: z.array(shareSchema).max(30, "عدد التجار كبير جداً"),
        portOfLoadingId: optionalId,
        billOfLadingNumber: z
            .string()
            .nullish()
            .transform((v) => (v ? normalizeDigits(v).trim().toUpperCase() || null : null))
            .pipe(z.string().max(40, "الحد الأقصى 40 حرفاً").nullable()),
        containerSizeId: optionalId,
        quantity: optionalInt(1, 1000).transform((v) => v ?? 1),
        faxNumber: optionalText(50),
        companyPartyId: optionalId,
        destination: optionalText(100),
        registeredOn: optionalDate,
        expectedArrivalOn: optionalDate,
        arrivedOn: optionalDate,
        deliveredOn: optionalDate,
        notes: optionalText(2000),
    })
    .superRefine((v, ctx) => {
        if (v.shares.length === 0) {
            ctx.addIssue({ code: "custom", path: ["shares", 0, "traderId"], message: "اختر التاجر" });
            return;
        }
        const rows = v.isShared ? v.shares : v.shares.slice(0, 1);
        const seen = new Set<string>();
        rows.forEach((s, i) => {
            if (!UUID.test(s.traderId)) ctx.addIssue({ code: "custom", path: ["shares", i, "traderId"], message: "اختر التاجر" });
            else if (seen.has(s.traderId)) ctx.addIssue({ code: "custom", path: ["shares", i, "traderId"], message: "هذا التاجر مضاف مسبقاً" });
            seen.add(s.traderId);
        });
        if (!v.isShared) return;
        if (rows.length < 2) ctx.addIssue({ code: "custom", path: ["shares"], message: "أضف تاجراً ثانياً، أو أطفئ خيار الحاوية المشتركة" });
        if (!v.splitUnit) {
            ctx.addIssue({ code: "custom", path: ["splitUnit"], message: "اختر وحدة التقسيم" });
            return;
        }
        if (v.splitUnit === "equal") return;
        let sum = new Decimal(0);
        rows.forEach((s, i) => {
            if (!s.shareValue || new Decimal(s.shareValue).lte(0)) ctx.addIssue({ code: "custom", path: ["shares", i, "shareValue"], message: t("error.shareZero") });
            else sum = sum.plus(s.shareValue);
        });
        if (v.splitUnit === "percent" && !sum.eq(100)) ctx.addIssue({ code: "custom", path: ["shares"], message: t("error.percentTotal") });
    })
    .transform((v) => {
        if (v.isShared) return { ...v, splitUnit: v.splitUnit ?? null, shares: v.splitUnit === "equal" ? v.shares.map((s) => ({ ...s, shareValue: null })) : v.shares };
        // A normal container is one share of 100% (PRD §5.3): one trader, no share value, no unit.
        return { ...v, splitUnit: null, shares: [{ ...v.shares[0], shareValue: null }] };
    });

export type ContainerInput = z.input<typeof containerInputSchema>;
export type ContainerData = z.output<typeof containerInputSchema>;

export const statusChangeSchema = z.object({
    to: z.enum(["confirmed", "on_the_way", "arrived", "delivered"], { error: "اختر المرحلة" }),
    date: z.string({ error: "اختر التاريخ" }),
    note: optionalText(500),
});
export type StatusChangeInput = z.input<typeof statusChangeSchema>;

export const traderSchema = z.object({
    name: z.string({ error: t("error.required") }).trim().min(1, t("error.required")).max(100, "الحد الأقصى 100 حرفاً"),
    phone: optionalText(30),
});
export type TraderInput = z.input<typeof traderSchema>;
