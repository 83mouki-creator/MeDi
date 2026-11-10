# Identité Perokado

Deux sources, un seul jeu d'images : un **rendu 3D** pour la marque, des **tracés
vectoriels** pour le mot et le slogan.

```bash
npm run brand:assets   # emblème 3D détouré + toutes les images dérivées + photo d'accueil
npm run play:assets    # bannière de la fiche Play Store (après brand:assets)
```

## Le dessin

L'emblème est une **plaque bleu nuit à coins arrondis**, cerclée d'un liseré
doré, sur laquelle est posé un **sac de boutique doré** portant un **« P » gravé**.
Trois raisons à ce choix :

- une seule forme forte, reconnaissable à 32 px comme sur une affiche ;
- le 3D donne de la matière (lumière, ombre portée) là où un aplat paraît plat
  sur un écran de téléphone ;
- or sur bleu nuit : le contraste tient en niveaux de gris comme en plein soleil.

Le mot « Perokado » est tracé avec la police de la marque (Poppins Bold, licence
SIL OFL 1.1, fichier et licence dans `scripts/brand/`), converti en contours : la
génération ne dépend donc d'aucune police installée.

## Comment l'emblème est fabriqué

`public/brand/source/perokado-3d-emblem.png` est le rendu de travail : carré,
opaque, avec des reflets sombres dans les coins. `scripts/make-brand-emblem.ts`
(`npm run brand:emblem`) en tire `perokado-emblem-3d.png` :

1. la plaque est repérée par sa luminance (scan des bords) ;
2. tout ce qui est **hors** de la plaque est rendu transparent, avec un masque à
   coins arrondis de même rayon — on garde la lumière du rendu, on ne redessine
   rien ;
3. la plaque est posée sur un canevas 1024 × 1024 avec 2 % de marge.

Résultat : un PNG transparent qui se pose aussi bien sur du blanc que sur du
bleu nuit, sans liseré ni carré parasite.

## Fichiers

| Fichier | Usage |
| --- | --- |
| `source/perokado-3d-emblem.png` | rendu 3D d'origine (entrée, non servi) |
| `perokado-emblem-3d.png` | **l'emblème** : filigrane de l'administration, icônes, partage |
| `perokado-emblem.svg` | emblème à plat, en vectoriel (documents imprimés, très petits formats) |
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
| `source/accueil-hero.jpg` | photo d'origine du bandeau d'accueil |
| `fond-accueil.jpg` | photo du bandeau, optimisée (`npm run brand:hero`) |

## La photo d'accueil

`source/accueil-hero.jpg` montre l'intérieur de la quincaillerie : rayonnages
garnis, deux personnes qui essaient une perceuse. `scripts/make-hero-image.ts`
(`npm run brand:hero`) la ré-encode en JPEG progressif avec un léger renforcement
de netteté — le voile bleu nuit posé par la page adoucit les détails.

Le chemin est exposé par `BRAND.heroImage` : changer la photo ne demande aucune
modification de la page, seulement de remplacer le fichier source et de relancer
`brand:hero`.

## Couleurs et proportions

- Bleu nuit `#0E2340` (déclinaisons `#081729` et `#1B3F6B`), or `#F2B705`.
- Verrou horizontal : 515 × 132 px, utilisé à l'identique dans l'en-tête, le
  pied de page, l'administration et les documents.
- Emblème : 1024 px de source, coins arrondis 19,5 % du côté, zone sûre de 72 %
  pour la variante *maskable*.

## Bannière Play Store

`play-feature-graphic.png` n'est pas produite par `brand:assets` : elle a son
propre script (`npm run play:assets`), qui repart du logo horizontal blanc et
applique le bleu nuit et l'or. Après un changement de logo :
`brand:assets` puis `play:assets`.
