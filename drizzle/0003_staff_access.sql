ALTER TYPE "public"."role" ADD VALUE 'ACCOUNTANT';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'CASHIER';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'SALES_ADVISOR';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'WAREHOUSE_KEEPER';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'CATALOG_MANAGER';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'DELIVERY_MANAGER';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'SUPPORT_AGENT';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_normalized" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "staff_task" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "staff_code_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "staff_code_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "staff_code_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "staff_code_used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "staff_code_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_normalized_key" ON "users" USING btree ("phone_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "users_staff_code_hash_key" ON "users" USING btree ("staff_code_hash");