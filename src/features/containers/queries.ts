import "server-only";
import { type SQL, and, asc, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import {
    type ContainerStatus,
    type Currency,
    containerSizes,
    containerShares,
    containerStatusHistory,
    containers,
    parties,
    portsOfLoading,
    shippingLines,
    traders,
    users,
} from "@/db/schema";
import { getSettingsRow } from "@/features/settings/service";
import { isIso6346, normalizeContainerNumber } from "@/lib/container-number";
import { daysBetween, todayISO } from "@/lib/format";
import { activeChargeCount } from "./service";

export type ContainerSort = "number" | "trader" | "status" | "registered" | "arrived";

export interface ContainerFilters {
    q?: string;
    statuses?: ContainerStatus[];
    traderId?: string;
    shippingLineId?: string;
    /** registration date range, yyyy-mm-dd */
    from?: string;
    to?: string;
    lateOnly?: boolean;
    sort?: ContainerSort;
    dir?: "asc" | "desc";
    /** 1-based */
    page?: number;
    pageSize?: number;
}

export interface ContainerRow {
    id: string;
    containerNumber: string;
    status: ContainerStatus;
    isShared: boolean;
    registeredOn: string;
    expectedArrivalOn: string | null;
    arrivedOn: string | null;
    deliveredOn: string | null;
    shippingLineName: string;
    billOfLadingNumber: string | null;
    traderNames: string[];
    goods: string | null;
    statusSince: string;
    daysInStatus: number;
    isLate: boolean;
    totals: Partial<Record<Currency, string>>;
}

const traderNamesSql = sql<string[]>`coalesce((select array_agg(t.name order by s.sort_order) from ${containerShares} s join ${traders} t on t.id = s.trader_id where s.container_id = ${containers.id}), '{}')`;
const firstTraderSql = sql<string>`(select t.name from ${containerShares} s join ${traders} t on t.id = s.trader_id where s.container_id = ${containers.id} order by s.sort_order limit 1)`;
const goodsSql = sql<string | null>`(select s.goods from ${containerShares} s where s.container_id = ${containers.id} and s.goods is not null order by s.sort_order limit 1)`;
const statusSinceSql = sql<string>`coalesce((select h.changed_on from ${containerStatusHistory} h where h.container_id = ${containers.id} order by h.created_at desc, h.to_status desc limit 1), ${containers.registeredOn})`;
const totalsSql = sql<Partial<Record<Currency, string>> | null>`(select json_object_agg(x.currency, x.total) from (select c2.currency, sum(c2.amount)::text as total from container_charges c2 where c2.container_id = ${containers.id} and c2.cancelled_at is null group by c2.currency) x)`;

/** Arrived and waiting more than N days, or on the way past the expected arrival (PRD §8.3). */
function lateSql(today: string, warningDays: number) {
    return sql<boolean>`((${containers.status} = 'arrived' and ${containers.arrivedOn} < (${today}::date - ${warningDays}::int)) or (${containers.status} = 'on_the_way' and ${containers.expectedArrivalOn} < ${today}::date))`;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listContainers(db: DbOrTx, f: ContainerFilters): Promise<{ rows: ContainerRow[]; total: number; page: number; pageSize: number }> {
    const today = todayISO();
    const settings = await getSettingsRow(db);
    const late = lateSql(today, settings.arrivedWarningDays);
    const pageSize = Math.min(Math.max(f.pageSize ?? 25, 1), 200);
    const page = Math.max(f.page ?? 1, 1);

    const where: (SQL | undefined)[] = [isNull(containers.archivedAt)];
    if (f.statuses?.length) where.push(sql`${containers.status} in (${sql.join(f.statuses.map((s) => sql`${s}`), sql`, `)})`);
    if (f.traderId) where.push(sql`exists (select 1 from ${containerShares} s where s.container_id = ${containers.id} and s.trader_id = ${f.traderId})`);
    if (f.shippingLineId) where.push(eq(containers.shippingLineId, f.shippingLineId));
    if (f.from) where.push(gte(containers.registeredOn, f.from));
    if (f.to) where.push(lte(containers.registeredOn, f.to));
    if (f.lateOnly) where.push(late);
    const q = f.q?.trim();
    if (q) {
        const number = escapeLike(normalizeContainerNumber(q));
        const text = `%${escapeLike(q)}%`;
        where.push(
            or(
                number ? sql`${containers.containerNumber} like ${`%${number}%`}` : undefined,
                number ? sql`upper(${containers.billOfLadingNumber}) like ${`%${number}%`}` : undefined,
                sql`exists (select 1 from ${containerShares} s join ${traders} t on t.id = s.trader_id where s.container_id = ${containers.id} and t.name ilike ${text})`,
            ),
        );
    }
    const condition = and(...where);

    const dirFn = f.dir === "asc" ? asc : desc;
    const order: SQL[] = (() => {
        switch (f.sort) {
            case "number":
                return [dirFn(containers.containerNumber)];
            case "trader":
                return [dirFn(firstTraderSql), desc(containers.createdAt)];
            case "status":
                return [dirFn(containers.status), desc(containers.createdAt)];
            case "arrived":
                return [f.dir === "asc" ? sql`${containers.arrivedOn} asc nulls last` : sql`${containers.arrivedOn} desc nulls last`, desc(containers.createdAt)];
            default:
                return [dirFn(containers.registeredOn), dirFn(containers.createdAt)];
        }
    })();

    const [rows, [{ n }]] = await Promise.all([
        db
            .select({
                id: containers.id,
                containerNumber: containers.containerNumber,
                status: containers.status,
                isShared: containers.isShared,
                registeredOn: containers.registeredOn,
                expectedArrivalOn: containers.expectedArrivalOn,
                arrivedOn: containers.arrivedOn,
                deliveredOn: containers.deliveredOn,
                billOfLadingNumber: containers.billOfLadingNumber,
                shippingLineName: shippingLines.name,
                traderNames: traderNamesSql,
                goods: goodsSql,
                statusSince: statusSinceSql,
                isLate: late,
                totals: totalsSql,
            })
            .from(containers)
            .innerJoin(shippingLines, eq(shippingLines.id, containers.shippingLineId))
            .where(condition)
            .orderBy(...order)
            .limit(pageSize)
            .offset((page - 1) * pageSize),
        db.select({ n: sql<number>`count(*)::int` }).from(containers).where(condition),
    ]);

    return {
        rows: rows.map((r) => ({
            ...r,
            statusSince: String(r.statusSince),
            daysInStatus: Math.max(daysBetween(String(r.statusSince), today), 0),
            isLate: Boolean(r.isLate),
            totals: r.totals ?? {},
        })),
        total: Number(n),
        page,
        pageSize,
    };
}

/** Counts for the home metric cards and the late alerts. */
export async function containerCounts(db: DbOrTx) {
    const today = todayISO();
    const settings = await getSettingsRow(db);
    const monthStart = `${today.slice(0, 7)}-01`;
    const [row] = await db
        .select({
            confirmed: sql<number>`count(*) filter (where ${containers.status} = 'confirmed')::int`,
            onTheWay: sql<number>`count(*) filter (where ${containers.status} = 'on_the_way')::int`,
            arrived: sql<number>`count(*) filter (where ${containers.status} = 'arrived')::int`,
            deliveredThisMonth: sql<number>`count(*) filter (where ${containers.status} = 'delivered' and ${containers.deliveredOn} >= ${monthStart}::date)::int`,
            arrivedLate: sql<number>`count(*) filter (where ${containers.status} = 'arrived' and ${containers.arrivedOn} < (${today}::date - ${settings.arrivedWarningDays}::int))::int`,
            onTheWayLate: sql<number>`count(*) filter (where ${containers.status} = 'on_the_way' and ${containers.expectedArrivalOn} < ${today}::date)::int`,
            all: sql<number>`count(*)::int`,
        })
        .from(containers)
        .where(isNull(containers.archivedAt));
    return { ...row, warningDays: settings.arrivedWarningDays };
}

export async function getContainer(db: DbOrTx, id: string) {
    const [c] = await db
        .select({
            container: containers,
            shippingLineName: shippingLines.name,
            portName: portsOfLoading.name,
            sizeLabel: containerSizes.label,
            sizeLengthM: containerSizes.lengthM,
            sizeVolumeM3: containerSizes.volumeM3,
            companyPartyName: parties.name,
        })
        .from(containers)
        .innerJoin(shippingLines, eq(shippingLines.id, containers.shippingLineId))
        .leftJoin(portsOfLoading, eq(portsOfLoading.id, containers.portOfLoadingId))
        .leftJoin(containerSizes, eq(containerSizes.id, containers.containerSizeId))
        .leftJoin(parties, eq(parties.id, containers.companyPartyId))
        .where(eq(containers.id, id));
    if (!c) return null;

    const [shares, history, activeCharges] = await Promise.all([
        db
            .select({
                id: containerShares.id,
                traderId: containerShares.traderId,
                traderName: traders.name,
                shareValue: containerShares.shareValue,
                goods: containerShares.goods,
                cartons: containerShares.cartons,
                weightKg: containerShares.weightKg,
                deliveredOn: containerShares.deliveredOn,
                sortOrder: containerShares.sortOrder,
            })
            .from(containerShares)
            .innerJoin(traders, eq(traders.id, containerShares.traderId))
            .where(eq(containerShares.containerId, id))
            .orderBy(asc(containerShares.sortOrder)),
        db
            .select({
                id: containerStatusHistory.id,
                fromStatus: containerStatusHistory.fromStatus,
                toStatus: containerStatusHistory.toStatus,
                changedOn: containerStatusHistory.changedOn,
                note: containerStatusHistory.note,
                isBackward: containerStatusHistory.isBackward,
                userName: users.name,
                createdAt: containerStatusHistory.createdAt,
            })
            .from(containerStatusHistory)
            .leftJoin(users, eq(users.id, containerStatusHistory.userId))
            .where(eq(containerStatusHistory.containerId, id))
            .orderBy(asc(containerStatusHistory.createdAt), asc(containerStatusHistory.toStatus)),
        activeChargeCount(db, id),
    ]);

    return {
        ...c.container,
        shippingLineName: c.shippingLineName,
        portName: c.portName,
        sizeLabel: c.sizeLabel,
        size: c.container.containerSizeId ? { lengthM: c.sizeLengthM, volumeM3: c.sizeVolumeM3 } : null,
        companyPartyName: c.companyPartyName,
        shares,
        history,
        activeCharges,
    };
}
export type ContainerDetail = NonNullable<Awaited<ReturnType<typeof getContainer>>>;

/** Live check while typing (PRD §5.2): normalized number, the existing container (if any), and the usual-format hint. */
export async function checkContainerNumber(db: DbOrTx, raw: string, exceptId?: string) {
    const normalized = normalizeContainerNumber(raw);
    let existingId: string | null = null;
    if (normalized) {
        const [hit] = await db.select({ id: containers.id }).from(containers).where(eq(containers.containerNumber, normalized));
        existingId = hit && hit.id !== exceptId ? hit.id : null;
    }
    return { normalized, existingId, isUsualFormat: isIso6346(normalized) };
}

/** Everything the container form needs to render its pickers (PRD §8.5). */
export async function getContainerFormOptions(db: DbOrTx) {
    const [lines, ports, sizes, partyRows, traderRows, settings, [last], goods, destinations] = await Promise.all([
        db.select({ id: shippingLines.id, name: shippingLines.name, isActive: shippingLines.isActive }).from(shippingLines).orderBy(asc(shippingLines.sortOrder), asc(shippingLines.name)),
        db.select({ id: portsOfLoading.id, name: portsOfLoading.name, country: portsOfLoading.country, isActive: portsOfLoading.isActive }).from(portsOfLoading).orderBy(asc(portsOfLoading.sortOrder), asc(portsOfLoading.name)),
        db
            .select({ id: containerSizes.id, label: containerSizes.label, lengthM: containerSizes.lengthM, volumeM3: containerSizes.volumeM3, isActive: containerSizes.isActive })
            .from(containerSizes)
            .orderBy(asc(containerSizes.sortOrder)),
        db.select({ id: parties.id, name: parties.name, kind: parties.kind, isActive: parties.isActive }).from(parties).orderBy(asc(parties.createdAt)),
        db.select({ id: traders.id, name: traders.name, phone: traders.phone }).from(traders).where(eq(traders.isActive, true)).orderBy(asc(traders.name)),
        getSettingsRow(db),
        db.select({ shippingLineId: containers.shippingLineId, portOfLoadingId: containers.portOfLoadingId }).from(containers).orderBy(desc(containers.createdAt)).limit(1),
        db.execute<{ v: string }>(sql`select goods as v from ${containerShares} where goods is not null group by goods order by count(*) desc, goods limit 50`),
        db.execute<{ v: string }>(sql`select destination as v from ${containers} where destination is not null group by destination order by count(*) desc, destination limit 50`),
    ]);
    return {
        shippingLines: lines,
        ports,
        sizes,
        parties: partyRows.filter((p) => p.kind !== "self"),
        traders: traderRows,
        defaults: {
            companyPartyId: settings.defaultClearancePartyId,
            shippingLineId: last?.shippingLineId ?? null,
            portOfLoadingId: last?.portOfLoadingId ?? null,
        },
        suggestions: { goods: goods.rows.map((r) => r.v), destinations: destinations.rows.map((r) => r.v) },
    };
}
export type ContainerFormOptions = Awaited<ReturnType<typeof getContainerFormOptions>>;
