-- Recherche visuelle : empreintes recalculées une fois pour toutes.
--
-- Les vignettes du catalogue ont été régénérées (nouveaux bandeaux MeDi Shop) ;
-- leurs empreintes visuelles dataient d'avant et ne sont recalculées que pour
-- les images sans empreinte. On efface donc toutes les empreintes : la reprise
-- `reindex:visual` — rejouée à chaque déploiement juste après cette migration —
-- les recalcule sur les images actuelles. Une image inchangée retrouve donc une
-- empreinte fidèle, sans aucune retouche manuelle.
--
-- Aucune colonne n'est créée : la table garde strictement le même schéma.
UPDATE "product_images"
   SET "embedding" = NULL,
       "embedding_model" = NULL,
       "embedding_dim" = NULL,
       "embedding_at" = NULL;--> statement-breakpoint
