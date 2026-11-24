import "server-only";
import { and, count, eq, isNull, ne, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { containerCharges, containerShares, containerStatusHistory, containers } from "@/db/schema";
import { audit } from "@/features/audit/log";
import { getSettingsRow } from "@/features/settings/service";
import { DomainError } from "@/lib/errors";
import { todayISO } from "@/lib/format";
import { t } from "@/lib/i18n";
import { type ContainerData, type ContainerInput, type StatusChangeInput, containerInputSchema, statusChangeSchema } from "./schemas";
import { planStatusChange, statusIndex } from "./status";

export type { ContainerInput, StatusChangeInput };

const NOT_FOUND = "لم نجد هذه الحاوية";

async function assertNumberFree(tx: DbOrTx, containerNumber: string, exceptId?: string) {
    const [hit] = await tx
        .select({ id: containers.id })
        .from(containers)
        .where(exceptId ? and(eq(containers.containerNumber, containerNumber), ne(containers.id, exceptId)) : eq(containers.containerNumber, containerNumber));
    if (hit) throw new DomainError(t("error.duplicateContainer"), "containerNumber");
}

async function lockContainer(tx: DbOrTx, id: string) {
    const [row] = await tx.select().from(containers).where(eq(containers.id, id)).for("update");
    if (!row) throw new DomainError(NOT_FOUND);
    return row;
}

export async function activeChargeCount(tx: DbOrTx, containerId: string): Promise<number> {
    const [row] = await tx
        .select({ n: count() })
        .from(containerCharges)
        .where(and(eq(containerCharges.containerId, containerId), isNull(containerCharges.cancelledAt)));
    return Number(row?.n ?? 0);
}

function containerValues(data: ContainerData) {
    return {
        containerNumber: data.containerNumber,
        shippingLineId: data.shippingLineId,
        portOfLoadingId: data.portOfLoadingId,
        billOfLadingNumber: data.billOfLadingNumber,
        isShared: data.isShared,
        splitUnit: data.splitUnit,
        faxNumber: data.faxNumber,
        containerSizeId: data.containerSizeId,
        quantity: data.quantity,
        companyPartyId: data.companyPartyId,
        destination: data.destination,
        expectedArrivalOn: data.expectedArrivalOn,
        notes: data.notes,
    };
}

async function writeShares(tx: DbOrTx, containerId: string, data: ContainerData, deliveredByTrader: Map<string, string | null> = new Map()) {
    await tx.delete(containerShares).where(eq(containerShares.containerId, containerId));
    await tx.insert(containerShares).values(
        data.shares.map((s, i) => ({
            containerId,
            traderId: s.traderId,
            shareValue: s.shareValue,
            goods: s.goods,
            cartons: s.cartons,
            weightKg: s.weightKg,
            deliveredOn: deliveredByTrader.get(s.traderId) ?? null,
            sortOrder: i,
        })),
    );
}

/** New container at "تم التأكيد" with its shares and the first history row (PRD §5.1, §5.2). */
export async function createContainer(tx: DbOrTx, input: ContainerInput, userId: string): Promise<{ id: string; containerNumber: string }> {
    const data = containerInputSchema.parse(input);
    await assertNumberFree(tx, data.containerNumber);
    const registeredOn = data.registeredOn ?? todayISO();
    // The form always sends the clearance company; callers that leave it out get the default from Settings.
    const companyPartyId = input.companyPartyId === undefined ? ((await getSettingsRow(tx)).defaultClearancePartyId ?? null) : data.companyPartyId;

    const [row] = await tx
        .insert(containers)
        .values({ ...containerValues(data), companyPartyId, status: "confirmed", registeredOn })
        .returning({ id: containers.id });
    await writeShares(tx, row.id, data);
    await tx.insert(containerStatusHistory).values({ containerId: row.id, fromStatus: null, toStatus: "confirmed", changedOn: registeredOn, userId });
    await audit(tx, { table: "containers", recordId: row.id, action: "create", after: { ...data, companyPartyId, registeredOn }, userId });
    return { id: row.id, containerNumber: data.containerNumber };
}

/** Edit everything except the status. Money already posted is never re-split silently (PRD §5.3, §8.5.6). */
export async function updateContainer(tx: DbOrTx, id: string, input: ContainerInput, userId: string): Promise<void> {
    const before = await lockContainer(tx, id);
    if (before.archivedAt) throw new DomainError("هذه الحاوية ملغاة ولا يمكن تعديلها");
    const data = containerInputSchema.parse(input);
    if (data.containerNumber !== before.containerNumber) await assertNumberFree(tx, data.containerNumber, id);

    const oldShares = await tx.select().from(containerShares).where(eq(containerShares.containerId, id));
    if (await activeChargeCount(tx, id)) {
        if (before.isShared && !data.isShared) {
            throw new DomainError("لا يمكن إلغاء المشاركة لأن على الحاوية مصاريف. أعد توزيع المصاريف أولاً", "isShared");
        }
        if (!before.isShared && (data.isShared || data.shares[0].traderId !== oldShares[0]?.traderId)) {
            throw new DomainError("على الحاوية مصاريف مسجلة على هذا التاجر. ألغِ المصاريف أولاً ثم غيّر التاجر", "shares.0.traderId");
        }
    }

    const idx = statusIndex(before.status);
    const registeredOn = data.registeredOn ?? before.registeredOn;
    const arrivedOn = idx >= statusIndex("arrived") ? (data.arrivedOn ?? before.arrivedOn) : null;
    const deliveredOn = idx >= statusIndex("delivered") ? (data.deliveredOn ?? before.deliveredOn) : null;

    await tx
        .update(containers)
        .set({ ...containerValues(data), registeredOn, arrivedOn, deliveredOn, updatedAt: new Date() })
        .where(eq(containers.id, id));
    await writeShares(tx, id, data, new Map(oldShares.map((s) => [s.traderId, s.deliveredOn])));
    await audit(tx, { table: "containers", recordId: id, action: "update", before: { ...before, shares: oldShares }, after: { ...data, registeredOn, arrivedOn, deliveredOn }, userId });
}

/** Forward (skips allowed), or backward with a reason (PRD §5.1). */
export async function changeStatus(tx: DbOrTx, id: string, input: StatusChangeInput, userId: string): Promise<void> {
    const { to, date, note } = statusChangeSchema.parse(input);
    const before = await lockContainer(tx, id);
    if (before.archivedAt) throw new DomainError("هذه الحاوية ملغاة");
    const plan = planStatusChange(before, to, date, note);

    await tx.insert(containerStatusHistory).values(
        plan.steps.map((s, i) => ({
            containerId: id,
            fromStatus: s.from,
            toStatus: s.to,
            changedOn: date,
            note: i === plan.steps.length - 1 ? note : null,
            isBackward: plan.isBackward,
            userId,
        })),
    );
    await tx
        .update(containers)
        .set({ status: to, ...plan.dates, statusChangedAt: sql`now()`, updatedAt: new Date() })
        .where(eq(containers.id, id));
    await audit(tx, { table: "containers", recordId: id, action: "status", before: { status: before.status }, after: { status: to, date, note, ...plan.dates }, userId });
}

/** "سُلّم للتاجر" tick on one share of a shared container. null clears it. */
export async function setShareDelivered(tx: DbOrTx, containerId: string, traderId: string, date: string | null, userId: string): Promise<void> {
    const rows = await tx
        .update(containerShares)
        .set({ deliveredOn: date })
        .where(and(eq(containerShares.containerId, containerId), eq(containerShares.traderId, traderId)))
        .returning({ id: containerShares.id });
    if (!rows.length) throw new DomainError(NOT_FOUND);
    await audit(tx, { table: "container_shares", recordId: rows[0].id, action: "update", after: { deliveredOn: date }, userId });
}

/** Cancel a container that has no active charges: archived, never deleted (PRD §8.6). */
export async function archiveContainer(tx: DbOrTx, id: string, userId: string): Promise<void> {
    const before = await lockContainer(tx, id);
    if (before.archivedAt) return;
    if (await activeChargeCount(tx, id)) throw new DomainError("لا يمكن إلغاء الحاوية وعليها مصاريف. ألغِ المصاريف أولاً");
    await tx.update(containers).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(containers.id, id));
    await audit(tx, { table: "containers", recordId: id, action: "archive", userId });
}
