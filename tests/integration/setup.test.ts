import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { shippingLines, users } from "@/db/schema";
import { setupDatabase } from "../../scripts/setup";
import { closeDb, resetDb } from "../helpers/db";

const url = process.env.DATABASE_URL!;
const owner = { username: "owner", password: "Basra-docks-2026", name: "أبو علي" };

beforeEach(resetDb);
afterAll(closeDb);

describe("pnpm db:setup (runs before every deploy)", () => {
    it("sets up an empty database once, then leaves the owner's own changes alone", async () => {
        expect(await setupDatabase(url, owner, false)).toEqual({ seeded: true });
        const lines = await db.select().from(shippingLines);
        expect(lines.length).toBeGreaterThan(0);
        expect(await db.select({ username: users.username }).from(users)).toEqual([{ username: "owner" }]);

        await db.update(shippingLines).set({ name: "MSC Iraq" }).where(eq(shippingLines.id, lines[0].id)); // the owner renames one
        expect(await setupDatabase(url, { ...owner, username: "someone-else" }, false)).toEqual({ seeded: false });
        expect(await db.select().from(shippingLines)).toHaveLength(lines.length); // the old name did not come back
        expect(await db.select().from(users)).toHaveLength(1);
    });

    it("refuses to set up an empty database without an owner login", async () => {
        await expect(setupDatabase(url, { username: "", password: "", name: "" }, false)).rejects.toThrow("OWNER_USERNAME");
        await expect(setupDatabase(url, { username: "owner", password: "short", name: "" }, false)).rejects.toThrow("OWNER_PASSWORD");
        expect(await db.select().from(users)).toHaveLength(0);
    });
});
