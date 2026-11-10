# Expéditions et Colis Express

## Le principe

À Daloa, le colis part avec le livreur de la boutique. **Hors de Daloa**, il part
avec un transporteur — aujourd'hui **Colis Express**
(https://colisexpress-shopin30.vercel.app). Le site ne crée pas le colis :
il enregistre le **code de suivi** remis au guichet et le rend visible au client.

## Le parcours, de bout en bout

1. Le client commande hors Daloa et paie (le prépaiement est obligatoire hors
   Daloa : rien ne part avant l'encaissement).
2. La commande apparaît dans **Administration → Expéditions**, en haut,
   sous « Commandes à expédier ».
3. L'équipe se rend au guichet Colis Express (le lien est sur la page), crée le
   colis et obtient un code de la forme `CLI-XXXXXX`.
4. De retour sur `/admin/expeditions`, l'équipe saisit ce code puis valide.
5. À cet instant :
   - la commande passe en **Expédiée** et sort de la file d'attente ;
   - une ligne d'historique est écrite, avec le code ;
   - le client voit **« Où est mon colis ? »** dans son suivi de commande, avec
     les quatre étapes (Expédié → En transit → Arrivé → Retiré) et le bouton
     **Suivre mon colis chez Colis Express**.

## Les quatre étapes, côté client

| Étape | Signification |
| --- | --- |
| Expédié | Le colis a été remis au guichet |
| En transit | Il roule vers la ville de destination |
| Arrivé | Il est à l'agence, il attend le client |
| Retiré | Le client l'a pris — la commande passe en « Livrée » |

L'équipe peut faire avancer ces étapes depuis l'écran Expéditions : c'est le cas
normal quand le transporteur prévient par WhatsApp plutôt que par une API.

## Ce qui est automatique, ce qui ne l'est pas

**Automatique, sans aucune configuration**

- validation du format du code (`CLI-XXXXXX`, tolérant à la casse et aux
  espaces) ;
- refus des doublons : un code déjà utilisé par une autre commande est rejeté
  (sinon le client suivrait le colis de quelqu'un d'autre) ;
- lien de suivi public calculé et affiché au client ;
- passage de la commande en « Expédiée » puis « Livrée » ;
- journal d'audit de chaque geste.

**Manuel par défaut**

- la mise à jour du statut du colis (l'équipe la saisit).

**Automatique si l'API du prestataire est configurée**

Renseignez `COLIS_EXPRESS_API_BASE` (et `COLIS_EXPRESS_TOKEN` si nécessaire) :

```
COLIS_EXPRESS_API_BASE="https://…"
COLIS_EXPRESS_TOKEN="…"
COLIS_EXPRESS_STATUS_PATH="/api/colis/{code}"
```

Le bouton « Actualiser le statut » lit alors le dernier statut chez le
prestataire et le traduit dans notre vocabulaire. **Aucun point d'accès n'est
deviné** : sans ces variables, la boutique n'appelle rien et l'écran le dit.

## Ce qui est refusé, et pourquoi

| Cas | Réponse |
| --- | --- |
| Code mal formé | « Code de suivi invalide : il doit ressembler à CLI-AB12CD. » |
| Code déjà utilisé | « Ce code de suivi est déjà utilisé par la commande PER-… » |
| Commande non payée | « Le paiement n'est pas confirmé : on n'expédie pas avant d'avoir reçu l'argent. » |
| Commande livrée à Daloa | « Cette commande se livre à Daloa : elle ne passe pas par un transporteur. » |

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/lib/colis-express.ts` | format des codes, lien de suivi, traduction des statuts, API facultative |
| `src/lib/shipments.ts` | enregistrement, compteurs, mise à jour, synchronisation |
| `src/app/actions/shipments.ts` | actions serveur (permission `delivery.manage`) |
| `src/app/admin/expeditions/page.tsx` | l'écran d'expédition |
| `src/components/shipment-tracker.tsx` | le bloc « Où est mon colis ? » du client |
| `drizzle/0011_colis_express.sql` | statut `ARRIVED` et colonnes de suivi |

## Tests

`tests/shipments.test.ts` couvre le parcours complet sur une vraie base :
enregistrement du code, sortie de la file d'attente, refus des doublons et des
commandes non payées, passage en « Livrée », lien de suivi client.
