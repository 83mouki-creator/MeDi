# Tests exécutés

Dernière exécution : **2026-10-31** — `npm run test` → **109 tests, 13 fichiers, 109 réussis, 0 échec**
(`npx tsc --noEmit` : aucune erreur ; `npm run build` : compilation réussie).

Base utilisée : `medi_test` (PostgreSQL local, UTF-8), préparée par `npm run test:setup`.
Les tests vident leurs tables avant chaque cas : ils ne touchent jamais les données de la boutique.

## Couverture par exigence

| Exigence | Test(s) | Résultat |
| --- | --- | --- |
| Création / modification / validation produit | `admin-import.test.ts` (import create + update par SKU, `adminProductSchema`) ; `catalog-search.test.ts` (masquage des produits inactifs/archivés) | ✔ |
| Import CSV : lignes invalides, doublons, simulation | `admin-import.test.ts` (5 cas) | ✔ |
| Recherche par nom, référence, marque, mot-clé, synonyme | `catalog-search.test.ts` | ✔ |
| Tolérance aux fautes de frappe (trigrammes) | `catalog-search.test.ts` (« marteu » → « Marteau ») | ✔ |
| Pagination et filtres du catalogue | `catalog-search.test.ts` (catégorie, prix, tri, stock) | ✔ |
| Totaux du panier recalculés côté serveur, prix client ignoré | `cart-stock.test.ts` | ✔ |
| Promotions : fenêtre de validité, promo ≥ prix refusée | `catalog-search.test.ts`, `cart-stock.test.ts` | ✔ |
| Stock 0 jamais vendu (sauf précommande explicite) | `cart-stock.test.ts` | ✔ |
| Dernière unité : double vente impossible en concurrence | `cart-stock.test.ts` (deux `createOrder` simultanés → 1 succès, stock réservé = 1) | ✔ |
| Commande Daloa : retrait (frais 0, espèces) et livraison locale (frais de zone, paiement à la livraison) | `orders-flow.test.ts` | ✔ |
| Plafond du paiement à la livraison | `orders-flow.test.ts` | ✔ |
| Hors Daloa : prépaiement obligatoire, paiement à la livraison refusé | `orders-flow.test.ts` | ✔ |
| Livraison gratuite au-delà du seuil de zone | `orders-flow.test.ts` | ✔ |
| Référence de paiement client → « paiement à vérifier » (jamais « payé ») | `orders-flow.test.ts` | ✔ |
| Confirmation manuelle par un administrateur | `orders-flow.test.ts` | ✔ |
| Confirmation en double (idempotence) et confirmations simultanées | `orders-flow.test.ts` (stock décrémenté une seule fois) | ✔ |
| Refus de paiement justifié | `orders-flow.test.ts` | ✔ |
| Interdiction d'expédier une commande hors Daloa non payée | `orders-flow.test.ts` (`PREPAYMENT_REQUIRED`) | ✔ |
| Cycle de vie : préparation → prête → expédiée, historique horodaté | `orders-flow.test.ts` | ✔ |
| Annulation et libération du stock | `orders-flow.test.ts` | ✔ |
| Expiration automatique des réservations | `orders-flow.test.ts` (+ route `/api/cron/expire-reservations`) | ✔ |
| Rôles et permissions côté serveur | `authz.test.ts` (matrice 8 permissions × 5 rôles) | ✔ |
| Isolation des commandes entre clients | `orders-flow.test.ts`, `authz.test.ts` | ✔ |
| Mots de passe : scrypt, sel, jamais en clair | `authz.test.ts` | ✔ |
| Téléversement d'image : type réel, taille, normalisation WebP, empreinte | `uploads-visual.test.ts` | ✔ |
| Recherche visuelle : descripteurs, classement réel par similarité, aucun résultat « certain » sans modèle calibré | `uploads-visual.test.ts` | ✔ |
| Écran Stock : compteurs complets, seuil d'alerte, épuisés, recherche, filtre, pagination | `admin-stock.test.ts` (6 cas) | ✔ |
| Demandes clients : compteurs, fil d'attente, filtre de statut, pagination | `admin-messages.test.ts` (4 cas) | ✔ |
| Robustesse des filtres d'administration (URL modifiée : statut inconnu, date invalide, octet nul, page absurde) | `admin-filters.test.ts` (5 cas) | ✔ |

## Ce qui n'est pas couvert par un test automatisé

| Élément | Raison | Vérification effectuée |
| --- | --- | --- |
| Affichage mobile réel (téléphone, caméra) | pas de navigateur mobile dans l'environnement d'exécution | contrôles HTTP des pages + conception mobile-first ; **à valider sur appareil réel avant mise en ligne** |
| Confirmation visuelle des écrans (mise en page, débordements) | idem | rendu serveur vérifié page par page (codes 200, contenus attendus) |
| Webhook Wave réel | nécessite un compte marchand et un secret Wave | signature, anti-rejeu, idempotence et revérification du montant implémentés et relus ; **à tester avec Wave avant activation de `WAVE_MODE=AUTO`** |
| Envoi d'e-mail (réinitialisation de mot de passe) | aucun fournisseur SMTP configuré | la procédure existe ; le lien doit être transmis par la boutique tant qu'aucun e-mail n'est configuré |
| Paiement Wave réel | identifiants non fournis | mode manuel opérationnel, aucun paiement simulé |

## Commandes

```bash
npm run test:setup   # une seule fois (ou après npm run db:reset)
npm run test         # suite complète
npx tsc --noEmit     # TypeScript strict
npm run build        # build de production
```
