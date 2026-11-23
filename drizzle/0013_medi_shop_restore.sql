-- MeDi Shop — restauration des réglages de la boutique.
--
-- La boutique redevient **MeDi Shop**, avec son numéro historique
-- +225 07 08 90 48 91 (WhatsApp), utilisé aussi pour Wave / compte marchand.
-- La mise à jour ne touche que les valeurs posées sous l'ancienne enseigne :
-- une valeur choisie ensuite dans /admin/parametres n'est jamais écrasée.
-- Le slogan « Tout ce que vous cherchez au même endroit. » est conservé.

UPDATE "store_settings"
   SET "store_name" = 'MeDi Shop'
 WHERE lower(btrim(coalesce("store_name", ''))) IN ('perokado', '');--> statement-breakpoint

UPDATE "store_settings"
   SET "wave_merchant_name" = 'MeDi Shop'
 WHERE lower(btrim(coalesce("wave_merchant_name", ''))) IN ('perokado', '');--> statement-breakpoint

UPDATE "store_settings"
   SET "whatsapp" = '+225 07 08 90 48 91'
 WHERE regexp_replace(coalesce("whatsapp", ''), '\D', '', 'g') IN ('2250544014182', '0544014182');--> statement-breakpoint

UPDATE "store_settings"
   SET "phone" = '+225 07 08 90 48 91'
 WHERE regexp_replace(coalesce("phone", ''), '\D', '', 'g') IN ('2250544014182', '0544014182')
    OR "phone" IS NULL
    OR btrim("phone") = '';--> statement-breakpoint

UPDATE "store_settings"
   SET "wave_number" = '+225 07 08 90 48 91'
 WHERE regexp_replace(coalesce("wave_number", ''), '\D', '', 'g') IN ('2250544014182', '0544014182');--> statement-breakpoint

UPDATE "store_settings"
   SET "psp_merchant_number" = '+225 07 08 90 48 91'
 WHERE regexp_replace(coalesce("psp_merchant_number", ''), '\D', '', 'g') IN ('2250544014182', '0544014182');
