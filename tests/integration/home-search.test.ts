import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, withTx } from "@/db";
import { containers, parties, shippingLines, traders, users, vaults } from "@/db/schema";
import { seed } from "@/db/seed";
import { containerCounts, listContainers } from "@/features/containers/queries";
import * as containersSvc from "@/features/containers/service";
import * as money from "@/features/money/service";
import { globalSearch } from "@/features/search/queries";
import { todayISO } from "@/lib/format";
import { closeDb, resetDb } from "../helpers/db";

let ownerId: string;
let ahmed: string;
let msc: string;
let usd: string;
let china: string;

const daysAgo = (n: number) => {
    const d = new Date(`${todayISO()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
};
const monthStart = () => `${todayISO().slice(0, 7)}-01`;

beforeEach(async () => {
    await resetDb();
    await seed(db, { username: "owner", password: "owner-pass-123", name: "أبو علي" });
    ownerId = (await db.select().from(users))[0].id;
    [ahmed] = (
        await db
            .insert(traders)
            .values([{ name: "أحمد كاظم", phone: "07701234567" }, { name: "حيدر عبد الله" }])
            .returning()
    ).map((t) => t.id);
    msc = (await db.select().from(shippingLines).orderBy(asc(shippingLines.sortOrder)))[0].id;
    usd = (await db.select().from(vaults).where(eq(vaults.kind, "usd")))[0].id;
    china = (await db.select().from(parties).where(eq(parties.name, "شركة التخليص - الصين")))[0].id;
});
afterAll(closeDb);

const make = async (containerNumber: string, set: Partial<typeof containers.$inferInsert> = {}, extra: Partial<containersSvc.ContainerInput> = {}) => {
    const { id } = await withTx((tx) =>
        containersSvc.createContainer(tx, { containerNumber, shippingLineId: msc, isShared: false, shares: [{ traderId: ahmed }], ...extra }, ownerId),
    );
    if (Object.keys(set).length) await db.update(containers).set(set).where(eq(containers.id, id));
    return id;
};

describe("home: counts per status (PRD §8.3)", () => {
    it("counts each status, delivered this month only, the late ones, and skips cancelled containers", async () => {
        await make("MSCU4829175");
        await make("MSCU1234565");
        await make("TGHU1111111", { status: "on_the_way", expectedArrivalOn: daysAgo(2) }); // late on the way
        await make("TGHU2222222", { status: "on_the_way", expectedArrivalOn: todayISO() });
        await make("TGHU3333333", { status: "arrived", arrivedOn: daysAgo(10) }); // late in Umm Qasr (7 days default)
        await make("TGHU4444444", { status: "arrived", arrivedOn: daysAgo(1) });
        await make("TGHU5555555", { status: "delivered", arrivedOn: monthStart(), deliveredOn: monthStart() });
        await make("TGHU6666666", { status: "delivered", arrivedOn: daysAgo(60), deliveredOn: daysAgo(40) });
        await make("TGHU7777777", { archivedAt: new Date() });

        const c = await containerCounts(db);
        expect(c).toMatchObject({ confirmed: 2, onTheWay: 2, arrived: 2, deliveredThisMonth: 1, arrivedLate: 1, onTheWayLate: 1, warningDays: 7 });
    });

    it("lists current containers: not delivered, plus delivered in the last 7 days", async () => {
        await make("MSCU4829175");
        await make("TGHU5555555", { status: "delivered", deliveredOn: daysAgo(3) });
        await make("TGHU6666666", { status: "delivered", deliveredOn: daysAgo(8) });
        const { rows, total } = await listContainers(db, { current: true });
        expect(rows.map((r) => r.containerNumber).sort()).toEqual(["MSCU4829175", "TGHU5555555"]);
        expect(total).toBe(2);
        expect((await listContainers(db, { current: true, statuses: ["delivered"] })).rows.map((r) => r.containerNumber)).toEqual(["TGHU5555555"]);
    });

    it('lists the containers delivered since a date (the home "delivered this month" figure)', async () => {
        await make("MSCU4829175");
        await make("TGHU5555555", { status: "delivered", arrivedOn: monthStart(), deliveredOn: monthStart() });
        await make("TGHU6666666", { status: "delivered", arrivedOn: daysAgo(60), deliveredOn: daysAgo(40) });
        const { rows } = await listContainers(db, { statuses: ["delivered"], deliveredFrom: monthStart() });
        expect(rows.map((r) => r.containerNumber)).toEqual(["TGHU5555555"]);
    });
});

describe("globalSearch (PRD §8.2)", () => {
    beforeEach(async () => {
        await make("MSCU4829175", {}, { billOfLadingNumber: "MEDU1234567" });
        await make("TGHU7777777", { archivedAt: new Date() });
        await withTx((tx) =>
            money.postMoney(tx, { kind: "receive_trader", date: todayISO(), traderId: ahmed, vaultId: usd, amount: "100", currency: "USD" }, ownerId),
        );
        await withTx((tx) =>
            money.postMoney(
                tx,
                { kind: "pay_party", date: todayISO(), partyId: china, vaultId: usd, amount: "50", currency: "USD", allowNegative: true },
                ownerId,
            ),
        );
    });

    it("finds a container by part of its number, typed loosely, or by its B/L", async () => {
        expect((await globalSearch(db, "4829")).containers.map((c) => c.containerNumber)).toEqual(["MSCU4829175"]);
        expect((await globalSearch(db, "mscu 482-9")).containers.map((c) => c.containerNumber)).toEqual(["MSCU4829175"]);
        const byBl = await globalSearch(db, "medu12");
        expect(byBl.containers[0]).toMatchObject({ containerNumber: "MSCU4829175", status: "confirmed", traderNames: ["أحمد كاظم"] });
        expect((await globalSearch(db, "7777")).containers).toEqual([]); // cancelled container
    });

    it("finds traders by name (ignoring hamza) or phone, and parties except our company", async () => {
        expect((await globalSearch(db, "احمد")).traders.map((t) => t.name)).toEqual(["أحمد كاظم"]);
        expect((await globalSearch(db, "0770123")).traders.map((t) => t.name)).toEqual(["أحمد كاظم"]);
        expect((await globalSearch(db, "الصين")).parties.map((p) => p.name)).toEqual(["شركة التخليص - الصين"]);
        expect((await globalSearch(db, "شركتنا")).parties).toEqual([]);
    });

    it("finds receipts by ق-1 or just 1", async () => {
        expect((await globalSearch(db, "ق-1")).receipts.map((r) => r.receiptNo)).toEqual(["ق-000001"]);
        expect((await globalSearch(db, "1")).receipts.map((r) => r.receiptNo).sort()).toEqual(["ص-000001", "ق-000001"]);
        expect((await globalSearch(db, "ص1")).receipts[0]).toMatchObject({ receiptNo: "ص-000001", amount: "50.00", currency: "USD" });
    });

    it("returns nothing for an empty or one-letter query", async () => {
        const empty = { containers: [], traders: [], parties: [], receipts: [] };
        expect(await globalSearch(db, "  ")).toEqual(empty);
        expect(await globalSearch(db, "ا")).toEqual(empty);
    });
});
