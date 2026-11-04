-- Le nom de la boutique devient « MeDi Shop ».
--
-- La valeur par défaut de la colonne change pour les nouvelles installations, et
-- la boutique déjà en service est renommée : la migration s'applique donc aussi
-- à la base de production, sans intervention manuelle dans l'administration.
ALTER TABLE "store_settings" ALTER COLUMN "store_name" SET DEFAULT 'MeDi Shop';
--> statement-breakpoint
UPDATE "store_settings" SET "store_name" = 'MeDi Shop' WHERE "store_name" = 'MeDi';
