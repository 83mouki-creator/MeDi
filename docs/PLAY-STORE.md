# Perokado sur le Play Store — textes, visuels et fabrication de l'application

Ce document rassemble tout ce qu'il faut pour déposer l'application Android :
les **textes** prêts à copier, les **visuels** (dont la bannière 1024 × 500),
la **marche à suivre pour les captures d'écran**, et la **fabrication de l'AAB
sans ordinateur** grâce à GitHub Actions.

Pour la partie technique (Bubblewrap, Digital Asset Links, publication), voir
`docs/ANDROID.md`.

---

## 0. Les adresses

| | Adresse |
| --- | --- |
| Boutique | https://perokado.vercel.app |
| Administration | https://perokado.vercel.app/admin |
| Politique de confidentialité | https://perokado.vercel.app/confidentialite |
| Suppression de compte (obligatoire sur Play) | https://perokado.vercel.app/supprimer-mon-compte |

Package Android : `ci.perokado.app` · Nom affiché : **Perokado**

---

## 1. Les textes à copier dans la Play Console

Source unique de vérité : **`store/play-listing.json`** (un test vérifie les
longueurs maximales imposées par Google). Les deux textes sont reproduits
ci-dessous tels quels.

### Nom de l'application (30 caractères max)

```
Perokado
```

### Description courte (80 caractères max)

```
Tout ce que vous cherchez au même endroit : outillage, quincaillerie, maison.
```

### Description complète (4 000 caractères max)

```text
Perokado — tout ce que vous cherchez au même endroit, livré chez vous.

Outillage, matériaux de construction, plomberie, électricité, peinture, visserie et équipement de la maison : le catalogue de la boutique est là, avec ses prix en francs CFA.

CE QUE VOUS POUVEZ FAIRE
• Parcourir les rayons : outillage électroportatif, quincaillerie, plomberie, éclairage, peinture, protection.
• Rechercher un produit par son nom, sa référence ou son usage.
• Voir le prix, la disponibilité réelle en stock et les photos avant de commander.
• Repérer d'un coup d'œil les vignettes de garantie et les réductions sur les photos produits.
• Envoyer la photo d'une pièce à remplacer : la recherche visuelle propose les produits qui y ressemblent.
• Composer un panier et commander en quelques étapes, avec ou sans compte.
• Choisir la livraison à domicile : un quartier de Daloa, ou une autre ville de Côte d'Ivoire.
• Suivre une commande à tout moment avec son numéro.
• Retrouver ses commandes dans son compte, et supprimer ce compte soi-même à tout moment.

PAIEMENT
• Wave, vérifié par la boutique avant préparation du colis.
• Paiement à la livraison dans un quartier de Daloa, dans la limite affichée au moment de la commande.
• Pour les autres villes : paiement demandé avant l'envoi, transport réglé avec la boutique sur WhatsApp.

LIVRAISON
• Livraison à domicile à Daloa selon les zones et les tarifs affichés avant paiement.
• Autres villes de Côte d'Ivoire : 7 jours maximum, transport convenu sur WhatsApp.
• Aucun frais caché : le montant des articles s'affiche avant la validation.

UN VRAI MAGASIN DERRIÈRE L'APPLICATION
Chaque commande est préparée et contrôlée par l'équipe de la boutique. Une question sur un produit, une compatibilité, un délai ? Écrivez-nous sur WhatsApp depuis l'application : la réponse vient de la boutique, pas d'un centre d'appel.

UNE SEULE LANGUE, LA BONNE
L'application est entièrement en français, sans réglage à faire : les textes, les prix et les unités sont ceux du magasin.

VOS DONNÉES
Pas de publicité, pas de revente de données. Le compte sert uniquement à traiter vos commandes et à vous contacter. La politique de confidentialité complète est sur le site.
```

### Nouveautés de cette version (500 caractères max)

```
Nouvelle identité Perokado, livraison à domicile uniquement, vignettes de garantie et de réduction sur les produits, interface entièrement en français.
```

### Champs de contact

Dans `store/play-listing.json`, les champs `contact.email` et `contact.phone`
portent la mention **« à compléter »** : ce sont ceux du compte développeur, pas
ceux du site. À remplacer par l'adresse e-mail et le numéro WhatsApp de la
boutique avant le dépôt (Play exige une adresse e-mail de contact publique).

---

## 2. Les visuels

| Visuel | Format | État | Fichier |
| --- | --- | --- | --- |
| Icône de l'application | PNG 512 × 512, sans transparence | **prêt** | `public/brand/perokado-icon.png` |
| Bannière (feature graphic) | PNG 1024 × 500, sans transparence | **prêt** | `public/brand/play-feature-graphic.png` |
| Captures d'écran téléphone | 2 minimum, 8 maximum | **à faire** | `store/screenshots/` |
| Bannière de la page « Test fermé » | facultatif | non requis | — |

### Régénérer la bannière

```bash
npm run play:assets
```

Le script `scripts/make-play-assets.ts` repart du logo blanc
(`medi-logo-horizontal-blanc.png`), applique le bleu nuit `#0b2545`, le jaune
`#f2b705` et les anneaux dorés, puis écrit la bannière. Après un changement de
logo : `npm run brand:assets` **puis** `npm run play:assets`.

La bannière ne contient **aucun texte** : c'est volontaire (Google recommande une
image sobre, le nom de l'application est déjà affiché par la fiche).

---

## 3. Les captures d'écran — mode d'emploi

### Ce que Google exige

- **2 à 8 captures** pour téléphone (une seule suffit techniquement, mais la fiche
  est refusée si l'image ne montre pas l'application réelle) ;
- **JPEG ou PNG** 24 bits, **sans transparence** ;
- **320 px minimum**, **3 840 px maximum** sur le côté le plus long ;
- rapport entre **16:9** (paysage) et **9:16** (portrait) — le plus simple est du
  portrait **1080 × 2400** ;
- pas de texte ajouté par-dessus (« Téléchargez maintenant ! ») : Google refuse
  les images publicitaires.

### Les 5 écrans à capturer (dans cet ordre)

1. **Accueil** — la page d'accueil, avec la barre de recherche et les rayons.
2. **Catalogue** — la liste de produits avec les prix en FCFA.
3. **Fiche produit** — photo, prix, stock, bouton « Ajouter au panier ».
4. **Panier / commande** — le récapitulatif avec le mode de livraison.
5. **Suivi de commande** — l'état de la commande (écran rassurant).

### Méthode A — avec un téléphone Android (la plus vraie)

1. Ouvrir **https://perokado.vercel.app** dans Chrome.
2. Se mettre en **français** (langue par défaut) et en mode clair.
3. Descendre la barre d'état si besoin, puis capturer avec **Power + Volume bas**
   (sur la plupart des téléphones).
4. Recommencer pour chaque écran.
5. Envoyer les images sur WhatsApp (à soi-même) ou Google Drive, puis les
   ranger dans `store/screenshots/` aux noms indiqués plus bas.

> Astuce : masquer la barre d'état n'est pas possible sans outil ; elle est
> acceptée par Google. Pour des images plus propres, utiliser la méthode B.

### Méthode B — avec un ordinateur, sans téléphone (recommandée)

1. Ouvrir https://perokado.vercel.app dans **Chrome** (ou Edge).
2. `F12` → icône **appareil** (Ctrl + Maj + M) pour passer en mode mobile.
3. En haut, choisir **iPhone 12 Pro** ou « Responsive », largeur **1080**,
   hauteur **2400**, zoom **100 %**.
4. Menu **⋮** du panneau (à droite de la barre d'outils de l'appareil) →
   **Capture screenshot**. Chrome enregistre un PNG à la taille exacte.
5. Refaire pour les 5 écrans.

### Où ranger les fichiers

```
store/screenshots/
  01-accueil.png
  02-catalogue.png
  03-fiche-produit.png
  04-panier.png
  05-suivi.png
```

Ces images ne sont pas nécessaires au fonctionnement du site : elles ne servent
qu'au dépôt Play. Elles peuvent rester hors du dépôt Git si vous préférez (elles
sont alors à téléverser directement depuis le téléphone ou l'ordinateur).

---

## 4. Fabriquer l'AAB sans ordinateur (GitHub Actions)

Le workflow `.github/workflows/android-aab.yml` compile et signe l'application
sur les machines de GitHub. Rien à installer sur le téléphone.

### 4.1 Créer les secrets (une seule fois)

`Settings` → `Secrets and variables` → `Actions` → `New repository secret` :

| Secret | Contenu |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | contenu de `android.keystore` encodé en base64 |
| `KEYSTORE_PASSWORD` | mot de passe du fichier `.keystore` |
| `KEY_PASSWORD` | mot de passe de la clé `medi` (souvent le même) |

Pour produire la valeur base64 depuis un téléphone (Termux) :

```bash
base64 -w0 android.keystore | tr -d '\n'
```

Depuis un ordinateur (PowerShell) :

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("android.keystore")) | Set-Clipboard
```

### 4.2 Lancer la compilation

1. Onglet **Actions** → **Application Android (AAB)** → **Run workflow**.
2. Laisser `version_name` et `version_code` vides pour utiliser les valeurs du
   manifeste (`android/twa-manifest.json`, actuellement `1.0.0` / `1`), ou les
   renseigner pour publier une nouvelle version (le code doit **toujours
   augmenter**).
3. Attendre 5 à 10 minutes.
4. En bas de la page du run, **Artifacts** → `medi-shop-android-<n°>` :
   - `app-release-bundle.aab` → à déposer dans la Play Console ;
   - `app-release-signed.apk` → à installer directement sur un téléphone de test.

### 4.3 Ce que fait le workflow

1. installe Node 22, le JDK 17 et le SDK Android ;
2. installe `@bubblewrap/cli` (version figée `1.27.0`) ;
3. écrit la configuration Bubblewrap (aucune question interactive) ;
4. restaure la clé de signature depuis les secrets ;
5. ajuste la version si demandé ;
6. `bubblewrap update` puis `bubblewrap build` (AAB + APK signés) ;
7. publie les deux fichiers en artefacts pendant 30 jours.

> Le premier lancement peut réclamer un ajustement de version de `build-tools` :
> le journal indique alors précisément l'outil manquant. Si vous préférez un
> ordinateur, `docs/ANDROID.md` décrit la fabrication locale.

---

## 5. Ordre des opérations

1. **Compte développeur Google Play** — 25 USD, vérification d'identité (1 à 3 j).
2. **Clé de signature** (`android.keystore`) — générée et sauvegardée deux fois.
3. **AAB** — workflow GitHub Actions, artefact téléchargé.
4. **Fiche Play** — nom, descriptions (section 1), icône, bannière, captures.
5. **Sécurité des données** — déclarer les données collectées et l'URL de
   suppression `https://perokado.vercel.app/supprimer-mon-compte`.
6. **Compte client de démonstration** — créé sur `/inscription`, identifiants
   notés dans la fiche pour les testeurs Google.
7. **Test fermé** — 12 testeurs, 14 jours consécutifs.
8. **Production** — examen Google 1 à 7 jours.
9. **Après publication** — `npm run assetlinks -- "<empreinte 1>" "<empreinte 2>"`
   avec les empreintes de la Play Console, puis redéploiement du site : c'est ce
   qui masque la barre d'adresse dans l'application.

---

## 6. En cas de problème

| Message | Cause | Solution |
| --- | --- | --- |
| `Secret ANDROID_KEYSTORE_BASE64 manquant` | secret absent ou mal nommé | recréer le secret (4.1) |
| `Could not find sdkmanager` | SDK Android incomplet | relancer le workflow ; sinon installer `cmdline-tools;latest` |
| `Keystore was tampered with, or password was incorrect` | mot de passe erroné | corriger `KEYSTORE_PASSWORD` / `KEY_PASSWORD` |
| Play refuse l'AAB : « version code déjà utilisé » | code non incrémenté | relancer avec `version_code` supérieur |
| L'application affiche la barre d'adresse | `assetlinks.json` absent ou empreintes fausses | voir `docs/ANDROID.md`, section 4 |
