-- Perokado — un seul numéro, partout.
--
-- Le numéro WhatsApp Business de la boutique (+225 05 44 01 41 82) devient aussi
-- le numéro marchand Wave / prestataire de paiement. Sans cette reprise, la base
-- de production continuerait d'afficher l'ancien numéro de test
-- (`+225 07 08 90 48 91`) que `config:store` n'écrase pas (il ne remplit que les
-- champs vides).
--
-- La mise à jour est limitée aux valeurs connues de l'ancien numéro : une valeur
-- choisie plus tard dans /admin/parametres n'est jamais écrasée.

UPDATE "store_settings"
   SET "whatsapp" = '+225 05 44 01 41 82',
       "phone" = '+225 05 44 01 41 82'
 WHERE regexp_replace(coalesce("whatsapp", ''), '\D', '', 'g') IN ('2250708904891', '0708904891')
    OR regexp_replace(coalesce("phone", ''), '\D', '', 'g') IN ('2250708904891', '0708904891')
    OR "whatsapp" IS NULL
    OR btrim("whatsapp") = '';--> statement-breakpoint

-- Les champs vides sont complétés par le numéro de la boutique.
UPDATE "store_settings"
   SET "phone" = '+225 05 44 01 41 82'
 WHERE "phone" IS NULL OR btrim("phone") = '';--> statement-breakpoint

UPDATE "store_settings"
   SET "wave_number" = '+225 05 44 01 41 82'
 WHERE regexp_replace(coalesce("wave_number", ''), '\D', '', 'g') IN ('2250708904891', '0708904891')
    OR "wave_number" IS NULL
    OR btrim("wave_number") = '';--> statement-breakpoint

UPDATE "store_settings"
   SET "psp_merchant_number" = '+225 05 44 01 41 82'
 WHERE regexp_replace(coalesce("psp_merchant_number", ''), '\D', '', 'g') IN ('2250708904891', '0708904891')
    OR "psp_merchant_number" IS NULL
    OR btrim("psp_merchant_number") = '';--> statement-breakpoint

-- L'enseigne ne doit plus apparaître nulle part, y compris dans une base où la
-- valeur aurait été ressaisie à la main avec l'ancien nom.
UPDATE "store_settings"
   SET "store_name" = 'Perokado'
 WHERE lower(btrim(coalesce("store_name", ''))) IN ('medi shop', 'medi', 'medi shop daloa', '');
