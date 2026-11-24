CREATE TYPE "public"."account_kind" AS ENUM('trader', 'party', 'vault', 'fee_income', 'general_expense', 'owner_equity', 'fx', 'opening');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'cancel', 'status', 'login', 'archive');--> statement-breakpoint
CREATE TYPE "public"."container_status" AS ENUM('confirmed', 'on_the_way', 'arrived', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('IQD', 'USD');--> statement-breakpoint
CREATE TYPE "public"."entry_type" AS ENUM('container_charge', 'receive_from_trader', 'receive_from_party', 'pay_party', 'pay_trader', 'deposit', 'withdraw', 'transfer', 'exchange', 'general_expense', 'opening_balance', 'trader_party_offset', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."party_kind" AS ENUM('self', 'clearance_company', 'partner', 'other');--> statement-breakpoint
CREATE TYPE "public"."receipt_kind" AS ENUM('in', 'out', 'transfer', 'exchange');--> statement-breakpoint
CREATE TYPE "public"."split_mode" AS ENUM('by_share', 'single_trader', 'manual');--> statement-breakpoint
CREATE TYPE "public"."split_unit" AS ENUM('meters', 'cbm', 'percent', 'equal');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner');--> statement-breakpoint
CREATE TYPE "public"."vault_kind" AS ENUM('main', 'usd', 'person', 'exchange_shop', 'trader', 'other');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "account_kind" NOT NULL,
	"ref_id" uuid,
	"currency" "currency" NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_kind_ref_currency_uq" UNIQUE NULLS NOT DISTINCT("kind","ref_id","currency")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" text NOT NULL,
	"record_id" text,
	"action" "audit_action" NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"user_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charge_type_defaults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_type_id" uuid NOT NULL,
	"container_size_id" uuid,
	"amount" numeric(18, 2) NOT NULL,
	CONSTRAINT "charge_type_defaults_uq" UNIQUE NULLS NOT DISTINCT("charge_type_id","container_size_id")
);
--> statement-breakpoint
CREATE TABLE "charge_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"default_currency" "currency" DEFAULT 'USD' NOT NULL,
	"default_party_id" uuid,
	"is_fee" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charge_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text DEFAULT 'شركة التخليص' NOT NULL,
	"phone" text,
	"address" text,
	"receipt_footer" text,
	"default_usd_iqd_rate" numeric(14, 4) DEFAULT '1310' NOT NULL,
	"rate_updated_at" timestamp with time zone,
	"arrived_warning_days" integer DEFAULT 7 NOT NULL,
	"default_clearance_party_id" uuid,
	"default_vault_iqd_id" uuid,
	"default_vault_usd_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "container_charge_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_id" uuid NOT NULL,
	"trader_id" uuid NOT NULL,
	"amount" numeric(18, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "container_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"container_id" uuid NOT NULL,
	"charge_type_id" uuid NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"paid_by_party_id" uuid,
	"paid_from_vault_id" uuid,
	"is_fee" boolean DEFAULT false NOT NULL,
	"split_mode" "split_mode" DEFAULT 'by_share' NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"note" text,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "container_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"container_id" uuid NOT NULL,
	"trader_id" uuid NOT NULL,
	"share_value" numeric(10, 3),
	"goods" text,
	"cartons" integer,
	"weight_kg" numeric(12, 2),
	"delivered_on" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "container_shares_uq" UNIQUE("container_id","trader_id")
);
--> statement-breakpoint
CREATE TABLE "container_sizes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"length_m" numeric(6, 2),
	"volume_m3" numeric(7, 2),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "container_sizes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "container_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"container_id" uuid NOT NULL,
	"from_status" "container_status",
	"to_status" "container_status" NOT NULL,
	"changed_on" date NOT NULL,
	"note" text,
	"is_backward" boolean DEFAULT false NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "containers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"container_number" text NOT NULL,
	"shipping_line_id" uuid NOT NULL,
	"port_of_loading_id" uuid,
	"bill_of_lading_number" text,
	"is_shared" boolean DEFAULT false NOT NULL,
	"split_unit" "split_unit",
	"fax_number" text,
	"container_size_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"company_party_id" uuid,
	"destination" text,
	"status" "container_status" DEFAULT 'confirmed' NOT NULL,
	"registered_on" date NOT NULL,
	"expected_arrival_on" date,
	"arrived_on" date,
	"delivered_on" date,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "containers_container_number_unique" UNIQUE("container_number")
);
--> statement-breakpoint
CREATE TABLE "entry_containers" (
	"entry_id" uuid NOT NULL,
	"container_id" uuid NOT NULL,
	CONSTRAINT "entry_containers_entry_id_container_id_pk" PRIMARY KEY("entry_id","container_id")
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "entry_type" NOT NULL,
	"receipt_kind" "receipt_kind",
	"receipt_no" text,
	"entry_date" date NOT NULL,
	"description" text NOT NULL,
	"counterparty_label" text,
	"amount" numeric(18, 2),
	"currency" "currency",
	"container_id" uuid,
	"fx_rate" numeric(14, 4),
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reverses_entry_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entries_receipt_no_unique" UNIQUE("receipt_no")
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"currency" "currency" NOT NULL,
	"debit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"success" boolean NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "party_kind" DEFAULT 'other' NOT NULL,
	"phone" text,
	"notes" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parties_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "ports_of_loading" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ports_of_loading_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "receipt_sequences" (
	"kind" "receipt_kind" PRIMARY KEY NOT NULL,
	"prefix" text NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipping_lines_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "traders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"city" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'owner' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vaults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "vault_kind" DEFAULT 'other' NOT NULL,
	"allowed_currencies" "currency"[] NOT NULL,
	"notes" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vaults_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_type_defaults" ADD CONSTRAINT "charge_type_defaults_charge_type_id_charge_types_id_fk" FOREIGN KEY ("charge_type_id") REFERENCES "public"."charge_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_type_defaults" ADD CONSTRAINT "charge_type_defaults_container_size_id_container_sizes_id_fk" FOREIGN KEY ("container_size_id") REFERENCES "public"."container_sizes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_types" ADD CONSTRAINT "charge_types_default_party_id_parties_id_fk" FOREIGN KEY ("default_party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_default_clearance_party_id_parties_id_fk" FOREIGN KEY ("default_clearance_party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_default_vault_iqd_id_vaults_id_fk" FOREIGN KEY ("default_vault_iqd_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_default_vault_usd_id_vaults_id_fk" FOREIGN KEY ("default_vault_usd_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_charge_allocations" ADD CONSTRAINT "container_charge_allocations_charge_id_container_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."container_charges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_charge_allocations" ADD CONSTRAINT "container_charge_allocations_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_charges" ADD CONSTRAINT "container_charges_container_id_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_charges" ADD CONSTRAINT "container_charges_charge_type_id_charge_types_id_fk" FOREIGN KEY ("charge_type_id") REFERENCES "public"."charge_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_charges" ADD CONSTRAINT "container_charges_paid_by_party_id_parties_id_fk" FOREIGN KEY ("paid_by_party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_charges" ADD CONSTRAINT "container_charges_paid_from_vault_id_vaults_id_fk" FOREIGN KEY ("paid_from_vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_charges" ADD CONSTRAINT "container_charges_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_charges" ADD CONSTRAINT "container_charges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_shares" ADD CONSTRAINT "container_shares_container_id_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_shares" ADD CONSTRAINT "container_shares_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_status_history" ADD CONSTRAINT "container_status_history_container_id_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_status_history" ADD CONSTRAINT "container_status_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "containers" ADD CONSTRAINT "containers_shipping_line_id_shipping_lines_id_fk" FOREIGN KEY ("shipping_line_id") REFERENCES "public"."shipping_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "containers" ADD CONSTRAINT "containers_port_of_loading_id_ports_of_loading_id_fk" FOREIGN KEY ("port_of_loading_id") REFERENCES "public"."ports_of_loading"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "containers" ADD CONSTRAINT "containers_container_size_id_container_sizes_id_fk" FOREIGN KEY ("container_size_id") REFERENCES "public"."container_sizes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "containers" ADD CONSTRAINT "containers_company_party_id_parties_id_fk" FOREIGN KEY ("company_party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_containers" ADD CONSTRAINT "entry_containers_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_containers" ADD CONSTRAINT "entry_containers_container_id_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_container_id_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "container_charge_allocations_charge_idx" ON "container_charge_allocations" USING btree ("charge_id");--> statement-breakpoint
CREATE INDEX "container_charge_allocations_trader_idx" ON "container_charge_allocations" USING btree ("trader_id");--> statement-breakpoint
CREATE INDEX "container_charges_container_idx" ON "container_charges" USING btree ("container_id");--> statement-breakpoint
CREATE INDEX "container_shares_trader_idx" ON "container_shares" USING btree ("trader_id");--> statement-breakpoint
CREATE INDEX "container_status_history_container_idx" ON "container_status_history" USING btree ("container_id");--> statement-breakpoint
CREATE INDEX "containers_status_idx" ON "containers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "containers_registered_on_idx" ON "containers" USING btree ("registered_on");--> statement-breakpoint
CREATE INDEX "journal_entries_entry_date_idx" ON "journal_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "journal_entries_container_idx" ON "journal_entries" USING btree ("container_id");--> statement-breakpoint
CREATE INDEX "journal_entries_reverses_idx" ON "journal_entries" USING btree ("reverses_entry_id");--> statement-breakpoint
CREATE INDEX "journal_lines_account_idx" ON "journal_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "journal_lines_entry_idx" ON "journal_lines" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "login_attempts_key_at_idx" ON "login_attempts" USING btree ("key","at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "traders_name_active_uq" ON "traders" USING btree (lower("name")) WHERE "traders"."is_active";