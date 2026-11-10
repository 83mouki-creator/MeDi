# Ouvrir un compte client sur Perokado

**L'inscription est ouverte.** N'importe qui peut créer un compte client en une
trentaine de secondes, sans intervention de la boutique : il n'y a ni validation
manuelle, ni e-mail de confirmation à attendre. Le compte est utilisable
immédiatement, et il ne donne **jamais** accès à l'administration.

---

## 1. Le parcours du client

### Étape par étape

1. Ouvrir **https://perokado.vercel.app** (site ou application Android : c'est
   le même chemin).
2. En haut à droite, appuyer sur **« Compte / Connexion »**, puis sur
   **« Créer un compte »**. Le lien figure aussi en bas de chaque page, dans le
   pied de page. Adresse directe : **https://perokado.vercel.app/inscription**
3. Remplir le formulaire :

   | Champ | Ce qu'il faut saisir |
   | --- | --- |
   | Prénom | 2 caractères minimum |
   | Nom | 2 caractères minimum |
   | Adresse e-mail | valide : elle sert d'identifiant de connexion |
   | Téléphone | 10 chiffres, ex. `0701020304` (les espaces et points sont acceptés) |
   | Mot de passe | **10 caractères minimum**, avec **au moins une lettre et un chiffre** |
   | Case à cocher | accepter les CGV et la politique de confidentialité |

4. Appuyer sur **« Créer mon compte »**.

Le client est **connecté aussitôt** et arrive sur son espace (`/compte`). Aucune
confirmation n'est demandée : le compte est utilisable immédiatement.

Un **e-mail de bienvenue** part en plus (une fois Brevo configuré, voir
[`docs/EMAIL.md`](EMAIL.md)) : il ne sert qu'à rassurer, il n'y a rien à cliquer
pour activer le compte.

### Ce qu'il trouve ensuite dans son compte

- ses **commandes** et leur suivi ;
- ses **adresses** enregistrées ;
- ses **informations** (nom, e-mail, téléphone) et le changement de mot de passe ;
- la **suppression de son compte**, qu'il peut faire lui-même.

### Se connecter plus tard

Deux identifiants possibles, au choix : l'**adresse e-mail** ou le **numéro de
téléphone** saisi à l'inscription (format `0701020304` ou `+225 07 01 02 03 04`).

---

## 2. Mot de passe oublié

Page **https://perokado.vercel.app/mot-de-passe-oublie**.

| Situation | Ce qui se passe |
| --- | --- |
| Service d'e-mail configuré (`BREVO_API_KEY` + `EMAIL_FROM`, voir [`docs/EMAIL.md`](EMAIL.md)) | le lien de réinitialisation part tout seul par e-mail |
| Aucun service d'e-mail configuré | la demande est enregistrée et le message invite le client à contacter la boutique |

**Côté boutique**, pour envoyer le lien à la main :
`/admin/utilisateurs` → section **« Envoi des liens et des codes »** → générer le
lien de réinitialisation du client → l'envoyer par WhatsApp. Le lien est valable
**1 heure**.

---

## 3. Côté boutique : ce qu'il faut savoir

- **Voir les clients inscrits** : `/admin/utilisateurs` → section **« Clients de
  la boutique »** (nom, téléphone, dernière connexion, état — les 30 plus récents).
- **Aucun client ne peut entrer dans l'administration** : le rôle est forcé à
  `CUSTOMER` lors de l'inscription, quoi que contienne le formulaire. C'est
  vérifié par un test automatique.
- **Le personnel ne s'inscrit pas ici.** Les comptes agents sont créés dans
  `/admin/utilisateurs`, avec un code d'accès transmis par WhatsApp ; ils ne
  passent jamais par `/inscription`.
- **Commander sans compte reste possible** : l'inscription est un confort (suivi,
  adresses, historique), pas une obligation.

### Limites connues, à connaître

- **Pas de vérification d'adresse e-mail** : quelqu'un peut s'inscrire avec une
  adresse qui n'est pas la sienne. Sans service d'e-mail configuré, il n'y a pas
  de lien de confirmation à cliquer. Conséquence pratique : en cas de doute,
  vérifier l'identité par téléphone avant une livraison hors Daloa.
- **Pas de suppression automatique des comptes inactifs**.
- **Limitation d'abus** : 5 inscriptions par adresse IP et par tranche de
  10 minutes ; au-delà, le message « Trop de créations de compte depuis cette
  connexion » s'affiche.

---

## 4. Messages d'erreur et solutions

| Message affiché | Cause | Solution |
| --- | --- | --- |
| « Un compte existe déjà avec cette adresse. » | l'e-mail est déjà utilisé | se connecter, ou passer par « Mot de passe oublié » |
| « Ce numéro est déjà rattaché à un compte. » | le téléphone est déjà enregistré | utiliser un autre numéro, ou retrouver l'ancien compte |
| « Le mot de passe doit contenir au moins 10 caractères » | mot de passe trop court | rallonger le mot de passe |
| « Le mot de passe doit contenir au moins une lettre et un chiffre » | mot de passe sans chiffre ou sans lettre | ajouter un chiffre (ex. `Quincaillerie2026`) |
| « Adresse e-mail invalide » | il manque `@` ou le domaine | corriger l'adresse |
| « Numéro de téléphone invalide (ex. 0701020304) » | moins de 10 chiffres | saisir les 10 chiffres du numéro ivoirien |
| « Vous devez accepter les conditions de vente » | case non cochée | cocher la case |
| « Trop de créations de compte depuis cette connexion » | plus de 5 inscriptions en 10 minutes | attendre 10 minutes ou changer de réseau |

---

## 5. Détails techniques (pour la maintenance)

- Table `users` : `role = 'CUSTOMER'` et `is_active = true` par défaut ; le mot de
  passe est haché (**scrypt**), jamais stocké en clair.
- Le numéro est enregistré sous forme canonique `+2250701020304`
  (`phone_normalized`), ce qui permet la connexion par téléphone et empêche les
  doublons.
- L'adresse e-mail est mise en minuscules : `Awa.Kone@Example.CI` et
  `awa.kone@example.ci` désignent le même compte.
- La session est créée immédiatement (cookie `perokado_session`, `httpOnly`) et
  l'inscription est journalisée (`auth.register`).
- Tests automatiques : **`tests/registration.test.ts`** — 10 cas (création,
  session, rôle forcé, doublons, mot de passe faible, CGV, normalisation,
  limitation d'abus).
