import { sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { parties, receiptSequences, traders, vaults } from "@/db/schema";

const TABLES = [
    "audit_log",
    "container_charge_allocations",
    "container_charges",
    "entry_containers",
    "journal_lines",
    "journal_entries",
    "accounts",
    "container_status_history",
    "container_shares",
    "containers",
    "charge_type_defaults",
    "charge_types",
    "expense_categories",
    "company_settings",
    "ports_of_loading",
    "container_sizes",
    "shipping_lines",
    "traders",
    "vaults",
    "parties",
    "receipt_sequences",
    "login_attempts",
    "sessions",
    "users",
];

/** Empties every table (TRUNCATE skips the row-level immutability triggers on purpose). */
export async function resetDb() {
    await db.execute(sql.raw(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`));
}

export async function seedSequences() {
    await db.insert(receiptSequences).values([
        { kind: "in", prefix: "ق", nextNumber: 1 },
        { kind: "out", prefix: "ص", nextNumber: 1 },
        { kind: "transfer", prefix: "ت", nextNumber: 1 },
        { kind: "exchange", prefix: "ع", nextNumber: 1 },
    ]);
}

/** Minimal world for ledger tests: 2 traders, 3 parties, IQD main vault, USD vault, a both-currency vault. */
export async function seedBasics() {
    await seedSequences();
    const [ahmed, haider] = await db
        .insert(traders)
        .values([{ name: "أحمد كاظم" }, { name: "حيدر عبد الله" }])
        .returning();
    const [self, china, ummQasr] = await db
        .insert(parties)
        .values([
            { name: "شركتنا", kind: "self", isSystem: true },
            { name: "شركة التخليص - الصين", kind: "clearance_company" },
            { name: "شراكة تخليص أم قصر", kind: "partner" },
        ])
        .returning();
    const [main, usd, shop] = await db
        .insert(vaults)
        .values([
            { name: "القاصة الرئيسية", kind: "main", allowedCurrencies: ["IQD"], isSystem: true },
            { name: "قاصة الدولار", kind: "usd", allowedCurrencies: ["USD"], isSystem: true },
            { name: "محل الصيرفة", kind: "exchange_shop", allowedCurrencies: ["IQD", "USD"] },
        ])
        .returning();
    return { ahmed, haider, self, china, ummQasr, main, usd, shop };
}

export async function closeDb() {
    await pool.end();
}
