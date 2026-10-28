# Recherche visuelle

## Ce qui fonctionne réellement

La photo prise ou choisie par le visiteur est **comparée aux photos du catalogue** :

1. empreinte visuelle de chaque photo produit, stockée dans `product_images.embedding` (jsonb) ;
2. calcul de l'empreinte de la photo envoyée ;
3. similarité cosinus avec chaque photo indexée, meilleur score par produit ;
4. classement, puis affichage des produits avec leur prix et leur disponibilité réels.

La photo de requête est traitée **en mémoire** et n'est jamais enregistrée.
La caméra s'ouvre via `<input type="file" capture="environment">` sur mobile (HTTPS obligatoire) ;
sur ordinateur, un sélecteur de fichier est proposé.

## Deux fournisseurs

| `VISION_PROVIDER` | Modèle | Nature | Statut |
| --- | --- | --- | --- |
| `local` (défaut) | `medi-local-descriptor-v1` | descripteur perceptif calculé avec sharp : moyennes RGB sur grille, histogrammes de couleurs, densité de contours (67 dimensions) | opérationnel, **non sémantique** |
| `http` | `VISION_MODEL` (ex. CLIP) | embeddings sémantiques via une API compatible OpenAI (`VISION_API_URL`, `VISION_API_KEY`) | nécessite un service externe configuré |
| `none` | — | fonctionnalité désactivée explicitement | la page affiche la raison |

### Honnêteté des résultats

- Le descripteur local compare **couleurs et contours**, pas le sens de l'image. Il ne peut donc
  jamais affirmer qu'il s'agit du même produit : l'interface parle de « **pistes** à vérifier ».
- `calibrated` n'est vrai que pour un fournisseur sémantique. Dans ce cas seulement, un score élevé
  (≥ 0,82) peut être présenté comme « correspondance probable ».
- Aucun prix ni aucun stock n'est déduit de l'image : les données affichées proviennent de la base.
- Si une majorité de photos se ressemblent (studio, fond identique), l'interface prévient que le
  résultat est peu discriminant.

## Indexation

```bash
npm run reindex:visual            # uniquement les photos non indexées
npm run reindex:visual -- --all   # tout recalculer (après changement de fournisseur)
```

Sans indexation, la page `/recherche-visuelle` affiche un avertissement explicite et aucune
correspondance n'est inventée.

Après un import de photos, relancez cette commande (ou utilisez le bouton de `/admin/import`).

## API

`POST /api/visual-search` — `multipart/form-data`, champ `image`.

- Types acceptés : JPEG, PNG, WebP, AVIF ; taille maximale 5 Mo (`UPLOAD_MAX_BYTES`).
- Limitation : 12 recherches par minute et par IP.
- Réponses : `available:false` + `reason` si le fournisseur ou l'index est absent, sinon
  `matches[]` avec `score`, `calibrated`, `confident` et un message explicatif.
- Aucune image n'est écrite sur disque ni en base.

## Améliorer la reconnaissance

1. Photographier les produits sur fond neutre, avec un cadrage cohérent.
2. Configurer un modèle sémantique (`VISION_PROVIDER=http`) : la qualité d'identification devient
   nettement supérieure ; les seuils `0,82 / 0,62` devront être recalibrés sur un échantillon réel.
3. Recalculer l'index après tout changement de modèle (`--all`), puis vérifier sur 10 à 20 photos
   réelles avant d'annoncer la fonctionnalité comme calibrée.
