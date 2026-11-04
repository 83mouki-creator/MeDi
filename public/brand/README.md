# Logo MeDi Shop

Le logo officiel fourni par le propriétaire est conservé tel quel dans
`medi-logo-source.png`. Toutes les autres images de marque sont générées à partir
de ce fichier :

```bash
npm run brand:assets
```

| Fichier | Usage |
| --- | --- |
| `medi-logo-source.png` | fichier d'origine (ne pas modifier : c'est la source) |
| `medi-logo-horizontal-blanc.png` | en-tête et pied de page (fond bleu nuit) |
| `medi-logo-horizontal.png` | documents et fonds clairs |
| `medi-logo.png` / `medi-logo-blanc.png` | versions empilées (e-mails, réseaux sociaux) |
| `medi-icon.png` | icône carrée 512 px (favicon haute résolution, PWA, fiche Play Store) |
| `medi-icon-192.png` | icône 192 px exigée par le manifeste de l'application Android |
| `medi-icon-maskable-512.png` | icône « maskable » 512 px (zone sûre 72 %, lanceur Android) |
| `favicon-32.png` | favicon 32 px |
| `apple-touch-icon.png` | icône iOS 180 px |
| `medi-og.png` | image de partage 1200 × 630 (Open Graph / Twitter) |

## Le mot « Shop »

Le logo fourni n'écrit que « MeDi ». Pour écrire **MeDi Shop** partout, le mot
« Shop » est ajouté à droite du mot d'origine :

- son tracé vectoriel est dans `scripts/brand/shop-wordmark.svg` ;
- il est produit par `scripts/make-shop-wordmark.py` à partir de la police
  Poppins Bold (`scripts/brand/poppins-latin-700-normal.woff2`, licence SIL OFL
  dans `scripts/brand/Poppins-OFL.txt`), la plus proche des capitales du logo ;
- `scripts/make-brand-assets.ts` le colle à la même hauteur de capitale et à la
  même ligne de base que « MeDi ».

Pour changer ce mot (couleur, graisse, orthographe) : modifier
`scripts/make-shop-wordmark.py`, relancer `python3 scripts/make-shop-wordmark.py`
puis `npm run brand:assets`.

Les anciens fichiers `medi-logo.svg`, `medi-logo-blanc.svg` et `medi-icon.svg`
(proposition initiale) ne sont plus utilisés par le site.

Pour remplacer le logo : écraser `medi-logo-source.png` puis relancer
`npm run brand:assets`. Aucune modification de code n'est nécessaire.
