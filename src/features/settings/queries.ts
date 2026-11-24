import "server-only";
import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import {
    chargeTypeDefaults,
    chargeTypes,
    containerSizes,
    expenseCategories,
    parties,
    portsOfLoading,
    receiptSequences,
    shippingLines,
    vaults,
} from "@/db/schema";
import { formatReceiptNo } from "@/features/ledger/receipt-numbers";
import { getSettingsRow } from "./service";

export const getCompanySettings = cache(() => getSettingsRow(db));

export async function getCompanyName(): Promise<string> {
    try {
        return (await getCompanySettings()).name;
    } catch {
        return "إدارة التخليص";
    }
}

export const listShippingLines = cache(() => db.select().from(shippingLines).orderBy(asc(shippingLines.sortOrder), asc(shippingLines.name)));
export const listPorts = cache(() => db.select().from(portsOfLoading).orderBy(asc(portsOfLoading.sortOrder), asc(portsOfLoading.name)));
export const listExpenseCategories = cache(() => db.select().from(expenseCategories).orderBy(asc(expenseCategories.sortOrder), asc(expenseCategories.name)));
export const listSizes = cache(() => db.select().from(containerSizes).orderBy(asc(containerSizes.sortOrder)));
export const listParties = cache(() => db.select().from(parties).orderBy(asc(parties.createdAt)));
export const listVaults = cache(() => db.select().from(vaults).orderBy(asc(vaults.createdAt)));

export const listChargeTypes = cache(async () => {
    const [types, defaults] = await Promise.all([
        db.select().from(chargeTypes).orderBy(asc(chargeTypes.sortOrder)),
        db.select().from(chargeTypeDefaults),
    ]);
    return types.map((t) => ({
        ...t,
        defaults: Object.fromEntries(defaults.filter((d) => d.chargeTypeId === t.id).map((d) => [d.containerSizeId ?? "any", d.amount])) as Record<string, string>,
    }));
});

export async function listReceiptSequences() {
    const rows = await db.select().from(receiptSequences);
    const order = ["in", "out", "transfer", "exchange"] as const;
    return order.map((kind) => {
        const r = rows.find((x) => x.kind === kind);
        const prefix = r?.prefix ?? { in: "ق", out: "ص", transfer: "ت", exchange: "ع" }[kind];
        const nextNumber = r?.nextNumber ?? 1;
        return { kind, prefix, nextNumber, preview: formatReceiptNo(prefix, nextNumber) };
    });
}

export async function getPartyById(id: string) {
    const [row] = await db.select().from(parties).where(eq(parties.id, id));
    return row ?? null;
}

export type ChargeTypeRow = Awaited<ReturnType<typeof listChargeTypes>>[number];
