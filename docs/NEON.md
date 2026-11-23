# Neon — base de données de production

## Deux connexions, deux usages

| Variable | Type | Usage |
| --- | --- | --- |
| `DATABASE_URL` | connexion **poolée** (hôte contenant `-pooler`) | application (pages, Server Actions, routes API) |
| `DIRECT_URL` | connexion **directe** | migrations, imports, sauvegardes, scripts |

### Où trouver l'URL directe ?

| Origine de la base | Variable déjà posée par l'intégration | À faire |
| --- | --- | --- |
| Création manuelle sur neon.com | — | copier la chaîne « sans *Connection pooling* » dans `DIRECT_URL` |
| Intégration **Neon sur Vercel** | `DATABASE_URL_UNPOOLED` | rien : elle est détectée automatiquement |
| Ancien **Vercel Postgres** (migré Neon) | `POSTGRES_URL_NON_POOLING` | rien : détectée automatiquement |
| Seule l'URL poolée est disponible | `DATABASE_URL` | rien : le suffixe `-pooler` est retiré de l'hôte pour obtenir le endpoint direct |

Ordre de résolution utilisé par `npm run db:migrate` (et par drizzle-kit) :
`DIRECT_URL` → `DATABASE_URL_UNPOOLED` → `POSTGRES_URL_NON_POOLING` → `DATABASE_URL` sans `-pooler`.
Le script affiche la source retenue pour lever toute ambiguïté.

Sur neon.com : projet → bouton **Connect** → décocher **Connection pooling** → la chaîne affichée
est l'URL directe (hôte sans `-pooler`).

La connexion poolée passe par PgBouncer : elle ne garantit pas les verrous DDL. Les migrations
doivent donc **toujours** être exécutées via `DIRECT_URL` (`npm run db:migrate`).

## Création

1. Créer un projet Neon dans la région la plus proche des utilisateurs (Europe de l'Ouest par défaut).
2. Créer la base `medi` (laisser la base `medi_test` pour la suite de tests si vous l'exécutez à distance).
3. Copier les deux chaînes de connexion dans les variables d'environnement (Vercel + local), avec
   `?sslmode=require`.

## Migrations

```bash
# après modification de src/db/schema.ts
npm run db:generate          # produit drizzle/000N_xxx.sql (à relire avant commit)
npm run db:migrate           # applique sur DIRECT_URL
```

Le dossier `drizzle/` est versionné : c'est l'historique de schéma. Ne modifiez jamais une migration
déjà appliquée en production ; créez-en une nouvelle.

La première migration (`0000_init.sql`) contient, en plus des tables : l'extension `pg_trgm`, les
index trigrammes, l'index GIN de recherche plein texte, les contraintes `CHECK` (stock ≥ 0, prix > 0,
promotions cohérentes), la séquence `order_number_seq` (numéros de commande `MED-AAAA-NNNNN`) et la
ligne de réglages unique.

## Extensions

- `pg_trgm` : **requise** (tolérance aux fautes de frappe, recherche par similarité).
- `vector` (pgvector) : **optionnelle**. Si l'extension est disponible sur le projet Neon, les
  vecteurs sont également écrits dans `product_image_vectors` ; sinon la similarité est calculée
  côté application à partir de `product_images.embedding` (jsonb). Aucune fonctionnalité ne
  dépend de pgvector.

## Rôles et sécurité

- Utiliser un rôle applicatif limité (SELECT/INSERT/UPDATE/DELETE) pour `DATABASE_URL`, et un rôle
  disposant des droits DDL pour `DIRECT_URL` si votre organisation le permet.
- Activer les sauvegardes / PITR du projet Neon et vérifier la fenêtre de restauration.
- Les secrets ne sont jamais écrits dans le dépôt : utilisez les variables d'environnement Vercel.

## Vérification

```bash
npm run db:migrate     # doit terminer par « Base à jour. »
curl https://votre-domaine/api/health
```

`/api/health` renvoie `{"status":"ok","checks":{"database":true,…}}` sans exposer de secret.
