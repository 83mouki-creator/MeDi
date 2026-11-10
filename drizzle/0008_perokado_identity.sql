-- Perokado — reprise des données de la boutique déjà en service.
--
-- La plateforme s'appelait « MeDi Shop ». Elle devient **Perokado**, avec le
-- slogan « Tout ce que vous cherchez au même endroit. ». Aucune donnée
-- commerciale n'est inventée : seuls le nom et le slogan sont renseignés, et
-- uniquement s'ils portaient encore l'ancienne valeur.
--
-- Le numéro WhatsApp / Wave marchand, l'adresse et les horaires restent ceux
-- saisis dans /admin/parametres (aucune valeur n'est écrasée).

UPDATE "store_settings" SET "store_name" = 'Perokado' WHERE "store_name" = 'MeDi Shop';--> statement-breakpoint
UPDATE "store_settings" SET "store_name" = 'Perokado' WHERE "store_name" = 'MeDi';--> statement-breakpoint
UPDATE "store_settings" SET "store_name" = 'Perokado' WHERE "store_name" IS NULL OR btrim("store_name") = '';--> statement-breakpoint
UPDATE "store_settings"
   SET "tagline" = 'Tout ce que vous cherchez au même endroit.'
 WHERE "tagline" IS NULL OR btrim("tagline") = '';--> statement-breakpoint
-- Le retrait en magasin disparaît du parcours : la boutique ne propose plus que
-- la livraison. Les zones de retrait existantes sont désactivées (elles restent
-- en base pour l'historique des commandes passées).
UPDATE "delivery_zones" SET "is_active" = false WHERE "is_pickup" = true;--> statement-breakpoint
UPDATE "store_settings" SET "allow_pickup" = false;
