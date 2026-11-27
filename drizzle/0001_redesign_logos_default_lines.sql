ALTER TABLE "charge_types" ADD COLUMN "is_default_line" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping_lines" ADD COLUMN "logo" text;--> statement-breakpoint
ALTER TABLE "shipping_lines" ADD COLUMN "website" text;--> statement-breakpoint
UPDATE "shipping_lines" SET "website" = CASE "name"
    WHEN 'MSC' THEN 'msc.com'
    WHEN 'Maersk' THEN 'maersk.com'
    WHEN 'CMA CGM' THEN 'cma-cgm.com'
    WHEN 'COSCO' THEN 'coscoshipping.com'
    WHEN 'Hapag-Lloyd' THEN 'hapag-lloyd.com'
    WHEN 'ONE' THEN 'one-line.com'
    WHEN 'Evergreen' THEN 'evergreen-line.com'
    WHEN 'Yang Ming' THEN 'yangming.com'
    WHEN 'ZIM' THEN 'zim.com'
    WHEN 'HMM' THEN 'hmm21.com'
    ELSE "website" END
WHERE "website" IS NULL;--> statement-breakpoint
UPDATE "charge_types" SET "is_default_line" = true WHERE "id" IN (SELECT "charge_type_id" FROM "charge_type_defaults");
--> statement-breakpoint
UPDATE "charge_types" SET "is_default_line" = true
WHERE "name" IN ('كمرك بصرة', 'أتعاب شركة') AND NOT EXISTS (SELECT 1 FROM "charge_types" WHERE "is_default_line");
