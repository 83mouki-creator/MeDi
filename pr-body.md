## Ce que cette PR corrige

### 1. L'administration n'est plus mélangée à la boutique

Vous voyiez dans `/admin` le **panier client** et la **barre de recherche du site**. C'est corrigé à la racine :
les pages publiques vivent maintenant dans un groupe de routes `src/app/(site)/` avec **leur** mise en page
(en-tête, panier, pied de page), et `/admin` a la sienne (`src/app/admin/layout.tsx` + `AdminTopBar`).
Les URL publiques sont inchangées.

Vérifié sur `/admin` : `aria-label="Panier"` → 0, « Rechercher un produit » → 0, navigation « Catégories » → 0,
`<footer>` → 0.

### 2. Tous les onglets sont derrière le bouton à trois traits

Un seul déclencheur (`aria-expanded`, `aria-controls="menu-administration"`, libellé « Ouvrir le menu de
l'administration », compteur de paiements à vérifier) ouvre un panneau qui glisse depuis la gauche
(`-translate-x-full` → `0`). Fermeture par Échap, par le voile, ou automatiquement à la navigation ;
`aria-hidden` + `inert` quand il est fermé. Aucun onglet n'est visible en permanence, mobile comme bureau.
Les entrées restent filtrées par rôle.

### 3. Audit complet et corrections

| Anomalie trouvée | Correction |
| --- | --- |
| `/admin/commandes?status=NEW` → **erreur 500** (comparaison à une énumération PostgreSQL) | statut et moyen de paiement validés avant la requête, valeurs inconnues ignorées |
| `/admin/commandes?from=2026-13-45` → erreur 500 | dates invalides ignorées (`safeDate`) |
| `/admin/produits?q=%00` (octet nul) → erreur 500 | `sanitizeSearch()` : caractères de contrôle retirés, longueur bornée |
| `?page=99999999999999999999` → erreur 500 (débordement d'OFFSET) | `parsePage()` : page bornée, appliquée aux listes publiques et admin |
| Écran Stock muet (aucun compteur, aucune recherche, aucune pagination) | compteurs réels (suivis / sous seuil / épuisés), recherche, filtre, pagination, 25 lignes par page |
| Libellés faux dans le pied de page (« Nous trouver (plan et GPS) » vers une page qui n'en parlait pas) | libellé aligné sur le contenu |
| Lien « Promotions » de l'en-tête menant à une page vide (0 promotion active) | lien affiché uniquement s'il existe au moins une promotion **réellement dans sa fenêtre de dates** |
| Bloc « Promotions en cours » de l'accueil sélectionnant des promos expirées | même fenêtre de validité que la fiche produit |
| « Meilleures ventes » annoncées sans classement réel | section basée sur les ventes réellement encaissées, masquée tant qu'aucune vente n'existe |
| Tableaux d'administration débordant sur petit écran | défilement horizontal propre sur les catégories et les mouvements de stock |
| Messages du formulaire de contact jamais visibles dans le back-office | **nouvel écran « Demandes clients »** : message, coordonnées, prise en charge, clôture, réouverture, compteur dans le menu et KPI sur le tableau de bord |
| Journal d'activité sans recherche | recherche par action, opérateur ou entité |
| Page d'activation sans retour vers la boutique | lien « Retour à la boutique » |

### 4. Vérifications

- `npx tsc --noEmit` : aucune erreur.
- `npm run build` : compilation réussie.
- `npm run test` : **109 tests, 13 fichiers, 109 réussis** (dont 15 nouveaux cas : écran Stock, demandes clients,
  robustesse des filtres).
- Parcours automatisé de **191 pages publiques** (`0` non-200) et **60 routes d'administration** (`0` non-200),
  liens internes sans impasse.
- Balayage de ~1 500 variantes d'URL (`q`, `status`, `page`, `filter`, `from`, `to`, texte, `%00`, `%25`, valeurs
  absurdement grandes) sur 19 écrans : **0 erreur serveur restante**.
- Contrôles d'intégration : chaque `name=` du formulaire de commande est lu par l'action ; chaque `name=` des
  formulaires paramètres et produit est lu par son action (aucun champ orphelin, aucun bouton mort).

### 5. Documentation

`README.md` (arborescence), `docs/ADMINISTRATION.md` (navigation et nouveaux écrans), `docs/ETAT-DU-PROJET.md`,
`docs/TESTS.md`, `docs/INSTALLATION.md` mis à jour.

## Points hors code, inchangés

Cloudinary n'est pas configuré en production (stockage local éphémère sur Vercel), les identifiants Wave et les
coordonnées complètes de la boutique restent à fournir, et la page `/activation` de production doit être
revérifiée sur l'hôte de déploiement. Rien de tout cela n'est simulé dans le code.
