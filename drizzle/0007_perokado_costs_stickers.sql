-- Perokado — prix d'achat, compte marchand PSP et stickers promotionnels.
--
-- 1. `products.purchase_price` : prix de revient saisi dans l'administration,
--    utilisé pour calculer le bénéfice net réel. Laissé NULL quand il n'est pas
--    encore connu : le tableau de bord indique alors « prix d'achat manquant »
--    plutôt que d'afficher un bénéfice faux.
-- 2. `store_settings.psp_merchant_*` : compte marchand de l'agrégateur de
--    paiement (mobile money / carte), affiché au client au moment de payer.
-- 3. `stickers` + `product_stickers` : vignettes « garantie », « réduction »…
--    affectées à un ou plusieurs produits, au plus deux par produit.
-- 4. Le nom par défaut de la boutique devient « Perokado ».

DO $$ BEGIN
  CREATE TYPE "public"."sticker_tone" AS ENUM('GOLD', 'GREEN', 'RED', 'NAVY', 'WHITE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."sticker_icon" AS ENUM('none', 'shield', 'percent', 'tag', 'truck', 'clock', 'star', 'gift');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "purchase_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "psp_merchant_number" text;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "psp_merchant_label" text;--> statement-breakpoint
ALTER TABLE "store_settings" ALTER COLUMN "store_name" SET DEFAULT 'Perokado';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stickers" (
  "id" text PRIMARY KEY NOT NULL,
  "label" text NOT NULL,
  "detail" text,
  "tone" "sticker_tone" DEFAULT 'GOLD' NOT NULL,
  "icon" "sticker_icon" DEFAULT 'none' NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stickers" ADD CONSTRAINT "stickers_created_by_user_id_users_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stickers_active_idx" ON "stickers" USING btree ("is_active", "starts_at", "ends_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_stickers" (
  "product_id" text NOT NULL,
  "sticker_id" text NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_stickers_product_id_sticker_id_pk" PRIMARY KEY ("product_id", "sticker_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "product_stickers" ADD CONSTRAINT "product_stickers_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "product_stickers" ADD CONSTRAINT "product_stickers_sticker_id_stickers_id_fk"
    FOREIGN KEY ("sticker_id") REFERENCES "public"."stickers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_stickers_sticker_idx" ON "product_stickers" USING btree ("sticker_id");--> statement-breakpoint
-- Au plus deux stickers par produit : la règle est portée par la base, pas
-- seulement par le formulaire d'administration.
CREATE OR REPLACE FUNCTION perokado_max_two_stickers() RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM product_stickers WHERE product_id = NEW.product_id) >= 2 THEN
    RAISE EXCEPTION 'Un produit ne peut porter que deux stickers au maximum.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS product_stickers_limit ON "product_stickers";
--> statement-breakpoint
CREATE TRIGGER product_stickers_limit
  BEFORE INSERT ON "product_stickers"
  FOR EACH ROW EXECUTE FUNCTION perokado_max_two_stickers();
