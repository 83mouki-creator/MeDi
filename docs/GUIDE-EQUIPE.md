# Guide de l'équipe — comment utiliser le site MeDi Shop

Ce guide existe en deux endroits :

- **dans le site**, à l'adresse `/admin/guide` — il est écrit dans la langue de
  l'administration (français ou arabe) et s'adapte aux droits de la personne
  connectée ;
- **ici**, pour l'impression et la formation d'un nouvel arrivant.

Il répond à une seule question : *que dois-je faire, concrètement, quand
j'ouvre le site ce matin ?*

---

## 1. Comprendre le site en une minute

Le site MeDi Shop sert à deux choses : montrer les produits aux clients, et dire à
l'équipe exactement ce qu'il faut préparer.

1. **Le client choisit et commande.** Il parcourt le catalogue, met des articles
   dans son panier, indique son quartier de Daloa — ou sa ville hors Daloa.
2. **Le client paie.** Par Wave, ou en espèces à la livraison quand c'est
   autorisé. Une capture d'écran ne vaut jamais preuve de paiement : c'est la
   boutique qui vérifie l'argent reçu.
3. **L'équipe prépare le colis.** Les articles sont comptés, contrôlés,
   emballés. Le stock se met à jour tout seul.
4. **Le client reçoit.** Retrait gratuit en boutique sous 48 h, livraison dans un
   quartier de Daloa, ou expédition hors Daloa en 7 jours maximum.

## 2. Le voyage d'une commande

Une commande passe par neuf étapes. À chacune correspond **une seule** action.

| Étape affichée | Ce que l'équipe fait |
| --- | --- |
| En attente de confirmation | Rien tout de suite : la commande vient d'arriver. Appeler le client si un détail manque. |
| En attente de paiement | Le client n'a pas encore payé : laisser la commande ouverte, rappeler le numéro Wave. |
| Paiement à vérifier | Ouvrir le paiement, vérifier l'argent sur le compte Wave ou dans la caisse, puis confirmer. |
| Paiement confirmé | L'argent est là : sortir les articles et préparer le carton. |
| En préparation | Compter les pièces, contrôler la référence et l'état, emballer. |
| Prête à expédier | Imprimer le bon de livraison, prévenir le client. |
| Expédiée | Noter le nom du transporteur dans la fiche commande. |
| En cours de livraison | Rester joignable au téléphone. |
| Livrée | La commande est terminée : le client a signé le bon. |

Deux issues possibles : **Annulée** (remettre les articles en rayon, le stock se
libère tout seul) et **Remboursée** (noter la raison dans la fiche).

## 3. La routine du jour

Dans cet ordre. Si l'équipe ne fait que cela, la boutique tourne.

1. **Ouvrir la caisse** — `/admin/caisse` : noter l'argent présent au départ.
2. **Vérifier les paiements** — `/admin/paiements` : chaque client qui dit avoir
   payé attend une confirmation.
3. **Préparer les colis** — `/admin/commandes?status=PAYMENT_CONFIRMED`.
4. **Répondre aux messages** — `/admin/messages` : une question sans réponse est
   une vente perdue.
5. **Fermer la caisse** — `/admin/caisse` : compter l'argent du soir.
6. **Regarder le stock** — `/admin/stock` : les produits bientôt finis sont
   signalés.

## 4. Les gestes utiles

| Geste | Où | Comment |
| --- | --- | --- |
| Faire une promotion | `/admin/promotions` | Choisir des produits, un pourcentage et les dates : le prix et le bandeau s'affichent aussitôt sur le site. |
| Changer le stock | `/admin/stock` | Une pièce : la fiche du produit. Tout le stock d'un coup : les boutons **+** et **−** en haut de la page. |
| Imprimer un bon de livraison | `/admin/bons` | Le bon reprend les produits commandés et se règle pour les imprimantes de comptoir (80 mm). |
| Ouvrir / fermer la caisse | `/admin/caisse` | Le matin : l'argent du départ. Le soir : comparaison avec les ventes du jour. |
| Créer un accès agent | `/admin/utilisateurs` | Nom, numéro ivoirien, tâche assignée. Aucun mot de passe : un code part par WhatsApp. |
| Voir qui a fait quoi | `/admin/journal` | Chaque geste sensible (prix, stock, paiement) est écrit en clair, avec le nom de la personne. |

## 5. Les mots de l'écran

- **Paiement à vérifier** : le client dit avoir payé, mais l'encaissement n'a pas
  encore été constaté. Rien ne part avant confirmation.
- **Réservé** : une pièce mise de côté pour une commande en cours ; elle n'est
  plus proposée aux autres clients.
- **Seuil** : le nombre à partir duquel le produit passe en alerte « bientôt
  fini ».
- **Bon de livraison** : le papier remis au livreur (produits, quantité,
  adresse de livraison).
- **Caisse** : le tiroir de la boutique, avec son ouverture et sa fermeture.
- **Hors Daloa** : une autre ville ; les articles se règlent d'abord, le
  transport se discute sur WhatsApp.

## 6. En cas de problème

- **Le client dit avoir payé, mais on ne voit rien** : ne pas confirmer ;
  demander la référence Wave et l'heure du paiement ; vérifier le compte ; puis
  répondre.
- **Le client ne vient pas chercher son colis** : l'appeler. Un colis payé en
  ligne est gardé 48 h maximum en boutique, puis les articles retournent en
  stock.
- **Le produit est arrivé abîmé** : demander au client de refuser le colis ou de
  le signaler au livreur le jour même, avec des photos ; tout noter dans la
  fiche commande.
- **Demande de remboursement après livraison** : expliquer la règle avec calme —
  une fois le produit livré, ni l'argent n'est rendu, ni le produit n'est
  remplacé. En cas de problème, appeler le service client.
- **Erreur de prix ou de stock** : corriger dans la bonne page, puis vérifier
  l'historique ; chaque changement est daté et signé, rien n'est effacé.

## 6 bis. Vérifier que tout est prêt à vendre

Dans le menu, ouvrez **Prêt à vendre** (`/admin/pret-a-vendre`). La page regarde
les vraies données de la boutique et répond à une seule question : *peut-on
vendre sans aide extérieure ?*

- **Bloquant** (rouge) : sans cela, une commande ne peut pas aboutir. À corriger
  d'abord (numéro Wave, produits publiés, stock, zones de livraison de Daloa).
- **À compléter** (orange) : la vente fonctionne, mais le client hésitera
  (photos manquantes, mentions légales, horaires).
- **En place** (vert) : rien à faire.

Chaque ligne mène directement à l'écran à corriger. La page se recalcule à
chaque ouverture : dès qu'un champ est enregistré, le point passe au vert.

## 7. Langues

- La boutique (ce que voient les clients) : sélecteur **FR / EN / ع** dans
  l'en-tête. Le choix est mémorisé dans un cookie et s'applique immédiatement.
- L'administration : bouton **العربية / Français** dans la barre supérieure. Ce
  réglage est indépendant de la langue de la boutique.

## 8. Les trois phrases à retenir

1. Rien ne part avant que l'argent soit vérifié par l'équipe.
2. Un colis, un bon de livraison imprimé, un stock à jour.
3. Un doute ? Le guide, puis le service client : **+225 07 08 90 48 91**.

---

*Ce document accompagne la page `/admin/guide`. Les textes affichés dans le site
sont dans `src/lib/admin-guide.ts` ; chaque phrase y est traduite en arabe, et un
test le vérifie (`tests/admin-guide.test.ts`).*
