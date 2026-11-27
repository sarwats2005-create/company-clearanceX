import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __ccPool?: Pool };

/** One shared pool per process (Railway runs a long-lived Node server). */
export const pool =
    globalForDb.__ccPool ??
    new Pool({
        connectionString: process.env.DATABASE_URL,
        max: Number(process.env.DATABASE_POOL_MAX ?? 10),
        // Fail fast instead of hanging: a stuck query or an open transaction can't hold locks forever.
        connectionTimeoutMillis: 10_000,
        statement_timeout: 30_000,
        idle_in_transaction_session_timeout: 60_000,
        application_name: "clearance-app",
    });
// A dropped connection (e.g. the database restarting) must not crash the whole server.
pool.on("error", (err) => console.error("[db] idle client error", err.message));
globalForDb.__ccPool = pool;

export const db = drizzle(pool, { schema });

export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
/** Anything that can run a query: the db itself or an open transaction. */
export type DbOrTx = DB | Tx;

/** Runs `fn` inside one Postgres transaction (rolled back if it throws). */
export function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return db.transaction(fn);
}
