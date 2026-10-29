# Logo MeDi

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
| `medi-icon.png` | icône carrée 512 px (favicon haute résolution, PWA) |
| `favicon-32.png` | favicon 32 px |
| `apple-touch-icon.png` | icône iOS 180 px |
| `medi-og.png` | image de partage 1200 × 630 (Open Graph / Twitter) |

Les anciens fichiers `medi-logo.svg`, `medi-logo-blanc.svg` et `medi-icon.svg`
(proposition initiale) ne sont plus utilisés par le site.

Pour remplacer le logo : écraser `medi-logo-source.png` puis relancer
`npm run brand:assets`. Aucune modification de code n'est nécessaire.
