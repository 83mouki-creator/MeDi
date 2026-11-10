# E-mails : Brevo, domaine `.com` et authentification

> Ce que le site envoie, avec quel fournisseur, et comment le mettre en place
> proprement — de l'achat du domaine jusqu'aux tests de livraison.

Tout le code est déjà là. Il ne reste que **des comptes et des variables
d'environnement** : aucune ligne de programmation à écrire.

---

## 1. Ce que la boutique envoie maintenant

| E-mail | Déclencheur | Contenu | Destinataire |
| --- | --- | --- | --- |
| **Bienvenue** | juste après la création d'un compte (`/inscription`) | confirmation du compte, lien vers l'espace client, rappel qu'on peut commander sans compte | l'adresse saisie |
| **Commande enregistrée** | juste après la validation d'une commande (`/paiement`) | numéro, articles, montants, mode de retrait/livraison, lien de suivi sécurisé, règles de la boutique | l'adresse de la commande |
| **Votre bon de commande** | bouton « Recevoir le bon par e-mail » sur la page de confirmation / de suivi | le justificatif complet (articles, remises, total, état du paiement) | l'adresse du compte, ou celle de la commande |
| **Réinitialisation du mot de passe** | `/mot-de-passe-oublie`, ou action de l'administrateur | lien à usage unique valable 60 minutes | l'adresse du compte |

Trois principes tenus par le code :

1. **Rien ne bloque jamais.** L'envoi part *après* la réponse HTTP (`after()` de
   Next.js) : une panne de Brevo ne fait ni échouer une commande, ni tourner une
   inscription en erreur.
2. **Aucune donnée inventée.** Les montants et les articles viennent de la base,
   les règles (retrait 48 h, 7 jours hors Daloa, « ni remboursé, ni remplacé »)
   viennent de `src/lib/store-policy.ts`. Une coordonnée absente disparaît du
   message au lieu d'afficher un texte de remplissage.
3. **Sans fournisseur configuré, rien n'est promis.** Les écrans continuent
   d'afficher les liens à transmettre par WhatsApp ; le bouton « Recevoir le bon
   par e-mail » n'apparaît pas.

Fichiers concernés : `src/lib/email.ts` (fournisseur), `src/lib/email-templates.ts`
(modèles HTML + texte), `src/lib/email-queue.ts` (envoi différé), `src/lib/order-mail.ts`
(données de commande), `src/app/actions/order-email.ts` (renvoi du bon).

---

## 2. Choisir le domaine `.com`

### Structure recommandée

```
perokado.com              ← domaine racine (le seul à acheter)
├── www.perokado.com      ← site public (alias Vercel)
├── contact@perokado.com  ← boîte principale : les réponses arrivent ici
├── commandes@perokado.com← alias (même boîte)
├── no-reply@perokado.com ← expéditeur des e-mails automatiques
└── _dmarc / brevo / DKIM…     ← enregistrements techniques (§3)
```

Pourquoi ce découpage : `no-reply@` **n'ouvre pas de boîte**. Il ne sert qu'à
signer les messages automatiques, ce qui évite de ternir la réputation de
`contact@` si un jour un message part en spam.

### Candidats (à vérifier chez le registrar — la disponibilité change)

| Domaine | Avantages | À savoir |
| --- | --- | --- |
| `perokado.com` | marque + ville, se retient au téléphone | le plus long à taper |
| `medishop-ci.com` | indique la Côte d'Ivoire | le tiret s'oublie à l'oral |
| `medishops.com` | très court | peut prêter à confusion (« shop's ») |
| `medishop.com` | idéal… | très probablement déjà pris, et cher |

**Recommandation : `perokado.com`.** Le nom exact de la boutique est
« Perokado », la ville est le cœur du commerce : le domaine dit les deux.

Où l'acheter : n'importe quel registrar sérieux (Namecheap, Porkbun, OVH,
Gandi…). Ce qui compte : **accès au DNS** (zone « DNS » ou « Zone editor ») et
possibilité de créer des `TXT` et des `CNAME`. Éviter les offres « domaine +
hébergement » dont le DNS n'est pas modifiable.

> ⚠️ Le `.com` ne remplace pas les obligations de la boutique : l'adresse
> postale, le téléphone et les CGV restent ceux du site. Le domaine ne sert
> qu'à l'identité et aux e-mails.

### Une fois le domaine acheté

1. **Vercel** → projet `medi-daloa` → *Settings → Domains* → ajouter
   `perokado.com` et `www.perokado.com`, puis suivre les instructions
   (enregistrement `A` pour la racine, `CNAME` pour `www`).
2. **Vercel** → *Settings → Environment Variables* : `APP_URL` =
   `https://perokado.com` (les liens des e-mails et le retour Wave en
   dépendent), puis **Redéployer**.
3. L'ancienne adresse `perokado.vercel.app` continue de fonctionner : rien ne
   casse pendant la transition.

---

## 3. Authentification du domaine dans Brevo

Brevo signe les messages avec **trois enregistrements DNS** : le *Brevo code*
(preuve que le domaine est à vous), **DKIM** (signature) et **DMARC** (règles).

### 3.1 Créer le compte

1. https://www.brevo.com → *Sign up free* (300 e-mails/jour, sans carte).
2. Renseigner l'entreprise : **Perokado**, Daloa, Côte d'Ivoire.
3. Brevo peut demander une validation du compte avant le premier envoi : c'est
   normal, la validation prend en général quelques heures.

### 3.2 Déclarer le domaine

*Settings* (menu du compte) → **Senders, Domains, IPs → Domains** →
**Add a domain** → saisir `perokado.com` (sans `www`, sans `@`).

Brevo propose alors deux chemins :

- **Authentification automatique** (recommandée si ton registrar est reconnu) :
  Brevo se connecte à ton compte registrar et pose les enregistrements lui-même.
- **Authentification manuelle** : Brevo affiche les enregistrements à copier.

### 3.3 Les enregistrements à créer (méthode manuelle)

| Rôle | Type | Nom (hôte) | Valeur | Où la trouver |
| --- | --- | --- | --- | --- |
| **Brevo code** | `TXT` | `@` (ou `brevo-code`) | `brevo-code:…` | écran Brevo, bouton *Copy* |
| **DKIM 1** | `CNAME` | `brevo1._domainkey` | `b1.medishopdaloa-com.dkim.brevo.com` | idem |
| **DKIM 2** | `CNAME` | `brevo2._domainkey` | `b2.medishopdaloa-com.dkim.brevo.com` | idem |
| **DMARC** | `TXT` | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@perokado.com` | proposé par Brevo |

> **Ne recopie pas les valeurs ci-dessus telles quelles** : Brevo génère des
> valeurs propres à ton compte. Ce tableau donne la *forme* ; les chaînes
> exactes se copient depuis l'écran Brevo (bouton *Copy* à côté de chaque
> champ). Certains comptes reçoivent **un seul DKIM en `TXT`** au lieu de deux
> `CNAME` — dans ce cas, crée exactement ce que Brevo affiche.

Détails qui évitent 90 % des échecs :

- Chez la plupart des registrars, le nom d'hôte se saisit **sans** le domaine :
  `brevo1._domainkey` (et non `brevo1._domainkey.perokado.com`). Si ton
  registrar ajoute le domaine automatiquement, mettre le nom complet crée
  `…perokado.com.perokado.com` — l'authentification échouera.
- La valeur d'un `CNAME` **ne se termine pas par un point** chez certains
  registrars, et **doit** en avoir un chez d'autres. Si la vérification échoue,
  teste l'autre forme.
- Le `TXT` DMARC peut contenir une espace : c'est normal, tout est entre
  guillemets.
- **SPF** : inutile pour les envois Brevo en IP partagée (Brevo gère son propre
  SPF de retour). N'ajoute un `include:spf.brevo.com` que si Brevo te le demande
  explicitement (IP dédiée ou *Return-Path* personnalisé). S'il existe déjà un
  SPF (`v=spf1 …`), il ne doit y avoir **qu'un seul** enregistrement SPF.
- La propagation DNS prend de quelques minutes à quelques heures.

### 3.4 Vérifier

Retour dans Brevo → **Authenticate / Verify**. Les trois lignes doivent passer au
vert. En cas d'échec, Brevo indique l'enregistrement fautif : corriger, attendre
15 minutes, relancer.

Contrôle indépendant, dans un terminal (ou sur https://mxtoolbox.com) :

```bash
dig +short TXT  _dmarc.perokado.com
dig +short CNAME brevo1._domainkey.perokado.com
dig +short TXT  perokado.com | grep -i brevo
```

### 3.5 Déclarer l'expéditeur

Toujours dans **Senders, Domains, IPs → Senders** : ajouter
`no-reply@perokado.com` (nom affiché : **Perokado**). Brevo envoie un
e-mail de confirmation à cette adresse : cliquer sur le lien.

> Une adresse d'expéditeur doit appartenir au domaine authentifié. Un
> `@gmail.com` est accepté par Brevo mais **casse la signature DKIM** : les
> messages finissent souvent en spam. C'est précisément ce que le domaine règle.

### 3.6 Créer la clé API

Haut à droite → **SMTP & API** → onglet **API Keys** →
*Generate a new API key* → nom `medi-shop-vercel` → copier la clé
(`xkeysib-…`). Elle n'est affichée qu'une fois.

---

## 4. Recevoir le courrier (`contact@`)

Brevo **envoie** mais n'héberge pas de boîte. Deux solutions gratuites :

| Solution | Comment | Résultat |
| --- | --- | --- |
| **Redirection du registrar** | la plupart des registrars offrent « e-mail forwarding » | `contact@` → la boîte Gmail de la boutique |
| **Zoho Mail (offre gratuite)** | boîte complète sur le domaine | répondre *depuis* `contact@` |

Un simple transfert suffit au départ : les clients écrivent à `contact@`, le
responsable lit dans sa boîte habituelle, et `EMAIL_REPLY_TO` fait que les
réponses à un e-mail automatique arrivent aussi au bon endroit.

Pour que le transfert fonctionne, il faut les enregistrements **MX** fournis par
le prestataire choisi. Ils n'ont aucun effet sur l'envoi.

---

## 5. Configurer Vercel

Projet `medi-daloa` → *Settings → Environment Variables*, pour **Production** et
**Preview** :

| Nom | Valeur | Obligatoire |
| --- | --- | --- |
| `BREVO_API_KEY` | `xkeysib-…` | oui |
| `EMAIL_FROM` | `Perokado <no-reply@perokado.com>` | oui |
| `EMAIL_REPLY_TO` | `contact@perokado.com` | recommandé |
| `APP_URL` | `https://perokado.com` | oui (si le domaine change) |

Puis **Deployments → ⋯ → Redeploy** : les variables ne sont lues qu'au
démarrage d'un déploiement.

`EMAIL_FROM` doit contenir **exactement** l'adresse vérifiée en 3.5, sinon Brevo
répond `400`.

---

## 6. Vérifier de bout en bout

| Étape | Où | Résultat attendu |
| --- | --- | --- |
| 1 | `/admin/parametres` | « Fournisseur : brevo » |
| 2 | `/inscription` avec une vraie adresse | e-mail « votre compte est créé » sous une minute |
| 3 | commander en invité avec une adresse | e-mail « commande … enregistrée » |
| 4 | page de confirmation → **Recevoir le bon par e-mail** | e-mail « votre bon de commande » |
| 5 | `/mot-de-passe-oublie` | e-mail avec bouton, lien valable 1 h |
| 6 | répondre à l'un de ces e-mails | la réponse part vers `contact@` |

Pendant les premiers jours, **regarder le dossier spam** : la réputation d'un
domaine neuf se construit en quelques semaines. Les gestes qui accélèrent :
envoyer à des adresses qui ouvrent vraiment les messages, ne pas faire d'envoi
en masse, garder `p=none` en DMARC.

---

## 7. Dépannage

| Symptôme | Cause probable | Correction |
| --- | --- | --- |
| `Brevo HTTP 401` | clé API fausse, révoquée, ou copiée avec un espace | régénérer la clé, la recoller |
| `Brevo HTTP 400` | `EMAIL_FROM` ≠ adresse d'expéditeur vérifiée ; domaine non authentifié | corriger `EMAIL_FROM` |
| `Brevo HTTP 403` | compte Brevo pas encore validé pour l'envoi | terminer la validation |
| Rien ne part, aucune erreur | `BREVO_API_KEY` ou `EMAIL_FROM` absent → `configured: false` | ajouter les deux, redéployer |
| Messages en spam | domaine neuf, DMARC absent, ou expéditeur hors domaine | vérifier DKIM dans Brevo, puis « Afficher l'original » dans Gmail |
| Liens vers `localhost:3000` | `APP_URL` non défini en production | mettre `https://perokado.com` |
| Le bouton « Recevoir le bon » n'apparaît pas | service non configuré au moment du rendu | vérifier `/admin/parametres`, redéployer |

Les erreurs d'envoi sont écrites dans les **logs Vercel** avec le préfixe
`[email]` ou `[checkout]`.

---

## 8. Limites et coûts

- **Gratuit** : 300 e-mails/jour chez Brevo — très au-delà du besoin (une
  dizaine par jour en pointe).
- Brevo ajoute une signature « Sent with Brevo » sur l'offre gratuite (elle
  disparaît sur les offres payantes, à partir d'environ 9 $/mois).
- Pas de pièce jointe PDF pour l'instant : le bon est un e-mail HTML + un lien
  vers la page imprimable (le navigateur fait « Imprimer / PDF »). Une vraie
  pièce jointe demanderait un générateur PDF côté serveur.
- Les e-mails transactionnels sont **en français**. Les pages publiques sont en
  FR/EN/AR ; les messages automatiques suivent la langue de la boutique.
- Un e-mail ne prouve pas l'identité : pas de vérification d'adresse à
  l'inscription (voir `docs/INSCRIPTION.md`).

---

## 9. Basculer sur Resend (option)

Le code gère les deux fournisseurs. Pour passer à Resend : supprimer
`BREVO_API_KEY`, ajouter `RESEND_API_KEY` (https://resend.com/api-keys) et
vérifier le domaine chez Resend (mêmes DKIM/DMARC). `EMAIL_FROM` et
`EMAIL_REPLY_TO` restent identiques. Gratuit : 3 000 e-mails/mois, plafond
100/jour.

---

## 10. Modèles d'e-mails : où les modifier

| Élément | Fichier |
| --- | --- |
| Couleurs, en-tête, pied de page | `src/lib/email-templates.ts` (`layout`) |
| Bienvenue | `welcomeEmail` |
| Réinitialisation | `passwordResetEmail` |
| Commande / bon | `orderEmail` |
| Règles affichées (48 h, 7 jours, finale) | `src/lib/store-policy.ts` |
| Coordonnées du pied de page | réglages de la boutique (`/admin/parametres`) |

Les tests (`tests/email.test.ts`) vérifient le contenu, l'échappement HTML et la
requête exacte envoyée à Brevo : toute modification d'un modèle est contrôlée
avant la mise en ligne.
