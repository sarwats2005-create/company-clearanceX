import "server-only";
import { and, asc, eq, gt, lt, desc, max, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import {
    chargeTypeDefaults,
    chargeTypes,
    companySettings,
    containerSizes,
    expenseCategories,
    journalEntries,
    parties,
    portsOfLoading,
    receiptSequences,
    shippingLines,
    users,
    type ReceiptKind,
} from "@/db/schema";
import { audit } from "@/features/audit/log";
import { DomainError } from "@/lib/errors";
import { parseAmount } from "@/lib/money";
import { hashPassword, verifyPassword } from "@/lib/password";
import { deleteUserSessions } from "@/lib/auth-core";
import {
    type ChargeTypeInput,
    type PartyInput,
    chargeTypeSchema,
    companySchema,
    currencyAlertsSchema,
    partySchema,
    passwordSchema,
    receiptSequenceSchema,
    simpleItemSchema,
    sizeSchema,
} from "./schemas";

/** Ordered lists editable in Settings. */
export const ORDERED_TABLES = {
    shipping_lines: shippingLines,
    ports_of_loading: portsOfLoading,
    expense_categories: expenseCategories,
    container_sizes: containerSizes,
    charge_types: chargeTypes,
} as const;
export type OrderedKind = keyof typeof ORDERED_TABLES;
export type SimpleKind = "shipping_lines" | "ports_of_loading" | "expense_categories";

const ACTIVE_TABLES = { ...ORDERED_TABLES, parties } as const;
export type ActivatableKind = keyof typeof ACTIVE_TABLES;

export async function getSettingsRow(db: DbOrTx) {
    const [row] = await db.select().from(companySettings).where(eq(companySettings.id, 1));
    if (row) return row;
    const [created] = await db.insert(companySettings).values({ id: 1 }).onConflictDoNothing().returning();
    return created ?? (await db.select().from(companySettings).where(eq(companySettings.id, 1)))[0];
}

async function nextSortOrder(tx: DbOrTx, kind: OrderedKind) {
    const table = ORDERED_TABLES[kind];
    const [row] = await tx.select({ m: max(table.sortOrder) }).from(table);
    return (row?.m ?? -1) + 1;
}

/** Add or rename a shipping line / port / expense category. Returns the id. */
export async function saveSimpleItem(tx: DbOrTx, kind: SimpleKind, input: { id?: string; name: string }, userId: string): Promise<string> {
    const { id, name } = simpleItemSchema.parse(input);
    const table = ORDERED_TABLES[kind];
    if (id) {
        await tx.update(table).set({ name }).where(eq(table.id, id));
        await audit(tx, { table: kind, recordId: id, action: "update", after: { name }, userId });
        return id;
    }
    const [row] = await tx
        .insert(table)
        .values({ name, sortOrder: await nextSortOrder(tx, kind) })
        .returning({ id: table.id });
    await audit(tx, { table: kind, recordId: row.id, action: "create", after: { name }, userId });
    return row.id;
}

/** Swap an item with its neighbour in the display order. */
export async function moveItem(tx: DbOrTx, kind: OrderedKind, id: string, direction: "up" | "down") {
    const table = ORDERED_TABLES[kind];
    const [current] = await tx.select({ id: table.id, sortOrder: table.sortOrder }).from(table).where(eq(table.id, id));
    if (!current) return;
    const [neighbour] = await tx
        .select({ id: table.id, sortOrder: table.sortOrder })
        .from(table)
        .where(direction === "up" ? lt(table.sortOrder, current.sortOrder) : gt(table.sortOrder, current.sortOrder))
        .orderBy(direction === "up" ? desc(table.sortOrder) : asc(table.sortOrder))
        .limit(1);
    if (!neighbour) return;
    await tx.update(table).set({ sortOrder: neighbour.sortOrder }).where(eq(table.id, current.id));
    await tx.update(table).set({ sortOrder: current.sortOrder }).where(eq(table.id, neighbour.id));
}

/** Records in use are never deleted, only deactivated (PRD §8.10). */
export async function setItemActive(tx: DbOrTx, kind: ActivatableKind, id: string, isActive: boolean, userId: string) {
    const table = ACTIVE_TABLES[kind];
    if (kind === "parties" && !isActive) {
        const [p] = await tx.select().from(parties).where(eq(parties.id, id));
        if (p?.kind === "self" || p?.isSystem) throw new DomainError("لا يمكن إيقاف هذه الجهة لأنها شركتك");
    }
    await tx.update(table).set({ isActive }).where(eq(table.id, id));
    await audit(tx, { table: kind, recordId: id, action: "update", after: { isActive }, userId });
}

export async function saveSize(tx: DbOrTx, input: { id?: string; label: string; lengthM?: string | null; volumeM3?: string | null }, userId: string) {
    const data = sizeSchema.parse(input);
    if (data.id) {
        await tx.update(containerSizes).set({ label: data.label, lengthM: data.lengthM, volumeM3: data.volumeM3 }).where(eq(containerSizes.id, data.id));
        await audit(tx, { table: "container_sizes", recordId: data.id, action: "update", after: data, userId });
        return data.id;
    }
    const code = `size-${Date.now().toString(36)}`;
    const [row] = await tx
        .insert(containerSizes)
        .values({ code, label: data.label, lengthM: data.lengthM, volumeM3: data.volumeM3, sortOrder: await nextSortOrder(tx, "container_sizes") })
        .returning({ id: containerSizes.id });
    await audit(tx, { table: "container_sizes", recordId: row.id, action: "create", after: data, userId });
    return row.id;
}

export async function saveParty(tx: DbOrTx, input: PartyInput, userId: string): Promise<string> {
    const data = partySchema.parse(input);
    let id = data.id;
    if (id) {
        const [before] = await tx.select().from(parties).where(eq(parties.id, id));
        if (!before) throw new DomainError("لم نجد هذه الجهة");
        if ((before.kind === "self" || before.isSystem) && (!data.isActive || data.kind !== "self")) throw new DomainError("لا يمكن تغيير نوع جهة شركتك أو إيقافها");
        await tx.update(parties).set({ name: data.name, kind: data.kind, phone: data.phone, notes: data.notes, isActive: data.isActive }).where(eq(parties.id, id));
        await audit(tx, { table: "parties", recordId: id, action: "update", before, after: data, userId });
    } else {
        if (data.kind === "self") throw new DomainError("يوجد جهة واحدة فقط لشركتك");
        const [row] = await tx.insert(parties).values({ name: data.name, kind: data.kind, phone: data.phone, notes: data.notes, isActive: data.isActive }).returning({ id: parties.id });
        id = row.id;
        await audit(tx, { table: "parties", recordId: id, action: "create", after: data, userId });
    }
    if (data.isDefaultCompany) {
        await getSettingsRow(tx);
        await tx.update(companySettings).set({ defaultClearancePartyId: id }).where(eq(companySettings.id, 1));
    }
    return id;
}

export async function saveChargeType(tx: DbOrTx, input: ChargeTypeInput, userId: string): Promise<string> {
    const data = chargeTypeSchema.parse(input);
    const values = {
        name: data.name,
        defaultCurrency: data.defaultCurrency,
        defaultPartyId: data.isFee ? null : data.defaultPartyId,
        isFee: data.isFee,
        isActive: data.isActive,
    };
    const defaults: { sizeId: string; amount: string }[] = [];
    for (const [sizeId, raw] of Object.entries(data.defaults)) {
        if (!raw.trim()) continue;
        const amount = parseAmount(raw, data.defaultCurrency);
        if (amount === null) throw new DomainError("اكتب المبلغ بالأرقام فقط، مثل 2400", `defaults.${sizeId}`);
        if (Number(amount) > 0) defaults.push({ sizeId, amount });
    }

    let id = data.id;
    if (id) {
        await tx.update(chargeTypes).set(values).where(eq(chargeTypes.id, id));
        await audit(tx, { table: "charge_types", recordId: id, action: "update", after: data, userId });
    } else {
        const [row] = await tx
            .insert(chargeTypes)
            .values({ ...values, sortOrder: await nextSortOrder(tx, "charge_types") })
            .returning({ id: chargeTypes.id });
        id = row.id;
        await audit(tx, { table: "charge_types", recordId: id, action: "create", after: data, userId });
    }
    await tx.delete(chargeTypeDefaults).where(eq(chargeTypeDefaults.chargeTypeId, id));
    if (defaults.length) await tx.insert(chargeTypeDefaults).values(defaults.map((d) => ({ chargeTypeId: id!, containerSizeId: d.sizeId, amount: d.amount })));
    return id;
}

/** Prefix and next number per receipt kind. The number can only move up, and never below a used one (PRD §6.5). */
export async function updateReceiptSequence(tx: DbOrTx, kind: ReceiptKind, input: { prefix: string; nextNumber: number | string }, userId: string) {
    const data = receiptSequenceSchema.parse(input);
    const [seq] = await tx.select().from(receiptSequences).where(eq(receiptSequences.kind, kind)).for("update");
    const current = seq?.nextNumber ?? 1;
    if (data.nextNumber < current) throw new DomainError(`الرقم التالي لا يمكن أن يقل عن ${current}`, "nextNumber");
    const [used] = await tx
        .select({ n: sql<number>`coalesce(max((regexp_match(${journalEntries.receiptNo}, '(\\d+)$'))[1]::int), 0)` })
        .from(journalEntries)
        .where(and(eq(journalEntries.receiptKind, kind), eq(sql`split_part(${journalEntries.receiptNo}, '-', 1)`, data.prefix)));
    if (data.nextNumber <= Number(used?.n ?? 0)) throw new DomainError(`الرقم ${data.nextNumber} مستخدم مسبقاً`, "nextNumber");
    await tx
        .insert(receiptSequences)
        .values({ kind, prefix: data.prefix, nextNumber: data.nextNumber })
        .onConflictDoUpdate({ target: receiptSequences.kind, set: { prefix: data.prefix, nextNumber: data.nextNumber } });
    await audit(tx, { table: "receipt_sequences", recordId: kind, action: "update", before: seq, after: data, userId });
}

export async function updateCompany(tx: DbOrTx, input: unknown, userId: string) {
    const data = companySchema.parse(input);
    const before = await getSettingsRow(tx);
    await tx.update(companySettings).set(data).where(eq(companySettings.id, 1));
    await audit(tx, { table: "company_settings", recordId: "1", action: "update", before, after: data, userId });
}

export async function updateCurrencyAndAlerts(tx: DbOrTx, input: unknown, userId: string) {
    const data = currencyAlertsSchema.parse(input);
    const before = await getSettingsRow(tx);
    const rateChanged = Number(before.defaultUsdIqdRate) !== Number(data.defaultUsdIqdRate);
    await tx
        .update(companySettings)
        .set({ defaultUsdIqdRate: data.defaultUsdIqdRate, arrivedWarningDays: data.arrivedWarningDays, ...(rateChanged ? { rateUpdatedAt: new Date() } : {}) })
        .where(eq(companySettings.id, 1));
    await audit(tx, { table: "company_settings", recordId: "1", action: "update", before, after: data, userId });
}

/** Remembers the last rate typed in a money form, so the next form pre-fills it (PRD §10.5 item 4). */
export async function rememberRate(tx: DbOrTx, rate: string) {
    await getSettingsRow(tx);
    await tx.update(companySettings).set({ defaultUsdIqdRate: rate, rateUpdatedAt: new Date() }).where(eq(companySettings.id, 1));
}

export async function changePassword(tx: DbOrTx, userId: string, current: string, next: string) {
    const data = passwordSchema.parse({ current, next });
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    if (!user || !(await verifyPassword(data.current, user.passwordHash))) throw new DomainError("كلمة المرور الحالية غير صحيحة", "current");
    await tx.update(users).set({ passwordHash: await hashPassword(data.next) }).where(eq(users.id, userId));
    await deleteUserSessions(tx, userId);
    await audit(tx, { table: "users", recordId: userId, action: "update", after: { password: "changed" }, userId });
}
