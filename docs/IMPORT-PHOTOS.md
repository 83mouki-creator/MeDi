# Import des photos produits (200+)

Deux méthodes : **import en masse par dossier** (recommandé pour 200+ fichiers) et **téléversement
unitaire** depuis la fiche produit.

## Principe de sécurité

- Aucune donnée commerciale n'est déduite d'une photo : **jamais de prix, jamais de stock**.
- Un nom de fichier peut **suggérer** une référence produit (`MED-0001-1.jpg` → `MED-0001`), mais
  l'affectation reste une décision humaine.
- Les doublons sont détectés par empreinte SHA-256 : une même image n'est jamais importée deux fois.
- Les photos importées entrent dans une **file de validation** (`media_assets`, statut `PENDING`)
  avant d'être rattachées à un produit.
- Les fichiers non lisibles ou trop lourds sont refusés et listés, sans interrompre l'import.

## 1. Préparer le dossier

```
photos/
  MED-0001-1.jpg
  MED-0001-2.jpg
  MED-0007-1.jpg
  perceuse-sans-reference.jpg
```

- Formats acceptés : JPEG, PNG, WebP, AVIF. Taille maximale : 15 Mo par fichier à l'import (les
  téléversements depuis l'interface sont limités à 5 Mo).
- Nom conseillé : `<SKU>-<numéro>.<ext>` ; plusieurs photos par produit sont possibles.
- Les accents et espaces dans les noms n'empêchent pas l'import (le nom est normalisé).

## 2. Simulation (obligatoire avant le premier import)

```bash
npm run import:photos -- --dir=./photos --dry-run
```

Affiche, pour chaque fichier : dimensions, format, doublons éventuels et **SKU suggéré**. Aucune
écriture en base.

## 3. Import réel

```bash
npm run import:photos -- --dir=./photos
```

Résultat : fichiers stockés (local ou Cloudinary selon `STORAGE_DRIVER`), ligne créée dans
`media_assets`, doublons ignorés, rejets listés.

Pour rattacher automatiquement les photos dont le nom contient une référence **déjà existante** :

```bash
npm run import:photos -- --dir=./photos --assign
```

Les photos sans correspondance restent dans la file de validation.

## 4. Valider et rattacher dans l'administration

`/admin/import` → section « Photos importées » :

- liste des photos en attente, SKU suggéré, dimensions ;
- rattachement à un produit (par recherche de référence ou de nom) ;
- rejet motivé (photo floue, doublon visuel, mauvais produit) ;
- réindexation visuelle en un clic (ou `npm run reindex:visual`).

## 5. Après rattachement

1. Vérifier l'ordre des photos (la première sert de vignette).
2. Compléter la fiche produit si des informations manquent (prix, stock, caractéristiques) : les
   produits incomplets ne doivent pas être publiés.
3. Lancer la réindexation visuelle pour que la recherche par photo fonctionne.

## Capacité et performance

- Les images sont converties en **WebP**, redimensionnées et servies avec `next/image` (formats
  modernes, chargement paresseux).
- Un import de 200 à 500 photos prend quelques minutes selon la taille des fichiers.
- Cloudinary est recommandé en production : le système de fichiers des fonctions Vercel n'est pas
  persistant.
