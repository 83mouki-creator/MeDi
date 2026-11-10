# Vendre seul : ce qu'il reste à faire

Dernière mise à jour : **2026-11-10**.

Cette page répond à une seule question : **est-ce que la boutique peut encaisser une
commande, la préparer, l'expédier et répondre au client sans que le propriétaire
intervienne ?**

Elle n'est pas écrite à la main. Le diagnostic vit dans le code
(`src/lib/readiness.ts`) et s'affiche en direct dans **Administration → Prêt à
vendre** (`/admin/pret-a-vendre`). Chaque point est calculé à partir des données
réellement enregistrées : si vous corrigez un champ, la page change
immédiatement. Ce document explique le *pourquoi* ; l'écran donne le *où*.

> Un point est **bloquant** quand une commande ne peut pas aboutir sans lui,
> **à compléter** quand la vente fonctionne mais que la confiance ou l'autonomie
> en souffre, **en place** sinon.

---

## 1. Ce qui est déjà en place (rien à faire)

| Domaine | État |
| --- | --- |
| Catalogue | 146 références, 8 rayons, photos, prix et stock en base |
| Panier et commande | Recalcul serveur, réservation de stock, expiration automatique |
| Paiement | Wave (mode manuel vérifié) ou espèces à la livraison sous plafond |
| Livraison | Zones de Daloa par quartier + villes hors Daloa, frais affichés avant paiement |
| Suivi client | Numéro de commande + téléphone, frise, historique horodaté |
| Administration | 20 écrans, rôles, permissions serveur, journal d'audit |
| Expéditions | Colis Express : code de suivi, lien client, étapes du colis |
| Messages | Boîte de réception des demandes clients |
| Sécurité | Sessions serveur, scrypt, limitation des tentatives, aucune donnée client croisée |

---

## 2. Ce qui dépend de vous (contenu et décisions)

### 2.1 Mentions légales et identité de l'entreprise — **à compléter**

**Pourquoi c'est nécessaire** : au-delà de l'obligation commerciale, un client qui
paie par mobile money veut savoir à qui il envoie son argent. La page
`/mentions-legales` existe mais reste vide tant que la raison sociale, le RCCM et
le compte contribuable ne sont pas saisis.

**Où** : Administration → Réglages → Mentions légales.

### 2.2 Photos et fiches produits — **à compléter**

**Pourquoi** : une fiche sans photo se vend mal et génère une question WhatsApp,
donc du temps. Le diagnostic compte les produits publiés qui ont au moins une
photo et nomme l'écart.

**Où** : Administration → Photos et imports.

### 2.3 Zones de livraison — **bloquant au premier jour**

**Pourquoi** : tant qu'aucune zone de Daloa n'a de tarif, un client de Daloa ne
peut pas choisir son quartier, donc ne peut pas commander. Le barème est déjà
chargé ; c'est une vérification à faire, pas une saisie complète.

**Où** : Administration → Livraisons.

### 2.4 Questions clients sans réponse — **à compléter**

**Pourquoi** : c'est le seul point qui dépend d'une présence humaine, et c'est
celui qui fait revenir un client. Le diagnostic affiche le nombre de messages
ouverts. Un agent peut le traiter ; vous n'avez pas à le faire vous-même.

**Où** : Administration → Messages des clients.

### 2.5 Colis payés en attente d'expédition — **bloquant**

**Pourquoi** : le client a payé, le colis doit partir. Tant qu'une commande hors
Daloa payée n'a pas de code de suivi, elle apparaît en tête de l'écran
Expéditions et bloque le verdict. C'est voulu : c'est la seule tâche où un
oubli coûte de l'argent au client.

**Où** : Administration → Expéditions.

---

## 3. Ce qui dépend de la technique (configuration)

### 3.1 Stockage des photos — **bloquant en production**

**Pourquoi** : en production, le disque local est éphémère. Une photo ajoutée
disparaît au déploiement suivant — le produit reste, l'image non.
Deux solutions sont déjà codées : Cloudinary (`STORAGE_DRIVER=cloudinary` +
identifiants) ou la base de données (repli automatique, sans service externe).

### 3.2 Synchronisation des statuts Colis Express — **à compléter, facultatif**

**Pourquoi** : ce qui fonctionne **déjà** sans aucune configuration, c'est le
lien de suivi public du transporteur (`/suivi.html?code=CLI-XXXXXX`), affiché au
client dans son suivi de commande. Ce qui manque seulement, c'est la lecture
automatique du statut : aujourd'hui l'équipe le met à jour à la main, ce qui
demande une action par colis.

**Pour l'activer** : `COLIS_EXPRESS_API_BASE` (et `COLIS_EXPRESS_TOKEN` si le
prestataire en exige un). Le chemin de lecture est `COLIS_EXPRESS_STATUS_PATH`,
par défaut `/api/colis/{code}`. Aucun point d'accès n'est deviné : sans ces
variables, la boutique n'appelle rien et le dit dans l'écran Expéditions.

### 3.3 E-mails transactionnels — **à compléter**

**Pourquoi** : sans fournisseur, les liens de réinitialisation de mot de passe
sont remis sur WhatsApp par un agent. Cela fonctionne, mais ce n'est pas
autonome. `BREVO_API_KEY` ou `RESEND_API_KEY` + `EMAIL_FROM` suffisent.

### 3.4 Tâches planifiées — **en place** (vérifier `CRON_SECRET`)

**Pourquoi** : `vercel.json` déclare déjà la tâche qui libère les réservations de
stock expirées. Sans elle, le stock n'est rendu à la vente qu'à la visite d'un
client : cela marche, mais moins régulièrement. Le diagnostic compte les tâches
réellement déclarées.

### 3.5 Adresse publique en HTTPS — **à vérifier**

**Pourquoi** : `APP_URL` sert à construire les liens de retour de paiement et les
liens de suivi envoyés au client. En HTTP, certains liens sont refusés.

---

## 4. Ce qui reste hors de portée du logiciel

Il faut le dire clairement, parce que c'est ce qui décide si la boutique tourne
vraiment toute seule :

1. **La vérification des paiements Wave.** En mode manuel, quelqu'un doit
   comparer la référence saisie par le client avec le crédit reçu. Tant que le
   mode `AUTO` (API Wave + webhooks) n'est pas activé avec de vraies clés, cette
   étape reste humaine. C'est le point le plus structurant du dispositif.
2. **Le dépôt physique des colis.** Le site ne peut pas remettre un carton à un
   guichet : l'équipe crée le colis chez Colis Express, saisit le code, et le
   client suit ensuite tout seul.
3. **La réponse aux questions.** Aucun modèle ne répond à la place de la
   boutique : c'est un choix assumé (aucune réponse inventée).
4. **Le réapprovisionnement.** Le stock se décrémente tout seul ; la commande
   fournisseur, non.

---

## 5. Verdict actuel

À la date de ce document, en production :

- **Bloquants** : aucun côté code ; les points ouverts sont la configuration du
  stockage et la vérification des paiements Wave.
- **Finitions** : mentions légales, e-mails, synchronisation Colis Express.
- **Autonomie réelle** : la boutique peut **encaisser, réserver le stock,
  préparer, expédier et informer le client** sans intervention. Elle ne peut pas
  encore **confirmer un paiement Wave sans un humain** ni **réapprovisionner**.

La liste exacte, à jour, est sur `/admin/pret-a-vendre`. C'est elle qui fait foi :
ce document explique, l'écran constate.
