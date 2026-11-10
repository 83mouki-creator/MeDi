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

Le mot de passe est demandé en interactif (ou via `PEROKADO_ADMIN_PASSWORD` pour un pipeline). Règles :
12 caractères minimum, majuscule, minuscule, chiffre, caractère spécial. Un compte existant est mis à
jour (rôle, mot de passe, réactivation) et l'opération est journalisée.

## Coordonnées, horaires et barème de livraison

Les informations commerciales connues sont posées automatiquement à chaque déploiement :

```bash
npm run config:store            # ne remplit que les champs encore vides
npm run config:store -- --force # réapplique les valeurs du dépôt (écrase les saisies /admin)
```

Ensuite, tout se modifie dans l'interface :

- `/admin/parametres` : téléphone, WhatsApp, horaires, compte Wave et compte marchand, paiement à la
  livraison et son plafond.
- `/admin/livraison` : zones, frais, seuil de gratuité, délais. Le tunnel de commande lit uniquement
  ces lignes — aucun tarif n'est codé en dur.

### Livraison uniquement : ni retrait, ni carte

Le parcours ne propose plus le **retrait en magasin** et la boutique ne publie plus d'adresse
géographique : le client est livré chez lui, et n'a donc pas besoin de se rendre sur place.

- Les pages « Nous trouver » et la carte ont été retirées du site ; aucun lien ne subsiste.
- Les champs latitude / longitude ne sont plus affichés ni enregistrés dans `/admin/parametres`.
  Les colonnes restent en base (aucune migration destructive) mais sont vidées à chaque
  enregistrement des paramètres.
- Le réglage `allow_pickup` est forcé à `false` par le code : même une ancienne valeur en base ne
  peut plus réactiver un choix de retrait au moment de la commande.
- Ce que le client voit à la place : la page `/livraison` (quartiers de Daloa, frais, villes
  desservies) et le WhatsApp de la boutique pour convenir du transport.


Le logo officiel est décliné automatiquement (`npm run brand:assets`) vers `public/brand/` :
en-tête et pied de page (fond bleu nuit), favicon, icône iOS, image de partage.

## Langue de l'interface : français uniquement

Le site public **et** l'administration sont **entièrement en français**. Il n'y a plus de sélecteur
de langue, plus de cookie de langue et plus aucun texte arabe : l'affichage est toujours de gauche à
droite, pour tout le monde.

Ce que cela implique concrètement :

- les libellés d'écran, boutons, colonnes, messages d'aide et textes d'erreur sont écrits en
  français directement dans les pages ;
- `src/lib/i18n/admin.ts` et `src/lib/i18n/site.ts` ne contiennent plus de dictionnaire : ils
  exposent une fonction `t()` qui ne fait qu'interpoler les variables `{compteur}` ;
- les tests `tests/i18n-admin.test.ts` et `tests/i18n-site.test.ts` échouent si un caractère arabe,
  une variante `rtl:` ou l'ancienne enseigne réapparaît dans le code ;
- les données saisies (produits, catégories, fournisseurs) restent dans leur langue de saisie.

## Navigation

L'administration a sa propre mise en page : **aucun élément de la boutique** n'y apparaît (ni le
panier du client, ni la recherche publique, ni le pied de page commercial). Tous les écrans sont
accessibles depuis un bouton à trois traits en haut à gauche : il ouvre un panneau coulissant qui
referme automatiquement au changement de page, se ferme avec la touche Échap ou en cliquant à côté.
Le bouton affiche un compteur de paiements à vérifier, et le panneau un compteur de nouvelles
demandes clients. Les entrées sont filtrées selon le rôle : un opérateur ne voit pas les écrans
auxquels il n'a pas droit.

## Cartographie des écrans

| Écran | Contenu |
| --- | --- |
| `/admin` | tableau de bord : chiffre d'affaires encaissé, commandes par statut, paiements à vérifier, stocks faibles, meilleures ventes, dernières commandes, alertes de configuration |
| `/admin/produits` | liste filtrable (recherche, inactifs, stock faible, archivés), accès aux fiches |
| `/admin/produits/nouveau`, `/admin/produits/[id]` | création / édition : prix de vente et **prix d'achat** FCFA (bénéfice net affiché en direct), promotion avec fenêtre de dates, stock, seuil d'alerte, précommande, catégorie, marque, mots-clés, caractéristiques, photos, archivage |
| `/admin/stock` | ajustements de stock avec motif obligatoire (delta ou valeur cible) et historique des mouvements |
| `/admin/categories` | catégories (arborescence) et marques |
| `/admin/commandes` | recherche (numéro, client, téléphone), filtres statut / paiement / ville / période, pagination |
| `/admin/messages` | demandes reçues via le formulaire de contact : coordonnées du client, message, prise en charge, clôture, réouverture |
| `/admin/commandes/[id]` | détail, articles, historique horodaté, changement de statut, vérification du paiement (confirmer / refuser avec justification), expédition et suivi, note interne |
| `/admin/paiements` | paiements à vérifier, historique des confirmations, mode Wave actif |
| `/admin/livraison` | zones, frais, seuil de gratuité, délai, activation |
| `/admin/parametres` | coordonnées, horaires, compte Wave et compte marchand, paiement à la livraison (activation + plafond), réservation, textes légaux, état des intégrations (sans afficher les secrets) |
| `/admin/import` | import CSV (simulation puis import), import de photos en masse, affectation des photos, réindexation visuelle |
| `/admin/utilisateurs` | création de comptes internes, rôles, activation/désactivation |
| `/admin/journal` | journal d'audit, recherche par action, opérateur ou entité |
| `/admin/statistiques` | ventes, **bénéfice net total et par produit**, répartition des paiements et livraisons, recherches sans résultat |
| `/admin/stickers` | bibliothèque de vignettes (« Garantie 12 mois », « -20 % ») et affectation à tout le catalogue, à une recherche ou à une sélection |

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
