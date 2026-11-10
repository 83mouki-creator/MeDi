-- Perokado — avis clients vérifiés (produit + livraison).
--
-- Deux tables, deux questions distinctes :
--   product_reviews  « cet article tient-il ses promesses ? » — une note par
--                    article et par commande livrée ;
--   order_reviews    « la livraison s'est-elle bien passée ? » — une note par
--                    commande livrée.
--
-- Règle de fond : un avis n'est possible qu'après une commande **livrée**, et
-- seulement sur un article réellement présent dans cette commande. La base le
-- garantit par des clés étrangères ; l'application vérifie en plus le statut
-- et sait réafficher le formulaire sans redemander quoi que ce soit.
--
-- Aucun avis n'est public à la seconde où il est déposé : il naît `PENDING` et
-- n'entre dans la moyenne qu'une fois publié par l'équipe (`PUBLISHED`), pour
-- qu'un message injurieux ne s'affiche jamais sur une fiche produit.

CREATE TYPE "public"."review_status" AS ENUM('PENDING', 'PUBLISHED', 'HIDDEN');--> statement-breakpoint

CREATE TABLE "order_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"user_id" text,
	"phone_normalized" text,
	"author_name" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"on_time" boolean,
	"status" "review_status" DEFAULT 'PENDING' NOT NULL,
	"reply" text,
	"replied_at" timestamp with time zone,
	"replied_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "product_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"order_id" text NOT NULL,
	"order_item_id" text,
	"user_id" text,
	"phone_normalized" text,
	"author_name" text NOT NULL,
	"rating" integer NOT NULL,
	"title" text,
	"comment" text,
	"status" "review_status" DEFAULT 'PENDING' NOT NULL,
	"reply" text,
	"replied_at" timestamp with time zone,
	"replied_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "order_reviews" ADD CONSTRAINT "order_reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_reviews" ADD CONSTRAINT "order_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_reviews" ADD CONSTRAINT "order_reviews_replied_by_users_id_fk" FOREIGN KEY ("replied_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_replied_by_users_id_fk" FOREIGN KEY ("replied_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Une seule note de livraison par commande, un seul avis par article commandé.
CREATE UNIQUE INDEX "order_reviews_order_key" ON "order_reviews" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_reviews_status_idx" ON "order_reviews" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_reviews_order_product_key" ON "product_reviews" USING btree ("order_id","product_id");--> statement-breakpoint
CREATE INDEX "product_reviews_product_idx" ON "product_reviews" USING btree ("product_id","status","created_at");--> statement-breakpoint
CREATE INDEX "product_reviews_status_idx" ON "product_reviews" USING btree ("status","created_at");
