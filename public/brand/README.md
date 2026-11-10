# Identité Perokado

Tout est **vectoriel** et généré. Aucun fichier n'est retouché à la main : une
modification se fait dans le script, puis les images sont régénérées.

```bash
python3 scripts/make-brand-vectors.py   # 1. tracés vectoriels
npm run brand:assets                    # 2. toutes les images dérivées
npm run play:assets                     # 3. bannière de la fiche Play Store
```

## Le dessin

Un **sac de boutique doré**, poignée comprise, avec un **« P » bleu nuit en
réserve** au centre. Trois raisons à ce choix :

- une seule forme forte, reconnaissable à 32 px comme sur une affiche ;
- or sur bleu nuit : le contraste tient en niveaux de gris et en plein soleil ;
- le « P » est un pochoir (et non un trait fin) : il ne se bouche pas en petit.

Le mot « Perokado » est tracé avec la police de la marque (Poppins Bold,
licence SIL OFL 1.1, fichier et licence dans `scripts/brand/`), converti en
contours : la génération ne dépend donc d'aucune police installée.

## Fichiers

| Fichier | Usage |
| --- | --- |
| `perokado-emblem.svg` | l'emblème seul (source de toutes les icônes) |
| `perokado-wordmark-navy.svg` / `perokado-wordmark-white.svg` | le mot, fond clair / fond bleu nuit |
| `perokado-slogan-*.svg` | le slogan (trois couleurs) |
| `perokado-logo-horizontal-blanc.png` | en-tête, pied de page, barre d'administration (fond bleu nuit) |
| `perokado-logo-horizontal.png` | documents et fonds clairs |
| `perokado-logo.png` / `perokado-logo-blanc.png` | versions empilées (e-mails, réseaux sociaux) |
| `perokado-icon.png` | icône 512 px (PWA, Play Store, favicon haute résolution) |
| `perokado-icon-192.png` | icône 192 px du manifeste |
| `perokado-icon-maskable-512.png` | icône « maskable » (zone sûre 72 %, lanceur Android) |
| `apple-touch-icon.png` / `favicon-32.png` | iOS 180 px et favicon |
| `perokado-og.png` | image de partage 1200 × 630 |
| `play-feature-graphic.png` | bannière Play Store 1024 × 500, **sans transparence** |

## Couleurs et proportions

- Bleu nuit `#0E2340` (déclinaisons `#081729` et `#1B3F6B`), or `#F2B705`.
- Verrou horizontal : 515 × 132 px, utilisé à l'identique dans l'en-tête, le
  pied de page, l'administration et les documents.
- Emblème : 512 px, coins arrondis 116 px, zone sûre de 72 % pour la variante
  *maskable*.

## Bannière Play Store

`play-feature-graphic.png` n'est pas produite par `brand:assets` : elle a son
propre script (`npm run play:assets`), qui repart du logo horizontal blanc et
applique le bleu nuit et l'or. Après un changement de logo :
`brand:assets` puis `play:assets`.
