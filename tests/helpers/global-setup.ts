import { runMigrations } from "../../scripts/migrate";

/** Brings the test database schema up to date once per `vitest run`. */
export default async function setup() {
    const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5432/clearance_test";
    await runMigrations(url, false);
}
