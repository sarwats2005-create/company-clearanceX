/**
 * pnpm db:migrate
 *   1. src/db/sql/0000_extensions.sql   (extensions)
 *   2. drizzle migrations in ./drizzle  (tables, enums, indexes)
 *   3. every other src/db/sql/*.sql     (idempotent triggers, views, trigram indexes)
 * Uses DATABASE_URL_UNPOOLED when set (Neon direct host), else DATABASE_URL.
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

export async function runMigrations(url: string, log = true) {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
        const sqlDir = join(process.cwd(), "src/db/sql");
        const files = readdirSync(sqlDir).filter((f) => f.endsWith(".sql")).sort();
        const [pre, ...post] = files;
        await client.query(readFileSync(join(sqlDir, pre), "utf8"));
        await migrate(drizzle(client), { migrationsFolder: join(process.cwd(), "drizzle") });
        for (const f of post) {
            await client.query(readFileSync(join(sqlDir, f), "utf8"));
            if (log) console.log(`applied ${f}`);
        }
        if (log) console.log("migrations complete");
    } finally {
        await client.end();
    }
}

if (process.argv[1]?.endsWith("migrate.ts")) {
    const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
    if (!url) {
        console.error("DATABASE_URL is not set");
        process.exit(1);
    }
    runMigrations(url).catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
