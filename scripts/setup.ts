/**
 * pnpm db:setup — runs before every deploy (railway.json preDeployCommand).
 *   1. Brings the schema up to date (same as pnpm db:migrate).
 *   2. Seeds the starting lists and the owner login, ONLY when the database has no users yet,
 *      so a later deploy never brings back a list item the owner renamed.
 * Uses DATABASE_URL_UNPOOLED when set (Neon direct host), else DATABASE_URL.
 * Owner login from OWNER_USERNAME / OWNER_PASSWORD (8+ characters) / OWNER_NAME.
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { seed } from "../src/db/seed";
import { runMigrations } from "./migrate";

export interface OwnerLogin {
    username: string;
    password: string;
    name: string;
}

export async function setupDatabase(url: string, owner: OwnerLogin, log = true): Promise<{ seeded: boolean }> {
    await runMigrations(url, log);
    const pool = new Pool({ connectionString: url, max: 1 });
    try {
        const db = drizzle(pool, { schema });
        const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.users);
        if (Number(n) > 0) {
            if (log) console.log("database already set up; seed skipped");
            return { seeded: false };
        }
        if (!owner.username.trim()) throw new Error("Set OWNER_USERNAME to create the owner login.");
        if (owner.password.length < 8) throw new Error("Set OWNER_PASSWORD (8 characters or more) to create the owner login.");
        await db.transaction((tx) => seed(tx, { username: owner.username, password: owner.password, name: owner.name.trim() || "المالك" }));
        if (log) console.log("seed complete: owner login and starting lists created");
        return { seeded: true };
    } finally {
        await pool.end();
    }
}

if (process.argv[1]?.endsWith("setup.ts")) {
    const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
    if (!url) {
        console.error("DATABASE_URL is not set");
        process.exit(1);
    }
    const env = process.env;
    setupDatabase(url, { username: env.OWNER_USERNAME ?? "", password: env.OWNER_PASSWORD ?? "", name: env.OWNER_NAME ?? "" }).catch((err) => {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    });
}
