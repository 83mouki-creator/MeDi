# Paiement Wave

Deux modes, sélectionnés par `WAVE_MODE` :

| Mode | Comportement | Prérequis |
| --- | --- | --- |
| `MANUAL` (par défaut) | la commande reste « paiement à vérifier » ; un administrateur contrôle l'encaissement réel puis confirme | numéro marchand Wave saisi dans `/admin/parametres` |
| `AUTO` | session Checkout créée par l'API, confirmation par webhook signé **et** revérification serveur | clé API Wave Business (Côte d'Ivoire), secret de webhook |

**Aucun mode ne simule un paiement.** Sans clé API, l'application ne prétend jamais qu'un paiement
est encaissé.

## Mode manuel (opérationnel immédiatement)

1. La boutique renseigne son numéro marchand dans `/admin/parametres` (champ « Numéro Wave »).
2. Le client paie depuis son application Wave, puis saisit la **référence de transaction** dans la
   page de commande.
3. Le statut passe à `AWAITING_PAYMENT_VERIFICATION` / `AWAITING_VERIFICATION` : c'est une
   **déclaration**, pas une preuve.
4. Dans `/admin/paiements` (ou le détail de la commande), un ADMIN/OWNER vérifie le crédit sur le
   compte marchand puis confirme ou refuse **avec justification**.
5. La confirmation est **idempotente** : un double clic, un rejeu ou une notification simultanée ne
   décrémente le stock qu'une seule fois.

Une capture d'écran, un SMS ou une déclaration du client ne suffisent jamais. Le refus renvoie la
commande en attente de paiement ; si le client ne régularise pas avant l'expiration de la
réservation, la commande est annulée et le stock libéré (`/api/cron/expire-reservations`).

## Mode automatique (API Checkout)

Prérequis réels, à obtenir auprès de Wave (Business) :

1. Un **compte marchand Wave en Côte d'Ivoire** (les clés sont propres à chaque pays).
2. Une **clé API** `wave_xx_prod_…` : affichée une seule fois à la création.
3. Un **secret de webhook**, enregistré pour l'URL `https://votre-domaine/api/wave/webhook`.
4. Un compte **vérifié** permettant d'encaisser, et la confirmation des conditions tarifaires Wave
   applicables à votre contrat.

Configuration :

```env
WAVE_MODE=AUTO
WAVE_API_KEY="wave_xx_prod_…"
WAVE_WEBHOOK_SECRET="…"
WAVE_SIGNING_SECRET="…"   # si la signature des requêtes est activée sur la clé
```

### Ce que fait l'application

- `POST /v1/checkout/sessions` avec le **montant recalculé côté serveur** (`amount` en chaîne,
  `currency: "XOF"`), une référence client unique et les URL de retour.
- La page de confirmation affiche l'état réel du paiement ; aucune confirmation locale n'est déduite
  de l'URL de retour.
- `POST /api/wave/webhook` : vérifie l'en-tête `Wave-Signature: t=…,v1=…` (HMAC-SHA256 sur
  `t + corps brut`, tolérance de 5 minutes, comparaison à temps constant), refuse tout appel sans
  secret configuré, déduplique par identifiant d'événement, puis **re-interroge l'API Wave**
  (`GET /v1/checkout/sessions/:id`) pour vérifier `payment_status` et le montant avant confirmation.
- En cas d'incohérence de montant, rien n'est confirmé et l'incident est journalisé.

### Ce qui reste à faire par le propriétaire

- Obtenir les identifiants ci-dessus et les placer dans Vercel (jamais dans le dépôt).
- Enregistrer le webhook côté Wave et vérifier la réception sur un paiement de test réel.
- Décider du mode définitif (`MANUAL` ou `AUTO`) et documenter la procédure de contrôle interne.

### Alternatives documentées

Si l'ouverture d'un compte Wave Business n'aboutit pas, des agrégateurs ivoiriens existent
(CinetPay, PayDunya, Hub2, GeniusPay…). Aucun n'est intégré ici : une intégration supplémentaire
demande un développement dédié et ne doit jamais être simulée.
