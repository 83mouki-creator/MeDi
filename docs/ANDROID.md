# Mettre la boutique sur le Play Store (application Android)

Le site est déjà prêt à devenir une application Android : il est en HTTPS, il a un
manifeste (`/manifest.webmanifest`), des icônes, un service worker et une page
« pas de connexion ». Il reste à fabriquer le paquet Android et à le publier.

La méthode retenue est la **TWA** (*Trusted Web Activity*) : l'application Play
Store affiche le site en plein écran, sans barre d'adresse, et **suit
automatiquement chaque mise à jour du site**. Un nouveau produit ou un nouveau
prix n'exige donc aucun nouveau dépôt sur le Play Store.

> Une réécriture native (Kotlin, React Native) n'est pas nécessaire : le site est
> rendu par le serveur (base PostgreSQL, sessions, actions serveur) et ne peut pas
> être figé en fichiers statiques.

---

## 1. Ce qui est déjà en place dans le dépôt

| Élément | Fichier | Servi à l'adresse |
| --- | --- | --- |
| Manifeste de l'application | `src/app/manifest.ts` | `/manifest.webmanifest` |
| Icône 192 px | `public/brand/medi-icon-192.png` | `/brand/medi-icon-192.png` |
| Icône 512 px | `public/brand/medi-icon.png` | `/brand/medi-icon.png` |
| Icône « maskable » (Android) | `public/brand/medi-icon-maskable-512.png` | `/brand/medi-icon-maskable-512.png` |
| Page hors connexion | `src/app/offline/page.tsx` | `/offline` |
| Service worker | `public/sw.js` | `/sw.js` |
| Enregistrement du service worker | `src/components/pwa-register.tsx` | toutes les pages |
| En-têtes (`Content-Type`, cache du service worker) | `next.config.ts` | `/sw.js`, `/.well-known/assetlinks.json` |
| Générateur du fichier de vérification Android | `scripts/make-assetlinks.ts` | `npm run assetlinks` |

Les icônes sont régénérées par `npm run brand:assets` à partir de
`public/brand/medi-logo-source.png` : ne les modifie pas à la main.

---

## 2. Vérifier que le site est « installable »

```bash
curl -s https://medi-daloa.vercel.app/manifest.webmanifest | head -20
curl -sI https://medi-daloa.vercel.app/sw.js
```

Dans Chrome sur ordinateur : F12 → onglet **Application**.

- *Manifest* : nom « MeDi Shop », `display: standalone`, 3 icônes lues sans erreur ;
- *Service workers* : `sw.js` **activated and is running**.

Sur un téléphone Android, Chrome propose alors « Installer l'application ».

---

## 3. Fabriquer le paquet Android (Bubblewrap)

### 3.1 Outils

| Outil | Version | Rôle |
| --- | --- | --- |
| Node.js | ≥ 20 | déjà installé pour le site |
| JDK | 17 | compilation Android |
| Android SDK | dernière | compilation Android |
| `@bubblewrap/cli` | dernière | fabrique l'application |

Bubblewrap propose d'installer lui-même le JDK et le SDK dans `~/.bubblewrap` :
accepter, puis contrôler avec `bubblewrap doctor` (toutes les lignes doivent être
vertes).

```bash
npm install -g @bubblewrap/cli
bubblewrap doctor
```

### 3.2 Créer le projet

```bash
mkdir medi-shop-android && cd medi-shop-android
bubblewrap init --manifest https://medi-daloa.vercel.app/manifest.webmanifest
```

Réponses à donner :

| Question | Réponse |
| --- | --- |
| Domain | `medi-daloa.vercel.app` |
| Application name | `MeDi Shop` |
| Short name | `MeDi Shop` |
| **Application ID** | `ci.medishop.app` — **définitif, ne changera plus jamais** |
| Display mode | `standalone` |
| Status bar color | `#0b2545` |
| Splash screen color | `#0b2545` |
| Icon URL | `/brand/medi-icon.png` (= 512 × 512) |
| Maskable icon URL | `/brand/medi-icon-maskable-512.png` |
| Chrome OS | `No` |
| Signing key | `Create new` |
| Key store | `android.keystore`, alias `medi` |
| Mots de passe | **à noter et à sauvegarder** (irrécupérables) |
| versionCode / versionName | `1` / `1.0.0` |

### 3.3 Compiler

```bash
bubblewrap build
```

Produit `app-release-signed.apk` (test) et `app-release-bundle.aab` (Play Store).

> **Sauvegarde** : `android.keystore` + mots de passe sur deux supports distincts.
> Perdu, l'application ne peut plus jamais être mise à jour. Ne jamais le
> versionner dans Git.

---

## 4. Autoriser l'application à ouvrir le site (Digital Asset Links)

Sans cette étape, l'application affiche le site **avec la barre d'adresse Chrome**.

### 4.1 Empreintes SHA-256

```bash
keytool -list -v -keystore android.keystore -alias medi | grep SHA256
```

Une fois l'application publiée, Google la re-signe avec sa propre clé : ajouter
aussi l'empreinte **Play App Signing** (Play Console → *Test et publication* →
*Signature de l'application*).

### 4.2 Écrire le fichier dans le dépôt du site

```bash
npm run assetlinks -- "AA:BB:CC:…" "11:22:33:…"
```

La commande vérifie les empreintes (64 caractères hexadécimaux) et écrit
`public/.well-known/assetlinks.json` avec le paquet `ci.medishop.app`.
Nom de paquet différent ? `ANDROID_PACKAGE_NAME=… npm run assetlinks -- "…"`.

Puis déployer le site (commit + `main`).

### 4.3 Vérifier

```bash
curl -s https://medi-daloa.vercel.app/.well-known/assetlinks.json
npx @bubblewrap/cli validate --url https://medi-daloa.vercel.app
```

```text
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://medi-daloa.vercel.app&relation=delegate_permission/common.handle_all_urls
```

La réponse doit citer `ci.medishop.app`. Si elle est vide, la barre d'adresse
restera affichée.

---

## 5. Tester sur un téléphone

```bash
adb install -r app-release-signed.apk
```

| Test | Attendu |
| --- | --- |
| Ouverture | plein écran, **aucune barre d'adresse** |
| Bouton retour Android | revient dans le site, ne ferme pas l'app |
| Wave / WhatsApp / Google Maps | s'ouvrent hors de l'application |
| Compte, panier | session et panier conservés |
| Recherche par photo | appareil photo et galerie disponibles |
| Commande de bout en bout | bon de livraison imprimable depuis le téléphone |
| Mode avion | page « Pas de connexion », puis retour au site |
| `/admin` | s'ouvre normalement (inutile pour un client) |

---

## 6. Publier sur le Play Store

1. **Compte développeur** : 25 USD une seule fois (frais Google, hors contrat),
   vérification d'identité sous 1 à 3 jours.
2. **Éléments à préparer**
   - icône 512 × 512 : `public/brand/medi-icon.png` ;
   - *feature graphic* 1024 × 500 (à créer) ;
   - au moins 2 captures d'écran de téléphone ;
   - description courte (80 caractères) et complète (4 000 caractères) ;
   - politique de confidentialité : `https://medi-daloa.vercel.app/confidentialite` ;
   - **un compte client de démonstration** pour l'équipe de revue (jamais le
     compte propriétaire).
3. **Créer l'application** : nom `MeDi Shop`, langue `Français (France)`, type
   *Application*, **gratuite**.
4. **Renseigner les blocs de « Configuration de l'application »** : accès à
   l'application, publicités (non), classification du contenu, public cible
   (18 ans et plus), sécurité des données (nom, téléphone, adresse, historique de
   commandes — collectés, chiffrés en transit, non partagés).
5. **Fiche du magasin** : captures, icône, feature graphic, descriptions.
6. **Test fermé** : au moins **12 testeurs** (adresses Gmail), envoyer l'AAB,
   publier le test, puis **14 jours consécutifs** avec des testeurs actifs —
   règle de Google pour les comptes personnels neufs, et ce que prévoit le
   contrat (`12 testeurs / 14 jours`).
7. **Production** : même AAB (ou version suivante) → examen Google **1 à 7 jours**.

> Vente de **biens physiques** : le paiement Wave en dehors de Google Play est
> autorisé. La facturation Google Play obligatoire ne concerne que les contenus
> numériques.

---

## 7. Après la publication

| Situation | Action |
| --- | --- |
| Nouveau produit, prix, texte, photo | **rien à faire** : l'app affiche le site en direct |
| Icône, nom, domaine, mode d'affichage | `bubblewrap update`, `bubblewrap build`, incrémenter `versionCode`, nouveau dépôt |
| Correctif urgent | déploiement Vercel, l'app suit immédiatement |

---

## 8. Ce qui reste à faire côté site

- **Suppression de compte** : Google refuse une application qui permet de créer un
  compte sans offrir un moyen de le supprimer. Il faut une page (par exemple
  `/compte/supprimer`) et son lien dans la fiche Play. **Pas encore présente.**
- **Feature graphic** 1024 × 500 : à dessiner (logo sur fond bleu nuit).
- **Captures d'écran** : à faire sur un téléphone.
- **Domaine propre** (recommandé) : `medi-daloa.vercel.app` fonctionne, mais un
  domaine à la boutique (`medishop.ci`, `medishop-daloa.com`…) rend l'application
  durable même si l'hébergement change.

---

## 9. Après le TWA : fonctions natives (optionnel)

Passer à **Capacitor** seulement si un besoin natif apparaît :

- notifications push ciblées (« votre commande est prête ») via Firebase ;
- lecture de codes-barres avec la caméra ;
- catalogue entièrement hors connexion.

```bash
npm install @capacitor/core @capacitor/cli
npx cap add android
```

Pour le reste, la TWA suffit : elle est plus simple, plus légère et gratuite.

---

## 10. Pièges connus

1. Empreinte SHA-256 absente ou erronée → barre d'adresse visible.
2. Empreinte **Play App Signing** oubliée → l'app marche en test, casse en
   production.
3. `android.keystore` perdu → plus aucune mise à jour possible.
4. Identifiant d'application déjà pris → choisir et vérifier avant `init`.
5. Niveau d'API cible trop ancien → la Play Console refuse l'AAB (`bubblewrap
   update` puis `bubblewrap build`).
6. Compte de test non fourni alors que la commande exige un compte → rejet.
7. `manifest.webmanifest` inaccessible (protection de déploiement, redirection) →
   `bubblewrap init` s'arrête.
