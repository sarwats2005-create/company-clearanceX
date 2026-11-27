CREATE TYPE "public"."restore_point_kind" AS ENUM('manual', 'before_restore', 'before_reset');--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'restore';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'reset';--> statement-breakpoint
CREATE TABLE "restore_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"kind" "restore_point_kind" DEFAULT 'manual' NOT NULL,
	"format_version" integer DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL,
	"counts" jsonb NOT NULL,
	"checksum" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_on" date DEFAULT (now() AT TIME ZONE 'Asia/Baghdad')::date NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "restore_points" ADD CONSTRAINT "restore_points_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "restore_points_created_idx" ON "restore_points" USING btree ("created_at");