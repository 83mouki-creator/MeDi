# Installation locale

## Prérequis

- **Node.js ≥ 20.19** (testé avec Node 22.22.3) et npm
- Aucun PostgreSQL système n'est nécessaire : le dépôt embarque un PostgreSQL local
  (`embedded-postgres`) pour le développement.

## Étapes

```bash
npm install
cp .env.example .env.local
```

Renseignez au minimum `DATABASE_URL`. Pour un développement 100 % local, laissez la valeur fournie
dans `.env.example` adaptée au cluster embarqué, ou utilisez :

```
DATABASE_URL="postgres://medi:medi@127.0.0.1:55432/medi"
```

Puis :

```bash
npm run db:local     # démarre PostgreSQL local (UTF-8, fuseau Africa/Abidjan) — laisser tourner
npm run db:migrate   # applique drizzle/0000_init.sql + migrations suivantes
npm run db:seed      # données de démonstration (préfixées DÉMO)
npm run admin:create # compte OWNER : e-mail + mot de passe (12 caractères minimum)
npm run reindex:visual
npm run dev
```

- Boutique : <http://localhost:3000>
- Administration : <http://localhost:3000/admin>
- Santé technique : <http://localhost:3000/api/health>

## Variables d'environnement

Toutes les variables sont documentées dans `.env.example`. Les secrets (`DATABASE_URL`,
`DIRECT_URL`, clés Wave, Cloudinary, `CRON_SECRET`) ne doivent jamais être commités ni exposés au
navigateur : `.env.local` et `.env*` sont ignorés par Git.

## Base de données locale

`npm run db:local` lance un cluster PostgreSQL dans `.localdb/` (ignoré par Git) :

- port **55432**, utilisateur/mot de passe `medi`/`medi`, base `medi`
- encodage **UTF-8** (accents corrects), fuseau `Africa/Abidjan`
- réinitialisation complète : `npm run db:reset` puis `npm run db:seed`

## Tests

```bash
npm run test:setup   # crée medi_test et applique les migrations
npm run test         # 109 tests d'intégration
```

La base de test est distincte : les tests vident leurs tables, jamais celles de la boutique.

## Problèmes fréquents

| Symptôme | Cause / solution |
| --- | --- |
| `DATABASE_URL est manquant` | `.env.local` absent ou non chargé (les scripts utilisent `--env-file-if-exists=.env.local`) |
| `relation "order_number_seq" does not exist` | migrations incomplètes : `npm run db:migrate` |
| accents cassés (Ã©) | cluster créé sans UTF-8 : supprimer `.localdb/`, relancer `npm run db:local` |
| recherche visuelle vide | photos non indexées : `npm run reindex:visual` |
| build sans accès Internet | la police est celle du système (aucun téléchargement de police au build) |
