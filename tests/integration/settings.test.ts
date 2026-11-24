import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, withTx } from "@/db";
import { chargeTypeDefaults, chargeTypes, containerSizes, parties, receiptSequences, shippingLines, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { nextReceiptNo } from "@/features/ledger/receipt-numbers";
import * as settings from "@/features/settings/service";
import { verifyPassword } from "@/lib/password";
import { closeDb, resetDb } from "../helpers/db";

let ownerId: string;
beforeEach(async () => {
    await resetDb();
    await seed(db, { username: "owner", password: "owner-pass-123", name: "أبو علي" });
    ownerId = (await db.select().from(users))[0].id;
});
afterAll(closeDb);

describe("simple lists", () => {
    it("adds, renames and reorders shipping lines", async () => {
        const id = await withTx((tx) => settings.saveSimpleItem(tx, "shipping_lines", { name: "  PIL  " }, ownerId));
        await withTx((tx) => settings.saveSimpleItem(tx, "shipping_lines", { id, name: "PIL Line" }, ownerId));
        const [row] = await db.select().from(shippingLines).where(eq(shippingLines.id, id));
        expect(row.name).toBe("PIL Line");
        expect(row.sortOrder).toBe(10);

        const before = await db.select().from(shippingLines).orderBy(asc(shippingLines.sortOrder));
        await withTx((tx) => settings.moveItem(tx, "shipping_lines", before[1].id, "up"));
        const after = await db.select().from(shippingLines).orderBy(asc(shippingLines.sortOrder));
        expect(after[0].id).toBe(before[1].id);
        expect(after[1].id).toBe(before[0].id);
    });

    it("refuses a blank name", async () => {
        await expect(withTx((tx) => settings.saveSimpleItem(tx, "ports_of_loading", { name: "   " }, ownerId))).rejects.toThrow("هذا الحقل مطلوب");
    });

    it("deactivates instead of deleting", async () => {
        const [line] = await db.select().from(shippingLines).limit(1);
        await withTx((tx) => settings.setItemActive(tx, "shipping_lines", line.id, false, ownerId));
        const [row] = await db.select().from(shippingLines).where(eq(shippingLines.id, line.id));
        expect(row.isActive).toBe(false);
    });
});

describe("parties", () => {
    it("never deactivates our own company (شركتنا)", async () => {
        const [self] = await db.select().from(parties).where(eq(parties.kind, "self"));
        await expect(withTx((tx) => settings.setItemActive(tx, "parties", self.id, false, ownerId))).rejects.toThrow();
    });
    it("saves a new party and can make it the default clearance company", async () => {
        const id = await withTx((tx) => settings.saveParty(tx, { name: "مكتب بغداد", kind: "other", phone: "07701234567", notes: "", isActive: true, isDefaultCompany: true }, ownerId));
        const s = await settings.getSettingsRow(db);
        expect(s.defaultClearancePartyId).toBe(id);
    });
});

describe("charge types", () => {
    it("saves default amounts per container size", async () => {
        const sizes = await db.select().from(containerSizes).orderBy(asc(containerSizes.sortOrder));
        const [customs] = await db.select().from(chargeTypes).where(eq(chargeTypes.name, "كمرك بصرة"));
        await withTx((tx) =>
            settings.saveChargeType(
                tx,
                {
                    id: customs.id,
                    name: "كمرك بصرة",
                    defaultCurrency: "USD",
                    defaultPartyId: customs.defaultPartyId,
                    isFee: false,
                    isActive: true,
                    defaults: { [sizes[0].id]: "1,500", [sizes[1].id]: "2000", [sizes[2].id]: "" },
                },
                ownerId,
            ),
        );
        const rows = await db.select().from(chargeTypeDefaults).where(eq(chargeTypeDefaults.chargeTypeId, customs.id));
        expect(rows.map((r) => r.amount).sort()).toEqual(["1500.00", "2000.00"]);
    });
    it("a fee type has no paying party", async () => {
        const id = await withTx((tx) =>
            settings.saveChargeType(tx, { name: "أتعاب تخليص", defaultCurrency: "IQD", defaultPartyId: null, isFee: true, isActive: true, defaults: {} }, ownerId),
        );
        const [row] = await db.select().from(chargeTypes).where(eq(chargeTypes.id, id));
        expect(row.isFee).toBe(true);
        expect(row.defaultPartyId).toBeNull();
        expect(row.sortOrder).toBe(7);
    });
});

describe("receipt numbers", () => {
    it("lets the next number move up but never down or below a used number", async () => {
        await withTx((tx) => nextReceiptNo(tx, "in")); // ق-000001 used
        await expect(withTx((tx) => settings.updateReceiptSequence(tx, "in", { prefix: "ق", nextNumber: 1 }, ownerId))).rejects.toThrow();
        await withTx((tx) => settings.updateReceiptSequence(tx, "in", { prefix: "ق", nextNumber: 124 }, ownerId));
        expect(await withTx((tx) => nextReceiptNo(tx, "in"))).toBe("ق-000124");
        await expect(withTx((tx) => settings.updateReceiptSequence(tx, "in", { prefix: "ق", nextNumber: 100 }, ownerId))).rejects.toThrow();
    });
    it("changes the prefix", async () => {
        await withTx((tx) => settings.updateReceiptSequence(tx, "out", { prefix: "صرف", nextNumber: 1 }, ownerId));
        const [row] = await db.select().from(receiptSequences).where(eq(receiptSequences.kind, "out"));
        expect(row.prefix).toBe("صرف");
    });
});

describe("company, rate and password", () => {
    it("updates the rate and stamps when it changed", async () => {
        await withTx((tx) => settings.updateCurrencyAndAlerts(tx, { defaultUsdIqdRate: "1,320", arrivedWarningDays: 10 }, ownerId));
        const s = await settings.getSettingsRow(db);
        expect(s.defaultUsdIqdRate).toBe("1320.0000");
        expect(s.arrivedWarningDays).toBe(10);
        expect(s.rateUpdatedAt).not.toBeNull();
    });
    it("changes the password only with the right current password", async () => {
        await expect(withTx((tx) => settings.changePassword(tx, ownerId, "wrong", "new-pass-456"))).rejects.toThrow("كلمة المرور الحالية غير صحيحة");
        await expect(withTx((tx) => settings.changePassword(tx, ownerId, "owner-pass-123", "short"))).rejects.toThrow();
        await withTx((tx) => settings.changePassword(tx, ownerId, "owner-pass-123", "new-pass-456"));
        const [u] = await db.select().from(users);
        expect(await verifyPassword("new-pass-456", u.passwordHash)).toBe(true);
    });
});
