-- Perokado — prix d'achat figé au moment de la commande.
--
-- `products.purchase_price` peut changer à tout moment (nouveau tarif
-- fournisseur). Sans copie sur la ligne de commande, le bénéfice d'une vente
-- passée serait recalculé avec le prix d'achat d'aujourd'hui : le tableau de
-- bord afficherait un chiffre faux. On fige donc la valeur à la création de la
-- commande ; NULL signifie « prix d'achat inconnu à cette date » et la ligne est
-- alors exclue du bénéfice plutôt que comptée à zéro.

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "purchase_price_snapshot" numeric(12, 2);--> statement-breakpoint

-- Reprise de l'existant : on recopie le prix d'achat actuel du produit pour les
-- commandes qui n'ont pas encore de valeur figée. Approximation assumée une
-- seule fois, uniquement quand le produit existe toujours.
UPDATE "order_items" oi
SET "purchase_price_snapshot" = p."purchase_price"
FROM "products" p
WHERE oi."product_id" = p."id"
  AND oi."purchase_price_snapshot" IS NULL
  AND p."purchase_price" IS NOT NULL;
