import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { seed } from "@/db/seed";
import { closeDb, resetDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(closeDb);

const TABLES = ["users", "parties", "vaults", "charge_types", "container_sizes", "ports_of_loading", "shipping_lines", "expense_categories", "receipt_sequences", "company_settings"];

async function counts() {
    const out: Record<string, number> = {};
    for (const t of TABLES) {
        const r = await db.execute<{ n: string }>(sql.raw(`SELECT count(*)::text AS n FROM ${t}`));
        out[t] = Number(r.rows[0].n);
    }
    return out;
}

const owner = { username: "owner", password: "owner-pass-123", name: "أبو علي" };

describe("seed", () => {
    it("creates the reference data from PRD §12.4", async () => {
        await seed(db, owner);
        expect(await counts()).toEqual({
            users: 1,
            parties: 3,
            vaults: 3,
            charge_types: 7,
            container_sizes: 4,
            ports_of_loading: 9,
            shipping_lines: 10,
            expense_categories: 5,
            receipt_sequences: 4,
            company_settings: 1,
        });
        const types = await db.execute<{ name: string; is_fee: boolean }>(sql`SELECT name, is_fee FROM charge_types ORDER BY sort_order`);
        expect(types.rows.map((r) => r.name)).toEqual(["كمرك بصرة", "غرامة شركة الشحن", "غرامة ميناء", "أجور نقل بحري", "أتعاب شركة", "أجور نقل الجوي", "أتعاب أجور نقل"]);
        expect(types.rows.filter((r) => r.is_fee).map((r) => r.name)).toEqual(["أتعاب شركة", "أتعاب أجور نقل"]);
        const settings = await db.execute<{ default_clearance_party_id: string | null; default_vault_iqd_id: string | null }>(sql`SELECT * FROM company_settings`);
        expect(settings.rows[0].default_clearance_party_id).not.toBeNull();
        expect(settings.rows[0].default_vault_iqd_id).not.toBeNull();
    });

    it("is idempotent: running it twice gives the same row counts", async () => {
        await seed(db, owner);
        const first = await counts();
        await seed(db, owner);
        expect(await counts()).toEqual(first);
    });
});
