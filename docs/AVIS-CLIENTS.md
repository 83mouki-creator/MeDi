# Avis clients — produits et livraison

Dernière mise à jour : **2026-11-10**.

## En une phrase

Un client ne peut donner son avis **qu'après une commande livrée**, sur les articles qu'il a
réellement reçus **et** sur la livraison elle-même ; son avis n'apparaît sur la boutique qu'après
relecture par l'équipe.

Trois choses en découlent, et c'est ce qui rend le dispositif utilisable dans une quincaillerie de
Daloa plutôt que dans un site de e-commerce à grande échelle :

| Ce qu'on veut éviter | Ce que le module fait |
| --- | --- |
| Les faux avis, les avis achetés, les concurrents qui dénigrent | Aucun formulaire public. Un avis n'existe que rattaché à une commande `DELIVERED` (contrainte de clé étrangère + contrôle applicatif). |
| Un message injurieux affiché sur une fiche produit | Tout avis naît `PENDING` : invisible et hors moyenne jusqu'à publication par l'équipe. |
| Demander au client de créer un compte | Le dépôt se fait depuis le suivi de sa commande (numéro + jeton de suivi reçu à la validation), sans mot de passe. |

## Parcours client

1. Le client commande. Le colis part, arrive, est livré : la commande passe en `DELIVERED`.
2. Il ouvre son suivi — `/suivi/PER-2026-01024?t=…` (lien reçu à la validation) ou
   `/compte/commandes/PER-…` — et voit le bloc **« Votre avis nous aide »**, ouvert par défaut.
   Un compteur indique ce qu'il reste à noter (`0/2`, `1/2`, `2/2`).
3. Il note **la livraison** : 1 à 5 étoiles, « le délai annoncé a-t-il été tenu ? » (oui / non),
   un mot libre sur le livreur ou l'état du colis.
4. Il note **chaque article** : 1 à 5 étoiles, un titre facultatif, un commentaire, et le nom qu'il
   accepte de voir publié (prénom + initiale par défaut, jamais le nom complet).
5. À l'envoi : « Merci ! Votre avis est enregistré. Il sera publié après relecture. »
6. Tant que la commande n'est pas livrée, le bloc affiche seulement : « Vous pourrez noter les
   articles et la livraison dès que la commande sera marquée comme livrée. » Aucun formulaire n'est
   proposé pour rien.

### Règles précises

- **Une note par article et par commande.** Redéposer un avis sur le même article le **corrige** :
  la nouvelle version repasse en relecture (l'ancienne publication ne masque pas une correction).
- **Une note de livraison par commande**, corrigeable de la même manière.
- **Note de 1 ou 2 étoiles : commentaire obligatoire** (10 caractères minimum). Une mauvaise note
  sans explication n'aide ni l'équipe ni les autres clients.
- **Le nom publié est un prénom + initiale** (`Awa K.`). Le nom complet, le téléphone et l'adresse
  ne sortent jamais de l'administration.
- Supprimer son compte ne supprime pas ses avis : ils restent rattachés à la commande, qui est la
  preuve d'achat (la référence au compte passe à `NULL`).

## Parcours boutique

Écran **`/admin/avis`** (droit `messages.handle` — service client, administrateurs, propriétaire) :

- deux onglets : **Produits** et **Livraison** ;
- filtre par statut : *À relire* (par défaut), *Publié*, *Masqué* ;
- pour chaque avis : la note en étoiles, le texte intégral, l'auteur publié, la date, l'article
  (lien vers la fiche) ou le numéro de commande, la mention « Achat vérifié » ;
- trois gestes : **Publier sur la boutique**, **Masquer**, et une **réponse publique de la boutique**
  (signée par l'enseigne, pas par l'agent).

Le menu de l'administration affiche une pastille avec le nombre d'avis à relire, et l'écran
`/admin/pret-a-vendre` contient un point de contrôle « Avis clients à relire » : tant qu'il reste des
avis non lus, le voyant n'est pas vert.

### Où les avis publiés apparaissent

| Endroit | Ce qui s'affiche |
| --- | --- |
| Fiche produit | Note moyenne sous le titre (`★★★★☆ 4,5 · 12 avis`), puis bloc « Avis des clients » avec moyenne, répartition par étoiles et avis détaillés (réponse de la boutique incluse). |
| Fiche produit — SEO | `aggregateRating` et `review` dans les données structurées `Product`, **seulement s'il existe au moins un avis publié**. |
| Accueil et `/livraison` | Bloc « Ce que disent les clients livrés » : les 4 à 6 derniers avis de livraison publiés, avec la mention *Délai tenu* / *En retard*. |
| Suivi de commande et espace client | Les formulaires, et le statut de chaque avis déjà déposé. |

**Rien ne s'affiche s'il n'y a aucun avis publié** : pas de cadre « 0 avis », pas de zéro étoile.
Une nouvelle boutique n'affiche donc rien de plus qu'avant l'arrivée du module.

## Ce qui est en base

Migration `drizzle/0012_avis_clients.sql` :

- `product_reviews` — `product_id`, `order_id`, `order_item_id`, `user_id`, `phone_normalized`,
  `author_name`, `rating`, `title`, `comment`, `status`, `reply`, `replied_at`, `replied_by` ;
  index unique `(order_id, product_id)` : un avis par article et par commande.
- `order_reviews` — `order_id` (unique), `user_id`, `phone_normalized`, `author_name`, `rating`,
  `comment`, `on_time`, `status`, `reply`, `replied_at`, `replied_by`.
- Énumération `review_status` : `PENDING`, `PUBLISHED`, `HIDDEN`.

Code :

| Fichier | Rôle |
| --- | --- |
| `src/lib/review-shared.ts` | Types, libellés, moyennes, validation, nom publié. **Sans accès à la base** (importé par un composant client). |
| `src/lib/reviews.ts` | Lectures, dépôt, modération, compteurs. |
| `src/app/actions/reviews.ts` | Server actions (dépôt client + modération), limitation de débit 8 avis / heure / IP. |
| `src/components/reviews.tsx` | Étoiles, bloc avis produit, formulaires, panneau « Votre avis nous aide », liste livraison. |
| `src/components/admin/review-moderation.tsx` | Boutons publier / masquer / répondre. |
| `src/app/admin/avis/page.tsx` | Écran de relecture. |
| `tests/reviews.test.ts` | 18 tests : règles de calcul et parcours complet contre la base. |

## Ce qui n'est pas fait, volontairement

- **Pas de photo dans les avis.** Un client qui joint une photo oblige la boutique à stocker,
  redimensionner et modérer une image de plus, avec le risque juridique qui va avec. À rouvrir quand
  le stockage d'images sera sur un service durable (`STORAGE_DRIVER`, aujourd'hui `local`).
- **Pas de « nombre de personnes ayant trouvé cet avis utile ».** Sans volume d'avis, ce compteur
  reste à zéro et n'aide personne.
- **Pas de relance automatique par e-mail ou WhatsApp.** La boutique n'a pas de fournisseur d'e-mail
  transactionnel configuré ; une relance passerait par un envoi manuel depuis `/admin/avis`.
  Le lien de suivi envoyé à la livraison suffit aujourd'hui à ramener le client sur la page.
- **Pas de note dans les rails de produits** (accueil, catégories) : cela demanderait une requête
  agrégée par rail pour un gain visuel faible tant que le nombre d'avis reste modeste. La fonction
  `productRatingSummaries()` est déjà prête si on veut l'activer.
