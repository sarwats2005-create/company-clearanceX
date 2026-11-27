// Checks that Neon Realtime is enabled: subscribes once to a constant live query, waits for the
// initial result, then closes. The app has no live features; this only proves the service answers.
// Run: pnpm check:neon:realtime
import "dotenv/config";
import { createRealtime, rawSql } from "@neon/realtime/server";

const url = process.env.NEON_REALTIME_URL;
const secret = process.env.NEON_REALTIME_SECRET;
const databaseUrl = process.env.DATABASE_URL;
if (!url || !secret || !databaseUrl) {
    console.error("neon realtime: NEON_REALTIME_URL, NEON_REALTIME_SECRET or DATABASE_URL is missing from .env");
    process.exit(1);
}
const db = new URL(databaseUrl).pathname.slice(1);

const realtime = createRealtime({ url, secret, db });
const timer = setTimeout(() => {
    console.error("neon realtime: no initial result within 20s");
    realtime.close();
    process.exit(1);
}, 20_000);

try {
    const subscription = await realtime.subscribe(rawSql("SELECT 1::int AS id, 'ok'::text AS status", []));
    const rows = await new Promise((resolve, reject) => {
        const check = () => {
            const snapshot = subscription.getSnapshot();
            if (snapshot.status === "error") reject(snapshot.error);
            else if (snapshot.data !== undefined) resolve(snapshot.data);
        };
        subscription.onStateChange(check);
        subscription.onChange(check);
        check();
    });
    console.log(`neon realtime: OK (db ${db}, initial result ${JSON.stringify(rows)})`);
    subscription.unsubscribe();
} catch (error) {
    console.error(`neon realtime: failed: ${error?.message ?? error}`);
    process.exitCode = 1;
} finally {
    clearTimeout(timer);
    realtime.close();
}
