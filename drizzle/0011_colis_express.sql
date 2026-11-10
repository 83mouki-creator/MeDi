-- Perokado — expéditions suivies chez Colis Express.
--
-- Le transporteur branché dans l'administration renvoie un code de suivi
-- (`CLI-XXXXXX`) qu'on ne peut pas deviner : il est saisi (ou créé) depuis
-- /admin/expeditions, puis recopié ici pour être affiché au client dans son
-- suivi de commande.
--
-- Ajouts sur `shipments` :
--   tracking_url         lien public de suivi chez le transporteur ;
--   destination_city     ville annoncée au transporteur ;
--   provider_status      dernier libellé de statut lu chez le transporteur ;
--   provider_checked_at  date de la dernière synchronisation ;
--   statut « ARRIVED »   colis arrivé en agence, en attente de retrait/livraison
--                        (l'étape intermédiaire de Colis Express).

ALTER TYPE "shipment_status" ADD VALUE IF NOT EXISTS 'ARRIVED' BEFORE 'DELIVERED';--> statement-breakpoint

ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "tracking_url" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "destination_city" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "provider_status" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "provider_checked_at" timestamp with time zone;--> statement-breakpoint

-- Retrouver une expédition par son code de suivi (écran d'expédition, suivi client).
CREATE INDEX IF NOT EXISTS "shipments_tracking_idx" ON "shipments" ("tracking_number");
