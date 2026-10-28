# Déploiement (Vercel)

## 1. Préparer la base

Voir [`NEON.md`](NEON.md). Récupérer `DATABASE_URL` (poolée) et `DIRECT_URL` (directe).

## 2. Variables d'environnement Vercel

| Variable | Obligatoire | Remarque |
| --- | --- | --- |
| `DATABASE_URL` | oui | connexion poolée |
| `DIRECT_URL` | oui | migrations |
| `APP_URL` | oui | URL publique exacte (`https://…`), utilisée pour les liens Wave et le plan du site |
| `WAVE_MODE` | oui | `MANUAL` tant que l'intégration Wave n'est pas validée |
| `WAVE_API_KEY`, `WAVE_WEBHOOK_SECRET` | si `WAVE_MODE=AUTO` | secrets Wave Business |
| `STORAGE_DRIVER` + identifiants Cloudinary | recommandé | sinon les fichiers sont écrits dans le système de fichiers de la fonction (non persistant) |
| `VISION_PROVIDER` (+ `VISION_API_URL`, `VISION_API_KEY`) | non | `local` par défaut |
| `CRON_SECRET` | oui pour le cron | protège `/api/cron/expire-reservations` |
| `UPLOAD_MAX_BYTES`, `DATABASE_POOL_MAX` | non | valeurs par défaut sûres |

Ne jamais exposer `DATABASE_URL` avec un préfixe `NEXT_PUBLIC_`.

## 3. Migrations avant mise en ligne

```bash
# en local, avec les identifiants de production dans l'environnement
DIRECT_URL="postgresql://…" npm run db:migrate
```

(Ou une étape dédiée dans le pipeline, exécutée avec `DIRECT_URL`.)

## 4. Créer le compte administrateur

Aucun compte n'est créé par les migrations et aucun mot de passe par défaut n'existe.

```bash
MEDI_ADMIN_EMAIL="direction@exemple.ci" MEDI_ADMIN_PASSWORD="…" MEDI_ADMIN_ROLE=OWNER npm run admin:create
```

Exécuter cette commande depuis un poste de confiance avec `DATABASE_URL` pointant sur la production,
puis supprimer les variables de la session shell.

## 5. Build et déploiement

```bash
npm run build     # vérifié localement : compilation et rendu serveur sans erreur
```

Sur Vercel, l'import du dépôt suffit (framework détecté : Next.js). Les pages sont rendues à la
demande (`ƒ`) car elles dépendent du stock et des réglages : ne pas activer de cache statique global
sur le catalogue.

## 6. Tâche planifiée

`GET /api/cron/expire-reservations` libère les réservations de stock expirées (commande non payée
dans le délai configuré). Exemple de `vercel.json` :

```json
{
  "crons": [{ "path": "/api/cron/expire-reservations", "schedule": "*/15 * * * *" }]
}
```

L'en-tête `Authorization: Bearer $CRON_SECRET` doit être envoyé ; sans `CRON_SECRET`, la route
répond 503 (aucune exécution possible).

## 7. Webhook Wave

Si `WAVE_MODE=AUTO`, enregistrer l'URL `https://votre-domaine/api/wave/webhook` dans le tableau de
bord Wave. Le secret de signature doit correspondre à `WAVE_WEBHOOK_SECRET`. Voir
[`WAVE.md`](WAVE.md).

## 8. Après déploiement — vérifications

1. `/api/health` → `status: ok`, `database: true`.
2. Connexion `/connexion` avec le compte administrateur, puis `/admin`.
3. Saisir les coordonnées réelles, la grille de livraison, le numéro Wave dans `/admin/parametres`
   et `/admin/livraison`.
4. Importer les photos et le catalogue, lancer `npm run reindex:visual`.
5. Tester une commande de bout en bout : retrait, livraison locale, hors Daloa (prépaiement).
6. Vérifier sur mobile réel (caméra de la recherche visuelle : HTTPS obligatoire).
