# Import du catalogue (CSV)

## Colonnes

En-tête obligatoire, ordre libre, séparateur `;` ou `,`.

| Colonne | Obligatoire | Contenu |
| --- | --- | --- |
| `sku` | oui | référence unique (`MED-0001`). Sert de clé de mise à jour. |
| `nom` | oui | 3 caractères minimum |
| `prix` | oui | entier en FCFA, strictement positif (pas de décimale) |
| `stock` | oui | entier ≥ 0 |
| `categorie` | non | créée automatiquement si inconnue |
| `marque` | non | créée automatiquement si inconnue |
| `description_courte` | non | affichée sous le nom |
| `description` | non | texte long (laisser vide pour conserver l'existant) |
| `prix_promo` | non | doit être inférieur au prix normal |
| `mots_cles` | non | séparés par `|` ou `,` — améliore la recherche (synonymes) |
| `seuil_stock_faible` | non | seuil d'alerte spécifique |
| `precommande` | non | `1`/`oui` pour autoriser la commande à stock nul |

Les alias anglais (`sku`, `name`, `price`, `stock`, `category`, `brand`…) sont acceptés.

## Exemple

```csv
sku;nom;prix;stock;categorie;marque;description_courte;prix_promo;mots_cles
MED-0001;Perceuse à percussion 850 W;42000;12;Outillage électroportatif;Nasco;Mandrin 13 mm, 850 W;38000;perceuse visseuse foreuse
MED-0002;Ciment CPJ 45 50 kg;4800;300;Matériaux de base;;Sac de 50 kg;;ciment cpj
```

## Import

```bash
npm run import:catalog -- --file=./data/catalogue.csv --dry-run   # simulation : rien n'est écrit
npm run import:catalog -- --file=./data/catalogue.csv             # import réel
```

Ou depuis `/admin/import` (téléversement du fichier, simulation puis import), avec le rapport ligne
par ligne affiché dans l'interface.

## Règles

1. Un `sku` existant est **mis à jour** (nom, prix, stock, descriptions, promo, mots-clés), jamais
   dupliqué.
2. Toute ligne invalide est **rejetée avec un motif** et n'écrit rien ; les autres lignes sont
   importées normalement.
3. Une référence dupliquée dans le même fichier est rejetée (seule la première occurrence compte).
4. Le texte de recherche (`search_text`) est recalculé à chaque import : nom, référence, marque,
   catégorie, description courte, mots-clés et caractéristiques.
5. Un import ne modifie **jamais** les images, les commandes ni l'historique.

## Après l'import

- Vérifier les prix et stocks : `/admin/produits`.
- Compléter les fiches incomplètes (description, caractéristiques, garantie).
- Rattacher les photos puis lancer `npm run reindex:visual`.
- Un produit dont le prix ou le stock est inconnu **ne doit pas être publié** : laissez-le inactif
  jusqu'à validation.
