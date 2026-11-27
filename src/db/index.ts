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
    });
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
