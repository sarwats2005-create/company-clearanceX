/** Dev helper: prints a session token for the seeded owner (used by screenshot scripts). */
import "dotenv/config";
import { db, pool } from "@/db";
import { users } from "@/db/schema";
import { createSessionRecord } from "@/lib/auth-core";

void (async () => {
    const [u] = await db.select().from(users).limit(1);
    const { token } = await createSessionRecord(db, u.id);
    console.log(token);
    await pool.end();
})();
