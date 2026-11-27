ALTER TYPE "public"."account_kind" ADD VALUE 'trader_branch';--> statement-breakpoint
ALTER TYPE "public"."account_kind" ADD VALUE 'branch_owner';--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "is_branch" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vaults" ADD COLUMN "party_id" uuid;--> statement-breakpoint
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "parties_one_branch_uq" ON "parties" USING btree ("is_branch") WHERE "parties"."is_branch";--> statement-breakpoint
-- The owner's Umm Qasr partnership is his branch (owner's request 2026-11-27): mark it and give it its own dinar vault.
UPDATE "parties" SET "is_branch" = true WHERE "name" = 'شراكة تخليص أم قصر' AND "kind" = 'partner' AND NOT EXISTS (SELECT 1 FROM "parties" WHERE "is_branch");--> statement-breakpoint
INSERT INTO "vaults" ("name", "kind", "allowed_currencies", "party_id", "notes")
SELECT 'قاصة ' || p."name", 'other', ARRAY['IQD']::currency[], p."id", 'قاصة الشراكة: أموالها ليست من القاصة الرئيسية'
  FROM "parties" p
 WHERE p."is_branch" AND NOT EXISTS (SELECT 1 FROM "vaults" v WHERE v."party_id" = p."id")
ON CONFLICT ("name") DO NOTHING;
