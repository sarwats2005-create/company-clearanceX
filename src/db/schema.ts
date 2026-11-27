/**
 * Database schema (PRD §12). Money is numeric(18,2) and is read/written as strings.
 * Rates are numeric(14,4). Dates are `date` columns read as "yyyy-mm-dd" strings.
 */
import { sql } from "drizzle-orm";
import {
    boolean,
    date,
    index,
    integer,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

// ── Enums (PRD §12.1) ────────────────────────────────────────────────────────
export const currencyEnum = pgEnum("currency", ["IQD", "USD"]);
export const containerStatusEnum = pgEnum("container_status", ["confirmed", "on_the_way", "arrived", "delivered"]);
export const splitUnitEnum = pgEnum("split_unit", ["meters", "cbm", "percent", "equal"]);
export const splitModeEnum = pgEnum("split_mode", ["by_share", "single_trader", "manual"]);
export const partyKindEnum = pgEnum("party_kind", ["self", "clearance_company", "partner", "other"]);
export const vaultKindEnum = pgEnum("vault_kind", ["main", "usd", "person", "exchange_shop", "trader", "other"]);
export const accountKindEnum = pgEnum("account_kind", [
    "trader",
    "party",
    "vault",
    "fee_income",
    "general_expense",
    "owner_equity",
    "fx",
    "opening",
]);
export const entryTypeEnum = pgEnum("entry_type", [
    "container_charge",
    "receive_from_trader",
    "receive_from_party",
    "pay_party",
    "pay_trader",
    "deposit",
    "withdraw",
    "transfer",
    "exchange",
    "general_expense",
    "opening_balance",
    "trader_party_offset",
    "reversal",
]);
export const receiptKindEnum = pgEnum("receipt_kind", ["in", "out", "transfer", "exchange"]);
export const userRoleEnum = pgEnum("user_role", ["owner"]);
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "cancel", "status", "login", "archive", "restore", "reset"]);
/** manual = saved by the owner; the others are saved automatically just before a restore or a fresh start. */
export const restorePointKindEnum = pgEnum("restore_point_kind", ["manual", "before_restore", "before_reset"]);

export type Currency = (typeof currencyEnum.enumValues)[number];
export type ContainerStatus = (typeof containerStatusEnum.enumValues)[number];
export type SplitUnit = (typeof splitUnitEnum.enumValues)[number];
export type SplitMode = (typeof splitModeEnum.enumValues)[number];
export type PartyKind = (typeof partyKindEnum.enumValues)[number];
export type VaultKind = (typeof vaultKindEnum.enumValues)[number];
export type AccountKind = (typeof accountKindEnum.enumValues)[number];
export type EntryType = (typeof entryTypeEnum.enumValues)[number];
export type ReceiptKind = (typeof receiptKindEnum.enumValues)[number];
export type RestorePointKind = (typeof restorePointKindEnum.enumValues)[number];

const money = (name: string) => numeric(name, { precision: 18, scale: 2 });
const rate = (name: string) => numeric(name, { precision: 14, scale: 4 });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
    timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date());
const day = (name: string) => date(name, { mode: "string" });

// ── Auth ─────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("owner"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
});

/** id = SHA-256 hex of the random session token (the raw token only lives in the cookie). */
export const sessions = pgTable(
    "sessions",
    {
        id: text("id").primaryKey(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        /** Absolute end: the session dies here whatever happens (30 days). */
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        /** Last request seen; a session idle for too long ends (see IDLE_* in auth-core). */
        lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
        /** "تذكرني": a longer idle limit on a trusted device. */
        remember: boolean("remember").notNull().default(true),
        /** Shown to the owner in Settings → الحساب so he can recognise and sign out a device. */
        userAgent: text("user_agent"),
        ip: text("ip"),
        createdAt: createdAt(),
    },
    (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

export const loginAttempts = pgTable(
    "login_attempts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        key: text("key").notNull(),
        /** Limits are counted per username (any IP) and per IP (any username), not only per pair. */
        username: text("username"),
        ip: text("ip"),
        success: boolean("success").notNull(),
        at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        index("login_attempts_key_at_idx").on(t.key, t.at),
        index("login_attempts_username_at_idx").on(t.username, t.at),
        index("login_attempts_ip_at_idx").on(t.ip, t.at),
    ],
);

// ── Reference data ───────────────────────────────────────────────────────────
export const parties = pgTable("parties", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    kind: partyKindEnum("kind").notNull().default("other"),
    phone: text("phone"),
    notes: text("notes"),
    isSystem: boolean("is_system").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
});

export const vaults = pgTable("vaults", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    kind: vaultKindEnum("kind").notNull().default("other"),
    allowedCurrencies: currencyEnum("allowed_currencies").array().notNull(),
    notes: text("notes"),
    isSystem: boolean("is_system").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
});

export const traders = pgTable(
    "traders",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        name: text("name").notNull(),
        phone: text("phone"),
        city: text("city"),
        notes: text("notes"),
        isActive: boolean("is_active").notNull().default(true),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [uniqueIndex("traders_name_active_uq").on(sql`lower(${t.name})`).where(sql`${t.isActive}`)],
);

export const shippingLines = pgTable("shipping_lines", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    /** The line's logo, uploaded by the owner in Settings (a small image as a data: URL). */
    logo: text("logo"),
    /** The line's website (e.g. maersk.com): its icon is the logo until the owner uploads one. */
    website: text("website"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
});

export const containerSizes = pgTable("container_sizes", {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    label: text("label").notNull(),
    lengthM: numeric("length_m", { precision: 6, scale: 2 }),
    volumeM3: numeric("volume_m3", { precision: 7, scale: 2 }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
});

export const portsOfLoading = pgTable("ports_of_loading", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    country: text("country"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
});

export const chargeTypes = pgTable("charge_types", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    defaultCurrency: currencyEnum("default_currency").notNull().default("USD"),
    defaultPartyId: uuid("default_party_id").references(() => parties.id),
    isFee: boolean("is_fee").notNull().default(false),
    /** A default line: it is already on the expenses page when it opens (the owner marks it there or in Settings). */
    isDefaultLine: boolean("is_default_line").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
});

export const chargeTypeDefaults = pgTable(
    "charge_type_defaults",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        chargeTypeId: uuid("charge_type_id")
            .notNull()
            .references(() => chargeTypes.id, { onDelete: "cascade" }),
        containerSizeId: uuid("container_size_id").references(() => containerSizes.id, { onDelete: "cascade" }),
        amount: money("amount").notNull(),
    },
    (t) => [unique("charge_type_defaults_uq").on(t.chargeTypeId, t.containerSizeId).nullsNotDistinct()],
);

export const expenseCategories = pgTable("expense_categories", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
});

export const companySettings = pgTable("company_settings", {
    id: integer("id").primaryKey().default(1),
    name: text("name").notNull().default("شركة التخليص"),
    phone: text("phone"),
    address: text("address"),
    receiptFooter: text("receipt_footer"),
    defaultUsdIqdRate: rate("default_usd_iqd_rate").notNull().default("1310"),
    rateUpdatedAt: timestamp("rate_updated_at", { withTimezone: true }),
    arrivedWarningDays: integer("arrived_warning_days").notNull().default(7),
    defaultClearancePartyId: uuid("default_clearance_party_id").references(() => parties.id),
    defaultVaultIqdId: uuid("default_vault_iqd_id").references(() => vaults.id),
    defaultVaultUsdId: uuid("default_vault_usd_id").references(() => vaults.id),
    updatedAt: updatedAt(),
});

// ── Containers ───────────────────────────────────────────────────────────────
export const containers = pgTable(
    "containers",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        containerNumber: text("container_number").notNull().unique(),
        shippingLineId: uuid("shipping_line_id")
            .notNull()
            .references(() => shippingLines.id),
        portOfLoadingId: uuid("port_of_loading_id").references(() => portsOfLoading.id),
        billOfLadingNumber: text("bill_of_lading_number"),
        isShared: boolean("is_shared").notNull().default(false),
        splitUnit: splitUnitEnum("split_unit"),
        faxNumber: text("fax_number"),
        containerSizeId: uuid("container_size_id").references(() => containerSizes.id),
        quantity: integer("quantity").notNull().default(1),
        companyPartyId: uuid("company_party_id").references(() => parties.id),
        destination: text("destination"),
        status: containerStatusEnum("status").notNull().default("confirmed"),
        registeredOn: day("registered_on").notNull(),
        expectedArrivalOn: day("expected_arrival_on"),
        arrivedOn: day("arrived_on"),
        deliveredOn: day("delivered_on"),
        statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().defaultNow(),
        notes: text("notes"),
        archivedAt: timestamp("archived_at", { withTimezone: true }),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index("containers_status_idx").on(t.status), index("containers_registered_on_idx").on(t.registeredOn)],
);

export const containerShares = pgTable(
    "container_shares",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        containerId: uuid("container_id")
            .notNull()
            .references(() => containers.id, { onDelete: "cascade" }),
        traderId: uuid("trader_id")
            .notNull()
            .references(() => traders.id),
        shareValue: numeric("share_value", { precision: 10, scale: 3 }),
        goods: text("goods"),
        cartons: integer("cartons"),
        weightKg: numeric("weight_kg", { precision: 12, scale: 2 }),
        deliveredOn: day("delivered_on"),
        sortOrder: integer("sort_order").notNull().default(0),
    },
    (t) => [unique("container_shares_uq").on(t.containerId, t.traderId), index("container_shares_trader_idx").on(t.traderId)],
);

export const containerStatusHistory = pgTable(
    "container_status_history",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        containerId: uuid("container_id")
            .notNull()
            .references(() => containers.id, { onDelete: "cascade" }),
        fromStatus: containerStatusEnum("from_status"),
        toStatus: containerStatusEnum("to_status").notNull(),
        changedOn: day("changed_on").notNull(),
        note: text("note"),
        isBackward: boolean("is_backward").notNull().default(false),
        userId: uuid("user_id").references(() => users.id),
        createdAt: createdAt(),
    },
    (t) => [index("container_status_history_container_idx").on(t.containerId)],
);

// ── Ledger (PRD §6, §12.2) ───────────────────────────────────────────────────
export const accounts = pgTable(
    "accounts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        kind: accountKindEnum("kind").notNull(),
        refId: uuid("ref_id"),
        currency: currencyEnum("currency").notNull(),
        name: text("name").notNull(),
        createdAt: createdAt(),
    },
    (t) => [unique("accounts_kind_ref_currency_uq").on(t.kind, t.refId, t.currency).nullsNotDistinct()],
);

export const journalEntries = pgTable(
    "journal_entries",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        type: entryTypeEnum("type").notNull(),
        receiptKind: receiptKindEnum("receipt_kind"),
        receiptNo: text("receipt_no").unique(),
        entryDate: day("entry_date").notNull(),
        description: text("description").notNull(),
        counterpartyLabel: text("counterparty_label"),
        /** Headline amount shown in lists and on the receipt (the "from" side for FX). */
        amount: money("amount"),
        currency: currencyEnum("currency"),
        containerId: uuid("container_id").references(() => containers.id),
        fxRate: rate("fx_rate"),
        /** Display details for receipts (labels, other side of an exchange, vault names…). */
        meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
        reversesEntryId: uuid("reverses_entry_id"),
        cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
        cancelReason: text("cancel_reason"),
        userId: uuid("user_id").references(() => users.id),
        createdAt: createdAt(),
    },
    (t) => [
        index("journal_entries_entry_date_idx").on(t.entryDate),
        index("journal_entries_container_idx").on(t.containerId),
        index("journal_entries_reverses_idx").on(t.reversesEntryId),
    ],
);

export const journalLines = pgTable(
    "journal_lines",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        entryId: uuid("entry_id")
            .notNull()
            .references(() => journalEntries.id),
        accountId: uuid("account_id")
            .notNull()
            .references(() => accounts.id),
        currency: currencyEnum("currency").notNull(),
        debit: money("debit").notNull().default("0"),
        credit: money("credit").notNull().default("0"),
        /** Optional per-line note (e.g. "حصتك 4 م من 9.5 م" on a shared container charge). */
        memo: text("memo"),
        createdAt: createdAt(),
    },
    (t) => [index("journal_lines_account_idx").on(t.accountId), index("journal_lines_entry_idx").on(t.entryId)],
);

export const entryContainers = pgTable(
    "entry_containers",
    {
        entryId: uuid("entry_id")
            .notNull()
            .references(() => journalEntries.id),
        containerId: uuid("container_id")
            .notNull()
            .references(() => containers.id),
    },
    (t) => [primaryKey({ columns: [t.entryId, t.containerId] })],
);

export const receiptSequences = pgTable("receipt_sequences", {
    kind: receiptKindEnum("kind").primaryKey(),
    prefix: text("prefix").notNull(),
    nextNumber: integer("next_number").notNull().default(1),
});

// ── Charges ──────────────────────────────────────────────────────────────────
export const containerCharges = pgTable(
    "container_charges",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        containerId: uuid("container_id")
            .notNull()
            .references(() => containers.id),
        chargeTypeId: uuid("charge_type_id")
            .notNull()
            .references(() => chargeTypes.id),
        amount: money("amount").notNull(),
        currency: currencyEnum("currency").notNull(),
        paidByPartyId: uuid("paid_by_party_id").references(() => parties.id),
        paidFromVaultId: uuid("paid_from_vault_id").references(() => vaults.id),
        isFee: boolean("is_fee").notNull().default(false),
        splitMode: splitModeEnum("split_mode").notNull().default("by_share"),
        journalEntryId: uuid("journal_entry_id")
            .notNull()
            .references(() => journalEntries.id),
        note: text("note"),
        cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
        cancelReason: text("cancel_reason"),
        userId: uuid("user_id").references(() => users.id),
        createdAt: createdAt(),
    },
    (t) => [index("container_charges_container_idx").on(t.containerId)],
);

export const containerChargeAllocations = pgTable(
    "container_charge_allocations",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        chargeId: uuid("charge_id")
            .notNull()
            .references(() => containerCharges.id),
        traderId: uuid("trader_id")
            .notNull()
            .references(() => traders.id),
        amount: money("amount").notNull(),
    },
    (t) => [index("container_charge_allocations_charge_idx").on(t.chargeId), index("container_charge_allocations_trader_idx").on(t.traderId)],
);

// ── Audit ────────────────────────────────────────────────────────────────────
export const auditLog = pgTable(
    "audit_log",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        tableName: text("table_name").notNull(),
        recordId: text("record_id"),
        action: auditActionEnum("action").notNull(),
        before: jsonb("before"),
        after: jsonb("after"),
        userId: uuid("user_id").references(() => users.id),
        at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [index("audit_log_at_idx").on(t.at)],
);

// ── Restore points ───────────────────────────────────────────────────────────
/**
 * A full copy of the business data at one moment ("نقطة استرجاع"). Rows are written ONLY by the database
 * function cc_create_restore_point (src/db/sql/0003_restore_points.sql), never by the app, so a point always
 * holds real data. Logins, sessions, the audit log and the points themselves are never inside a point.
 */
export const restorePoints = pgTable(
    "restore_points",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        label: text("label").notNull(),
        kind: restorePointKindEnum("kind").notNull().default("manual"),
        /** Layout of `data`, so a future version knows how to read an old point. */
        formatVersion: integer("format_version").notNull().default(1),
        /** { tableName: [row, …] } for every business table. */
        data: jsonb("data").notNull(),
        /** { tableName: rowCount } shown on the page ("12 حاوية · 340 حركة"). */
        counts: jsonb("counts").$type<Record<string, number>>().notNull(),
        /** SHA-256 of `data`: a damaged point is refused instead of half-restored. */
        checksum: text("checksum").notNull(),
        sizeBytes: integer("size_bytes").notNull(),
        /** The Baghdad calendar day it was saved: "start fresh" needs a manual point from today. */
        createdOn: date("created_on", { mode: "string" })
            .notNull()
            .default(sql`(now() AT TIME ZONE 'Asia/Baghdad')::date`),
        userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
        createdAt: createdAt(),
    },
    (t) => [index("restore_points_created_idx").on(t.createdAt)],
);
