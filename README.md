# MeDi — plateforme e-commerce (Daloa, Côte d'Ivoire)

Application de vente en ligne pour une quincaillerie / fournisseur de matériel industriel et de
bâtiment à Daloa. Interface entièrement en français, montants en **FCFA**, catalogue réel relié à
une base PostgreSQL, panier et commandes recalculés côté serveur, espace d'administration complet
et recherche visuelle par photo.

> État exact du projet, points partiels et données encore attendues : [`docs/ETAT-DU-PROJET.md`](docs/ETAT-DU-PROJET.md).
> Aucune donnée commerciale (téléphone, adresse, horaires, grille tarifaire, numéro Wave,
> identifiants d'entreprise) n'a été inventée : ces informations se saisissent dans
> `/admin/parametres` et `/admin/livraison`.

## Sommaire

| Sujet | Document |
| --- | --- |
| Installation locale | [`docs/INSTALLATION.md`](docs/INSTALLATION.md) |
| Base Neon, connexions poolée / directe | [`docs/NEON.md`](docs/NEON.md) |
| Déploiement Vercel | [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md) |
| Comptes, rôles, création d'un administrateur | [`docs/ADMINISTRATION.md`](docs/ADMINISTRATION.md) |
| Import des 200+ photos | [`docs/IMPORT-PHOTOS.md`](docs/IMPORT-PHOTOS.md) |
| Import du catalogue (CSV) | [`docs/IMPORT-CATALOGUE.md`](docs/IMPORT-CATALOGUE.md) |
| Paiement Wave (réel et manuel) | [`docs/WAVE.md`](docs/WAVE.md) |
| Recherche visuelle | [`docs/RECHERCHE-VISUELLE.md`](docs/RECHERCHE-VISUELLE.md) |
| Sauvegardes et restauration | [`docs/SAUVEGARDES.md`](docs/SAUVEGARDES.md) |
| Données personnelles (Côte d'Ivoire) | [`docs/DONNEES-PERSONNELLES.md`](docs/DONNEES-PERSONNELLES.md) |
| Tests exécutés | [`docs/TESTS.md`](docs/TESTS.md) |

## Stack

- **Next.js 16** (App Router, React Server Components, Server Actions), **TypeScript strict**
- **Tailwind CSS 4** + composants de style shadcn (écrits dans le dépôt, sans dépendance UI lourde)
- **PostgreSQL** (Neon en production) + **Drizzle ORM** et **migrations SQL versionnées** (`drizzle/`)
- Authentification maison : mots de passe **scrypt**, sessions opaques en base, cookie `httpOnly`
- Images : stockage local en développement, **Cloudinary** ou stockage objet en production
- Recherche : PostgreSQL **full-text français** + **pg_trgm** (tolérance aux fautes)
- Recherche visuelle : descripteur perceptif local, ou modèle d'embeddings externe via HTTP
- **Vitest** pour les tests d'intégration sur une base dédiée

## Démarrage rapide (développement)

```bash
npm install
cp .env.example .env.local          # puis renseigner DATABASE_URL
npm run db:local                    # PostgreSQL local embarqué (port 55432 par défaut)
npm run db:migrate                  # applique drizzle/*.sql
npm run db:seed                     # catalogue de démonstration (47 produits, libellés DÉMO)
npm run admin:create                # crée le compte OWNER (mot de passe saisi en interactif)
npm run reindex:visual              # indexe les photos pour la recherche visuelle
npm run dev                         # http://localhost:3000 — administration : /admin
```

Avec une base Neon, remplacez `npm run db:local` par le renseignement de `DATABASE_URL` (poolée) et
`DIRECT_URL` (directe) dans `.env.local`, puis `npm run db:migrate`.

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` / `build` / `start` | serveur de développement / build de production / serveur de production |
| `npm run typecheck` | vérification TypeScript stricte |
| `npm run db:local` | démarre PostgreSQL embarqué (développement uniquement) |
| `npm run db:generate` | génère une migration SQL à partir de `src/db/schema.ts` |
| `npm run db:migrate` | applique les migrations sur `DIRECT_URL` |
| `npm run db:seed` | jeu de données de démonstration |
| `npm run db:reset` | ⚠️ recrée la base **locale** (refusé hors localhost) |
| `npm run admin:create` | crée / met à jour un compte d'administration |
| `npm run import:catalog -- --file=… [--dry-run]` | import CSV du catalogue |
| `npm run import:photos -- --dir=… [--dry-run] [--assign]` | import en masse des photos |
| `npm run reindex:visual` | calcule les empreintes visuelles des photos |
| `npm run test:setup` | prépare la base `medi_test` |
| `npm run test` | exécute la suite Vitest |

## Arborescence

```
src/
  app/                 routes App Router (boutique, compte, admin, api)
    actions/           Server Actions (panier, commande, paiement, admin, contact)
    admin/             back-office protégé par rôle
    api/               recherche, visuelle, webhook Wave, cron, health
  components/          composants d'interface (boutique, compte, admin, ui)
  db/                  schéma Drizzle, connexion, exécuteur de migrations
  lib/                 logique métier (prix, stock, commandes, paiement, recherche…)
drizzle/               migrations SQL versionnées
scripts/               base locale, seed, imports, administration, réindexation
tests/                 suite Vitest (intégration sur base dédiée)
docs/                  documentation d'exploitation
public/brand/          identité visuelle (logo horizontal, favicon carré)
```

## Principes non négociables appliqués

1. **Le serveur fait foi** : prix, frais, stocks et totaux sont recalculés depuis la base ; aucune
   valeur de prix envoyée par le navigateur n'est utilisée.
2. **Pas de fausse disponibilité** : le stock affiché est `stock − réservé`, contrôlé à nouveau dans
   la transaction de commande (une dernière unité ne peut pas être vendue deux fois).
3. **Pas de faux paiement** : la confirmation Wave est soit automatique et signée, soit manuelle par
   un administrateur après vérification de l'encaissement réel. Une capture d'écran ne vaut jamais
   preuve.
4. **Hors Daloa, prépaiement obligatoire** : aucun statut « prête à expédier » ni expédition tant que
   le paiement n'est pas confirmé.
5. **Aucune donnée commerciale inventée** : ce qui manque est signalé comme à compléter, jamais simulé.
6. **Isolation des données** : un client n'accède qu'à ses propres commandes, adresses et
   informations ; le suivi par numéro exige un jeton ou le compte propriétaire.
