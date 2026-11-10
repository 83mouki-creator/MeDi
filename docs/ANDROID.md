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
| Icône 192 px | `public/brand/perokado-icon-192.png` | `/brand/perokado-icon-192.png` |
| Icône 512 px | `public/brand/perokado-icon.png` | `/brand/perokado-icon.png` |
| Icône « maskable » (Android) | `public/brand/perokado-icon-maskable-512.png` | `/brand/perokado-icon-maskable-512.png` |
| Page hors connexion | `src/app/offline/page.tsx` | `/offline` |
| Service worker | `public/sw.js` | `/sw.js` |
| Enregistrement du service worker | `src/components/pwa-register.tsx` | toutes les pages |
| En-têtes (`Content-Type`, cache du service worker) | `next.config.ts` | `/sw.js`, `/.well-known/assetlinks.json` |
| Générateur du fichier de vérification Android | `scripts/make-assetlinks.ts` | `npm run assetlinks` |

Les icônes sont régénérées par `npm run brand:assets` à partir de
`public/brand/perokado-emblem-3d.png` (emblème 3D détouré, produit lui-même par
`npm run brand:emblem` depuis `public/brand/source/perokado-3d-emblem.png`) :
ne les modifie pas à la main.

---

## 2. Vérifier que le site est « installable »

```bash
curl -s https://perokado.vercel.app/manifest.webmanifest | head -20
curl -sI https://perokado.vercel.app/sw.js
```

Dans Chrome sur ordinateur : F12 → onglet **Application**.

- *Manifest* : nom « Perokado », `display: standalone`, 3 icônes lues sans erreur ;
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
mkdir perokado-android && cd perokado-android
bubblewrap init --manifest https://perokado.vercel.app/manifest.webmanifest
```

Réponses à donner :

| Question | Réponse |
| --- | --- |
| Domain | `perokado.vercel.app` |
| Application name | `Perokado` |
| Short name | `Perokado` |
| **Application ID** | `ci.perokado.app` — **définitif, ne changera plus jamais** |
| Display mode | `standalone` |
| Status bar color | `#0b2545` |
| Splash screen color | `#0b2545` |
| Icon URL | `/brand/perokado-icon.png` (= 512 × 512) |
| Maskable icon URL | `/brand/perokado-icon-maskable-512.png` |
| Chrome OS | `No` |
| Signing key | `Create new` |
| Key store | `android.keystore`, alias `perokado` |
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
keytool -list -v -keystore android.keystore -alias perokado | grep SHA256
```

Une fois l'application publiée, Google la re-signe avec sa propre clé : ajouter
aussi l'empreinte **Play App Signing** (Play Console → *Test et publication* →
*Signature de l'application*).

### 4.2 Écrire le fichier dans le dépôt du site

```bash
npm run assetlinks -- "AA:BB:CC:…" "11:22:33:…"
```

La commande vérifie les empreintes (64 caractères hexadécimaux) et écrit
`public/.well-known/assetlinks.json` avec le paquet `ci.perokado.app`.
Nom de paquet différent ? `ANDROID_PACKAGE_NAME=… npm run assetlinks -- "…"`.

Puis déployer le site (commit + `main`).

### 4.3 Vérifier

```bash
curl -s https://perokado.vercel.app/.well-known/assetlinks.json
npx @bubblewrap/cli validate --url https://perokado.vercel.app
```

```text
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://perokado.vercel.app&relation=delegate_permission/common.handle_all_urls
```

La réponse doit citer `ci.perokado.app`. Si elle est vide, la barre d'adresse
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
   - icône 512 × 512 : `public/brand/perokado-icon.png` ;
   - *feature graphic* 1024 × 500 (à créer) ;
   - au moins 2 captures d'écran de téléphone ;
   - description courte (80 caractères) et complète (4 000 caractères) ;
   - politique de confidentialité : `https://perokado.vercel.app/confidentialite` ;
   - page de suppression de compte : `https://perokado.vercel.app/supprimer-mon-compte` ;
   - **un compte client de démonstration** pour l'équipe de revue (jamais le
     compte propriétaire).
3. **Créer l'application** : nom `Perokado`, langue `Français (France)`, type
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

## 8. Suppression de compte (obligatoire pour Google Play)

Google refuse une application qui permet de **créer** un compte sans offrir un
moyen de le **supprimer** : la suppression doit se faire dans l'application et
depuis une page web accessible sans installer l'application.

C'est en place :

| Page | Rôle |
| --- | --- |
| `/supprimer-mon-compte` | page publique (sans connexion) à déclarer dans la Play Console |
| `/supprimer-mon-compte/confirmation` | message affiché après la suppression |
| `/compte/supprimer` | suppression elle-même (connecté, depuis le site ou l'app) |

Ce que fait la suppression : efface le compte, le mot de passe, les adresses
enregistrées et **toutes les sessions** (l'utilisateur est déconnecté partout).
Les commandes déjà passées restent dans la comptabilité, détachées du compte
(`orders.user_id` passe à `NULL`) : elles servent de justificatif de vente et de
garantie. Chaque suppression écrit une ligne `account.deleted` dans le journal,
**sans** nom, e-mail ni téléphone.

Dans la Play Console, rubrique **Sécurité des données → Suppression de compte**,
indiquer :

- URL de la demande de suppression :
  `https://perokado.vercel.app/supprimer-mon-compte`
- Données supprimées : nom, e-mail, téléphone, mot de passe, adresses.
- Données conservées : historique de commandes (obligations comptables et
  garanties), détaché du compte.

Un compte du personnel ne peut pas s'auto-supprimer : la suppression d'un agent
se fait dans `/admin/utilisateurs`, par un compte de niveau supérieur.

## 9. Ce qui reste à faire côté site

- ~~**Feature graphic** 1024 × 500~~ : **prête**, `public/brand/play-feature-graphic.png`
  (régénérable avec `npm run play:assets`).
- ~~**Textes de la fiche**~~ : prêts dans `store/play-listing.json` (nom,
  description courte, description complète, nouveautés), vérifiés par un test.
- **Captures d'écran** : à produire (méthode détaillée dans `docs/PLAY-STORE.md`,
  section 3) et à ranger dans `store/screenshots/`.
- **Coordonnées de contact** : `contact.email` et `contact.phone` de
  `store/play-listing.json` portent la mention « à compléter ».
- **Domaine propre** (recommandé) : `perokado.vercel.app` fonctionne, mais un
  domaine à la boutique (`perokado.com`, `perokado.ci`…) rend l'application
  durable même si l'hébergement change.

> Tout le dépôt Play (textes, visuels, captures, secrets) est décrit pas à pas
> dans **`docs/PLAY-STORE.md`**.

---

## 10. Après le TWA : fonctions natives (optionnel)

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

## 11. Travailler depuis un téléphone (sans ordinateur)

Deux besoins très différents :

| Besoin | Faisable sur Android ? | Comment |
| --- | --- | --- |
| Modifier le site, les fiches produits, les commandes | **oui, intégralement** | navigateur du téléphone → `/admin` |
| `git`, `npm`, `keytool`, `npm run assetlinks` | **oui** | **Termux** (terminal Linux sous Android) |
| Fabriquer l'AAB (`bubblewrap build`) | **non** | il faut un ordinateur, ou GitHub Actions |

### 10.1 Administration dans l'application

L'application Android est une *Trusted Web Activity* : elle affiche le même site,
avec la même session. Se connecter avec un compte `OWNER` ou un rôle du personnel
ouvre `/admin` dans l'application, sans rien coder de plus.

Différences à connaître en `standalone` (sans barre d'adresse) :

- plus de bouton « retour » du navigateur : le header de l'administration et le
  bouton retour d'Android suffisent ;
- l'**impression des bons A4** est plus fiable dans Chrome : ouvrir alors
  `/admin` depuis Chrome (menu ⋮ → « Ouvrir dans le navigateur ») ;
- l'écran est petit : l'administration au téléphone sert à **consulter** et à
  répondre vite ; la saisie lourde (catalogue, import, comptabilité) reste plus
  confortable sur ordinateur.

Aucun raccourci « Administration » n'est mis dans le manifeste : l'accès se fait
par la connexion normale, et l'icône de l'application reste celle de la boutique.

### 10.2 Terminal sur Android (Termux)

Installer **Termux** (F-Droid ou Play Store), puis :

```bash
pkg update && pkg upgrade
pkg install git nodejs-lts openjdk-17
git clone https://github.com/83mouki-creator/Perokado.git
cd Perokado
npm install
```

Utile pour : `git pull` / `git push`, `npm run assetlinks`, et **générer le
keystore** une seule fois :

```bash
keytool -genkeypair -v -keystore android.keystore -alias perokado \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype JKS -dname "CN=Perokado, OU=Daloa, O=Perokado, L=Daloa, C=CI"
keytool -list -v -keystore android.keystore -alias perokado | grep SHA256
```

Le fichier `android.keystore` doit être sauvegardé (cloud, clé USB) : **sans lui,
impossible de publier une mise à jour** de l'application.

### 10.3 Fabriquer l'AAB sans ordinateur (GitHub Actions)

`bubblewrap` a besoin du SDK Android, de Gradle et de `aapt2` : cela ne tourne
pas sous Termux. La solution est de faire compiler par GitHub, depuis le
navigateur du téléphone :

1. le manifeste est déjà versionné : `android/twa-manifest.json` (package
   `ci.perokado.app`, nom, icônes, couleurs, raccourcis) ;
2. ajouter le keystore en secret : *Settings → Secrets and variables → Actions*,
   secret `ANDROID_KEYSTORE_BASE64` = contenu de `android.keystore` encodé en
   base64 (`base64 -w0 android.keystore`), plus `KEYSTORE_PASSWORD` et
   `KEY_PASSWORD` ;
3. lancer le workflow **`.github/workflows/android-aab.yml`** (onglet *Actions* →
   « Application Android (AAB) » → *Run workflow*) : il installe JDK 17 et le SDK
   Android, exécute `bubblewrap update` puis `bubblewrap build`, et dépose
   `app-release-bundle.aab` et `app-release-signed.apk` en artefacts ;
4. télécharger l'AAB depuis la page du workflow et le déposer dans la Play
   Console (gestion des versions → nouveau test fermé).

Le détail (secrets, versions, dépannage) est dans `docs/PLAY-STORE.md`,
section 4.

Tout se pilote alors depuis le navigateur du téléphone : GitHub, Play Console et
Vercel ont chacun une interface mobile complète.

---

## 12. Pièges connus

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
