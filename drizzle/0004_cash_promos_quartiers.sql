ALTER TABLE "delivery_zones" ADD COLUMN "neighbourhoods" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."promo_campaign_type" AS ENUM('PERCENT', 'FIXED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cash_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "opened_by_user_id" text,
  "opened_at" timestamp with time zone DEFAULT now() NOT NULL,
  "opening_float" numeric(12, 2) DEFAULT '0' NOT NULL,
  "closed_by_user_id" text,
  "closed_at" timestamp with time zone,
  "counted_cash" numeric(12, 2),
  "expected_cash" numeric(12, 2),
  "difference" numeric(12, 2),
  "cash_order_count" integer,
  "cash_total" numeric(12, 2),
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_opened_by_user_id_users_id_fk"
    FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_closed_by_user_id_users_id_fk"
    FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_sessions_opened_idx" ON "cash_sessions" USING btree ("opened_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promo_campaigns" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "banner_text" text,
  "type" "promo_campaign_type" NOT NULL,
  "value" numeric(12, 2) NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "promo_campaigns" ADD CONSTRAINT "promo_campaigns_created_by_user_id_users_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "promo_campaigns_window_idx" ON "promo_campaigns" USING btree ("is_active", "starts_at", "ends_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promo_campaign_products" (
  "campaign_id" text NOT NULL,
  "product_id" text NOT NULL,
  "base_price" numeric(12, 2) NOT NULL,
  "promo_price" numeric(12, 2) NOT NULL,
  CONSTRAINT "promo_campaign_products_campaign_id_product_id_pk" PRIMARY KEY("campaign_id", "product_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "promo_campaign_products" ADD CONSTRAINT "promo_campaign_products_campaign_id_promo_campaigns_id_fk"
    FOREIGN KEY ("campaign_id") REFERENCES "public"."promo_campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "promo_campaign_products" ADD CONSTRAINT "promo_campaign_products_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
