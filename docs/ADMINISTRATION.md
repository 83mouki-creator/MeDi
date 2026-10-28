# Administration

## Accès

- URL : `/admin` (aucun lien public depuis la boutique).
- Authentification : e-mail + mot de passe (scrypt, sessions serveur), **pas d'inscription publique**.
- Aucun mot de passe par défaut n'existe : le premier compte se crée en ligne de commande
  (voir plus bas) ou par un OWNER depuis `/admin/utilisateurs`.
- Limitation des tentatives de connexion (8 échecs / 15 minutes par e-mail et par IP) et verrouillage
  temporaire du compte.

## Rôles et permissions

| Permission | STOCK_MANAGER | ORDER_MANAGER | ADMIN | OWNER |
| --- | --- | --- | --- | --- |
| `products.read` | ✔ | ✔ | ✔ | ✔ |
| `products.write` | ✔ | — | ✔ | ✔ |
| `orders.read` | ✔ | ✔ | ✔ | ✔ |
| `orders.write` | — | ✔ | ✔ | ✔ |
| `payments.confirm` | — | — | ✔ | ✔ |
| `settings.write` | — | — | ✔ | ✔ |
| `users.manage` | — | — | — | ✔ |
| `audit.read` | — | — | ✔ | ✔ |

Les contrôles sont effectués **côté serveur** (`requirePermission`) dans chaque Server Action
sensible, pas seulement dans l'interface. Les actions d'administration sont journalisées
(`audit_logs` : auteur, action, entité, métadonnées, IP).

## Créer un compte administrateur

```bash
npm run admin:create -- --email=direction@exemple.ci --role=OWNER --name="Direction"
```

Le mot de passe est demandé en interactif (ou via `MEDI_ADMIN_PASSWORD` pour un pipeline). Règles :
12 caractères minimum, majuscule, minuscule, chiffre, caractère spécial. Un compte existant est mis à
jour (rôle, mot de passe, réactivation) et l'opération est journalisée.

## Cartographie des écrans

| Écran | Contenu |
| --- | --- |
| `/admin` | tableau de bord : chiffre d'affaires encaissé, commandes par statut, paiements à vérifier, stocks faibles, meilleures ventes, dernières commandes, alertes de configuration |
| `/admin/produits` | liste filtrable (recherche, inactifs, stock faible, archivés), accès aux fiches |
| `/admin/produits/nouveau`, `/admin/produits/[id]` | création / édition : prix FCFA, promotion avec fenêtre de dates, stock, seuil d'alerte, précommande, catégorie, marque, mots-clés, caractéristiques, photos, archivage |
| `/admin/stock` | ajustements de stock avec motif obligatoire (delta ou valeur cible) et historique des mouvements |
| `/admin/categories` | catégories (arborescence) et marques |
| `/admin/commandes` | recherche (numéro, client, téléphone), filtres statut / paiement / ville, pagination |
| `/admin/commandes/[id]` | détail, articles, historique horodaté, changement de statut, vérification du paiement (confirmer / refuser avec justification), expédition et suivi, note interne |
| `/admin/paiements` | paiements à vérifier, historique des confirmations, mode Wave actif |
| `/admin/livraison` | zones, frais, seuil de gratuité, délai, retrait, activation |
| `/admin/parametres` | coordonnées, horaires, numéro Wave, paiement à la livraison (activation + plafond), réservation, textes légaux, état des intégrations (sans afficher les secrets) |
| `/admin/import` | import CSV (simulation puis import), import de photos en masse, affectation des photos, réindexation visuelle |
| `/admin/utilisateurs` | création de comptes internes, rôles, activation/désactivation |
| `/admin/journal` | journal d'audit |
| `/admin/statistiques` | ventes, répartition des paiements et livraisons, meilleures ventes, recherches sans résultat |

## Règles de gestion clés

- **Prix** : entier en FCFA. Une promotion n'est active que dans sa fenêtre de dates et si
  `0 < prix promo < prix normal`.
- **Stock** : `stock` physique et `reserved` (paniers validés en attente de paiement). La
  disponibilité affichée est `stock − reserved`. Un ajustement de stock exige un motif et crée un
  mouvement.
- **Dernière unité** : la réservation est faite dans une transaction avec verrou `FOR UPDATE` ; deux
  commandes simultanées ne peuvent pas acheter la même unité (test automatisé).
- **Paiement** : confirmation réservée aux rôles ADMIN/OWNER, idempotente (double clic sans effet) et
  journalisée avec le motif saisi.
- **Expédition hors Daloa** : impossible tant que le paiement n'est pas confirmé.
- **Archivage** : un produit archivé disparaît de la boutique mais conserve son historique de
  commandes (instantanés de nom, référence et prix dans les lignes de commande).

## Bonnes pratiques

1. Créer un compte nominatif par personne (pas de compte partagé) : le journal d'audit est nominatif.
2. Désactiver immédiatement le compte d'un collaborateur qui quitte la boutique.
3. Ne jamais saisir de mot de passe dans un champ qui n'est pas celui prévu (les mots de passe ne sont
   jamais affichés par l'application).
4. Vérifier les paiements Wave directement sur le compte marchand avant toute confirmation.
