import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, withTx } from "@/db";
import { containerCharges, containerShares, containerSizes, containerStatusHistory, containers, parties, shippingLines, traders, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { checkContainerNumber, getContainer, listContainers } from "@/features/containers/queries";
import * as svc from "@/features/containers/service";
import { postEntry } from "@/features/ledger/post-entry";
import * as postings from "@/features/ledger/postings";
import { createTrader } from "@/features/traders/service";
import { todayISO } from "@/lib/format";
import { closeDb, resetDb } from "../helpers/db";

let ownerId: string;
let msc: string;
let maersk: string;
let ahmed: string;
let haider: string;
let ali: string;
let size40: string;
let china: string;

beforeEach(async () => {
    await resetDb();
    await seed(db, { username: "owner", password: "owner-pass-123", name: "أبو علي" });
    ownerId = (await db.select().from(users))[0].id;
    const lines = await db.select().from(shippingLines).orderBy(asc(shippingLines.sortOrder));
    msc = lines[0].id;
    maersk = lines[1].id;
    [ahmed, haider, ali] = (await db.insert(traders).values([{ name: "أحمد كاظم" }, { name: "حيدر عبد الله" }, { name: "علي حسن" }]).returning()).map((t) => t.id);
    size40 = (await db.select().from(containerSizes).where(eq(containerSizes.code, "40ft")))[0].id;
    china = (await db.select().from(parties).where(eq(parties.name, "شركة التخليص - الصين")))[0].id;
});
afterAll(closeDb);

const basic = (over: Partial<svc.ContainerInput> = {}): svc.ContainerInput => ({
    containerNumber: "MSCU4829175",
    shippingLineId: msc,
    isShared: false,
    shares: [{ traderId: ahmed }],
    ...over,
});
const create = (input: svc.ContainerInput) => withTx((tx) => svc.createContainer(tx, input, ownerId));

describe("createContainer", () => {
    it("saves a container with only the 3 required fields", async () => {
        const { id, containerNumber } = await create(basic({ containerNumber: " mscu 482917-5 " }));
        expect(containerNumber).toBe("MSCU4829175");
        const [row] = await db.select().from(containers).where(eq(containers.id, id));
        expect(row.status).toBe("confirmed");
        expect(row.registeredOn).toBe(todayISO());
        expect(row.isShared).toBe(false);
        expect(row.splitUnit).toBeNull();
        expect(row.quantity).toBe(1);
        expect(row.companyPartyId).toBe(china); // default clearance company from Settings
        const shares = await db.select().from(containerShares).where(eq(containerShares.containerId, id));
        expect(shares).toHaveLength(1);
        expect(shares[0].traderId).toBe(ahmed);
        expect(shares[0].shareValue).toBeNull();
        const history = await db.select().from(containerStatusHistory).where(eq(containerStatusHistory.containerId, id));
        expect(history).toMatchObject([{ fromStatus: null, toStatus: "confirmed", changedOn: todayISO() }]);
    });

    it("normalizes before unique check", async () => {
        await create(basic());
        await expect(create(basic({ containerNumber: "mscu 482917-5" }))).rejects.toThrow("هذه الحاوية مسجلة مسبقاً");
        expect(await db.$count(containers)).toBe(1);
    });

    it("requires the container number, the shipping line and a trader", async () => {
        await expect(create(basic({ containerNumber: " - " }))).rejects.toThrow("هذا الحقل مطلوب");
        await expect(create(basic({ shippingLineId: "" }))).rejects.toThrow("اختر خط الشحن");
        await expect(create(basic({ shares: [] }))).rejects.toThrow("اختر التاجر");
        await expect(create(basic({ shares: [{ traderId: "" }] }))).rejects.toThrow("اختر التاجر");
    });

    it("keeps optional details, uppercases the B/L and accepts Arabic digits", async () => {
        const { id } = await create(
            basic({
                billOfLadingNumber: " cosu62341 ",
                containerSizeId: size40,
                quantity: "٢",
                shares: [{ traderId: ahmed, goods: "أجهزة كهربائية", cartons: "١٢٠", weightKg: "٤٬٥٠٠" }],
                registeredOn: "2026-11-01",
                expectedArrivalOn: "2026-11-20",
                notes: "  ملاحظة  ",
            }),
        );
        const c = await getContainer(db, id);
        expect(c?.billOfLadingNumber).toBe("COSU62341");
        expect(c?.quantity).toBe(2);
        expect(c?.registeredOn).toBe("2026-11-01");
        expect(c?.notes).toBe("ملاحظة");
        expect(c?.shares[0]).toMatchObject({ goods: "أجهزة كهربائية", cartons: 120, weightKg: "4500.00" });
    });

    it("saves shared shares in order", async () => {
        const { id } = await create(
            basic({
                isShared: true,
                splitUnit: "meters",
                containerSizeId: size40,
                shares: [
                    { traderId: ahmed, shareValue: "4", goods: "أجهزة" },
                    { traderId: haider, shareValue: "5.5", cartons: "30" },
                ],
            }),
        );
        const c = await getContainer(db, id);
        expect(c?.isShared).toBe(true);
        expect(c?.splitUnit).toBe("meters");
        expect(c?.shares.map((s) => [s.traderName, s.shareValue, s.sortOrder])).toEqual([
            ["أحمد كاظم", "4.000", 0],
            ["حيدر عبد الله", "5.500", 1],
        ]);
    });

    it("rejects shares that cannot be split", async () => {
        const shared = (shares: svc.ContainerInput["shares"], splitUnit: svc.ContainerInput["splitUnit"] = "meters") => create(basic({ isShared: true, splitUnit, shares }));
        await expect(shared([{ traderId: ahmed, shareValue: "4" }])).rejects.toThrow("أضف تاجراً ثانياً");
        await expect(shared([{ traderId: ahmed, shareValue: "4" }, { traderId: haider, shareValue: "0" }])).rejects.toThrow("الحصة يجب أن تكون أكبر من صفر");
        await expect(shared([{ traderId: ahmed, shareValue: "4" }, { traderId: haider, shareValue: "" }])).rejects.toThrow("الحصة يجب أن تكون أكبر من صفر");
        await expect(shared([{ traderId: ahmed, shareValue: "4" }, { traderId: ahmed, shareValue: "5" }])).rejects.toThrow("هذا التاجر مضاف مسبقاً");
        await expect(shared([{ traderId: ahmed, shareValue: "40" }, { traderId: haider, shareValue: "50" }], "percent")).rejects.toThrow("مجموع النسب يجب أن يساوي 100%");
        await expect(shared([{ traderId: ahmed }, { traderId: haider }], null)).rejects.toThrow("اختر وحدة التقسيم");
        // equal needs no numbers
        await expect(shared([{ traderId: ahmed }, { traderId: haider }], "equal")).resolves.toBeTruthy();
    });

    it("a normal container keeps only the first trader and no share value", async () => {
        const { id } = await create(basic({ splitUnit: "meters", shares: [{ traderId: ahmed, shareValue: "4" }] }));
        const c = await getContainer(db, id);
        expect(c?.splitUnit).toBeNull();
        expect(c?.shares).toHaveLength(1);
        expect(c?.shares[0].shareValue).toBeNull();
    });
});

describe("changeStatus", () => {
    it("records skipped steps with the same date and sets the arrival date", async () => {
        const { id } = await create(basic());
        await withTx((tx) => svc.changeStatus(tx, id, { to: "arrived", date: "2026-11-14" }, ownerId));
        const c = await getContainer(db, id);
        expect(c?.status).toBe("arrived");
        expect(c?.arrivedOn).toBe("2026-11-14");
        expect(c?.history.map((h) => [h.fromStatus, h.toStatus, h.changedOn])).toEqual([
            [null, "confirmed", todayISO()],
            ["confirmed", "on_the_way", "2026-11-14"],
            ["on_the_way", "arrived", "2026-11-14"],
        ]);
    });

    it("moving back needs a reason, is flagged, and clears the later dates", async () => {
        const { id } = await create(basic());
        await withTx((tx) => svc.changeStatus(tx, id, { to: "delivered", date: "2026-11-20" }, ownerId));
        await expect(withTx((tx) => svc.changeStatus(tx, id, { to: "on_the_way", date: "2026-11-21" }, ownerId))).rejects.toThrow("اكتب سبب الرجوع");
        await withTx((tx) => svc.changeStatus(tx, id, { to: "on_the_way", date: "2026-11-21", note: "أدخلت بالخطأ" }, ownerId));
        const c = await getContainer(db, id);
        expect(c?.status).toBe("on_the_way");
        expect(c?.arrivedOn).toBeNull();
        expect(c?.deliveredOn).toBeNull();
        expect(c?.history.at(-1)).toMatchObject({ fromStatus: "delivered", toStatus: "on_the_way", isBackward: true, note: "أدخلت بالخطأ", userName: "أبو علي" });
    });

    it("refuses an unknown container", async () => {
        await expect(withTx((tx) => svc.changeStatus(tx, "00000000-0000-4000-8000-000000000000", { to: "arrived", date: "2026-11-14" }, ownerId))).rejects.toThrow("لم نجد");
    });
});

/** A real charge entry on the container, as Task 7 will post it. */
async function addCharge(containerId: string) {
    const [type] = await db.query.chargeTypes.findMany({ limit: 1 });
    await withTx(async (tx) => {
        const { entryId } = await postEntry(tx, {
            type: "container_charge",
            date: "2026-11-10",
            description: "كمرك",
            containerId,
            lines: postings.containerCharge({ currency: "USD", amount: "100", allocations: [{ traderId: ahmed, amount: "100" }], payer: { kind: "party", partyId: china } }),
        });
        await tx.insert(containerCharges).values({ containerId, chargeTypeId: type.id, amount: "100", currency: "USD", paidByPartyId: china, journalEntryId: entryId });
    });
}

describe("updateContainer", () => {
    it("changes fields, keeps the per-trader delivered tick, and checks the new number", async () => {
        const { id } = await create(basic({ isShared: true, splitUnit: "equal", shares: [{ traderId: ahmed }, { traderId: haider }] }));
        await create(basic({ containerNumber: "TGHU1234567", shares: [{ traderId: ali }] }));
        await withTx((tx) => svc.setShareDelivered(tx, id, haider, "2026-11-22", ownerId));

        await expect(withTx((tx) => svc.updateContainer(tx, id, basic({ containerNumber: "tghu 123456-7", isShared: true, splitUnit: "equal", shares: [{ traderId: ahmed }, { traderId: haider }] }), ownerId))).rejects.toThrow(
            "هذه الحاوية مسجلة مسبقاً",
        );
        await withTx((tx) =>
            svc.updateContainer(tx, id, basic({ containerNumber: "MSCU4829176", shippingLineId: maersk, isShared: true, splitUnit: "equal", shares: [{ traderId: haider }, { traderId: ahmed }, { traderId: ali }] }), ownerId),
        );
        const c = await getContainer(db, id);
        expect(c?.containerNumber).toBe("MSCU4829176");
        expect(c?.shippingLineName).toBe("Maersk");
        expect(c?.shares.map((s) => [s.traderName, s.deliveredOn])).toEqual([
            ["حيدر عبد الله", "2026-11-22"],
            ["أحمد كاظم", null],
            ["علي حسن", null],
        ]);
    });

    it("blocks turning off 'shared' while the container has charges", async () => {
        const { id } = await create(basic({ isShared: true, splitUnit: "equal", shares: [{ traderId: ahmed }, { traderId: haider }] }));
        await addCharge(id);
        await expect(withTx((tx) => svc.updateContainer(tx, id, basic({ shares: [{ traderId: ahmed }] }), ownerId))).rejects.toThrow("أعد توزيع المصاريف");
    });

    it("blocks changing the trader of a normal container that has charges", async () => {
        const { id } = await create(basic());
        await addCharge(id);
        await expect(withTx((tx) => svc.updateContainer(tx, id, basic({ shares: [{ traderId: haider }] }), ownerId))).rejects.toThrow("المصاريف");
        await expect(withTx((tx) => svc.updateContainer(tx, id, basic({ notes: "تعديل" }), ownerId))).resolves.toBeUndefined();
    });
});

describe("archiveContainer", () => {
    it("archives a container with no charges and hides it from the list", async () => {
        const { id } = await create(basic());
        await withTx((tx) => svc.archiveContainer(tx, id, ownerId));
        expect((await listContainers(db, {})).total).toBe(0);
        const [row] = await db.select().from(containers).where(eq(containers.id, id));
        expect(row.archivedAt).not.toBeNull();
    });

    it("refuses while there are active charges", async () => {
        const { id } = await create(basic());
        await addCharge(id);
        await expect(withTx((tx) => svc.archiveContainer(tx, id, ownerId))).rejects.toThrow("المصاريف");
    });
});

describe("queries", () => {
    it("checks a number while typing", async () => {
        const { id } = await create(basic());
        expect(await checkContainerNumber(db, "mscu-4829175")).toEqual({ normalized: "MSCU4829175", existingId: id, isUsualFormat: true });
        expect(await checkContainerNumber(db, "mscu-4829175", id)).toEqual({ normalized: "MSCU4829175", existingId: null, isUsualFormat: true });
        expect(await checkContainerNumber(db, "abc12")).toEqual({ normalized: "ABC12", existingId: null, isUsualFormat: false });
    });

    it("lists and filters containers", async () => {
        const a = await create(basic());
        const b = await create(basic({ containerNumber: "TGHU1234567", shippingLineId: maersk, isShared: true, splitUnit: "equal", shares: [{ traderId: haider }, { traderId: ahmed }] }));
        const c = await create(basic({ containerNumber: "CMAU7654321", shares: [{ traderId: ali }], expectedArrivalOn: "2020-01-01" }));
        await withTx((tx) => svc.changeStatus(tx, a.id, { to: "arrived", date: "2020-01-01" }, ownerId));
        await withTx((tx) => svc.changeStatus(tx, c.id, { to: "on_the_way", date: "2020-01-01" }, ownerId));

        const all = await listContainers(db, {});
        expect(all.total).toBe(3);
        expect(all.rows.find((r) => r.id === b.id)?.traderNames).toEqual(["حيدر عبد الله", "أحمد كاظم"]);

        expect((await listContainers(db, { q: "4829" })).rows.map((r) => r.id)).toEqual([a.id]);
        expect((await listContainers(db, { q: "tghu" })).rows.map((r) => r.id)).toEqual([b.id]);
        expect((await listContainers(db, { statuses: ["arrived"] })).rows.map((r) => r.id)).toEqual([a.id]);
        expect((await listContainers(db, { traderId: ahmed })).total).toBe(2);
        expect((await listContainers(db, { shippingLineId: maersk })).rows.map((r) => r.id)).toEqual([b.id]);

        const late = await listContainers(db, { lateOnly: true });
        expect(late.rows.map((r) => r.id).sort()).toEqual([a.id, c.id].sort());
        const lateRow = late.rows.find((r) => r.id === a.id);
        expect(lateRow?.isLate).toBe(true);
        expect(lateRow?.statusSince).toBe("2020-01-01");

        const page = await listContainers(db, { sort: "number", dir: "asc", pageSize: 2, page: 1 });
        expect(page.rows.map((r) => r.containerNumber)).toEqual(["CMAU7654321", "MSCU4829175"]);
        expect(page.total).toBe(3);
    });
});

describe("createTrader", () => {
    it("adds a trader and refuses the same name twice", async () => {
        const id = await withTx((tx) => createTrader(tx, { name: "  كريم جواد ", phone: "0770 123 4567" }, ownerId));
        const [row] = await db.select().from(traders).where(eq(traders.id, id));
        expect(row.name).toBe("كريم جواد");
        await expect(withTx((tx) => createTrader(tx, { name: "كريم جواد" }, ownerId))).rejects.toThrow("هذا التاجر موجود مسبقاً");
    });
});
