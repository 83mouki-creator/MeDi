# Sauvegardes et restauration

## Ce qui doit être sauvegardé

1. **Base PostgreSQL** (Neon) : produits, commandes, clients, paiements, mouvements de stock,
   journal d'audit.
2. **Images produits** : Cloudinary (ou stockage objet). Elles ne sont pas dans la base.
3. **Secrets et configuration** : variables d'environnement (gestionnaire de secrets, pas Git).

## Neon

- Activer la **restauration à un instant donné (PITR)** sur le projet : c'est le mécanisme principal.
- Vérifier la fenêtre de rétention (selon l'offre) et la documenter ici pour la boutique.
- Créer une **branche** Neon avant toute opération risquée (migration lourde, import massif).

## Export logique régulier

```bash
# avec pg_dump installé localement, via la connexion DIRECTE
pg_dump "$DIRECT_URL" --format=custom --no-owner --no-privileges --file="medi-$(date +%F).dump"
```

Conserver au minimum : un export hebdomadaire hors du fournisseur, et un export avant chaque
opération structurante.

## Restauration

```bash
# sur une base vide (jamais directement en production sans validation)
pg_restore --no-owner --no-privileges --dbname="$DIRECT_URL" medi-2026-10-28.dump
npm run db:migrate   # vérifie que le schéma est à jour
```

Après restauration : vérifier `/api/health`, la connexion administrateur, une fiche produit, une
commande récente, puis relancer `npm run reindex:visual` si les images ont été réimportées.

## Images

- Cloudinary : conserver la configuration du dossier (`CLOUDINARY_FOLDER`) et vérifier la politique de
  rétention. Un export périodique des originaux est recommandé pour les 200+ photos du catalogue.
- Stockage local (développement) : `public/uploads/` est exclu de Git ; ce dossier n'est pas sauvegardé
  automatiquement.

## Procédure de contrôle (à exécuter une fois par trimestre)

1. Restaurer un export sur une base de test (`medi_test`).
2. Lancer `npm run test` contre cette base.
3. Comparer le nombre de commandes et le chiffre d'affaires encaissé avec la production.
4. Noter la date, l'opérateur et le résultat dans le registre interne de la boutique.
