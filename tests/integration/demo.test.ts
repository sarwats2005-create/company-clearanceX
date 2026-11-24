import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { demo } from "@/db/demo";
import { containerCharges, journalEntries, traders, users } from "@/db/schema";
import { seed } from "@/db/seed";
import { containerCounts } from "@/features/containers/queries";
import { hasValidCheckDigit } from "@/lib/container-number";
import { closeDb, resetDb } from "../helpers/db";

let ownerId: string;

beforeEach(async () => {
    await resetDb();
    await seed(db, { username: "owner", password: "owner-pass-123", name: "أبو علي" });
    ownerId = (await db.select().from(users))[0].id;
});
afterAll(closeDb);

describe("pnpm db:demo (PRD §12)", () => {
    it("adds 10 traders and 30 containers across every status, with charges and payments in both currencies", async () => {
        await demo(db, ownerId);

        expect(await db.$count(traders)).toBe(10);
        const c = await containerCounts(db);
        expect(c.all).toBe(30);
        for (const n of [c.confirmed, c.onTheWay, c.arrived, c.deliveredThisMonth, c.arrivedLate, c.onTheWayLate]) expect(n).toBeGreaterThan(0);

        const numbers = await db.execute<{ container_number: string; is_shared: boolean }>(sql`select container_number, is_shared from containers`);
        expect(numbers.rows.every((r) => hasValidCheckDigit(r.container_number))).toBe(true);
        expect(numbers.rows.some((r) => r.is_shared)).toBe(true);

        const chargeCurrencies = await db.selectDistinct({ c: containerCharges.currency }).from(containerCharges);
        expect(chargeCurrencies.map((x) => x.c).sort()).toEqual(["IQD", "USD"]);
        const receipts = await db.execute<{ prefix: string; currency: string }>(
            sql`select distinct left(receipt_no, 1) as prefix, currency from journal_entries where receipt_no is not null and type in ('receive_from_trader', 'pay_party')`,
        );
        expect(receipts.rows).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ prefix: "ق", currency: "USD" }),
                expect.objectContaining({ prefix: "ق", currency: "IQD" }),
                expect.objectContaining({ prefix: "ص" }),
            ]),
        );

        // Double entry still balances per currency.
        const off = await db.execute<{ currency: string; diff: string }>(
            sql`select a.currency, sum(l.debit - l.credit)::text as diff from journal_lines l join accounts a on a.id = l.account_id group by a.currency`,
        );
        for (const r of off.rows) expect(Number(r.diff)).toBe(0);
        expect(await db.$count(journalEntries)).toBeGreaterThan(30);
    });

    it("refuses to run on a database that already has containers", async () => {
        await demo(db, ownerId);
        await expect(demo(db, ownerId)).rejects.toThrow("يوجد بيانات");
    });
});
