# Données personnelles — obligations ivoiriennes

> Ce document est un guide technique et opérationnel, **pas un avis juridique**. Les mentions légales
> définitives doivent être validées par le conseil du propriétaire.

## Cadre applicable

- **Loi n° 2013-450** relative à la protection des données à caractère personnel (Côte d'Ivoire).
- **Loi n° 2013-546** relative aux transactions électroniques.
- Autorité de contrôle : **ARTCI** (Autorité de régulation des télécommunications / TIC de Côte
  d'Ivoire).

## Données traitées par la plateforme

| Catégorie | Champs | Finalité |
| --- | --- | --- |
| Compte client | nom, e-mail, téléphone, condensat du mot de passe | authentification, historique de commandes |
| Commandes | coordonnées de livraison, contenu, montants, statuts, référence Wave | exécution de la vente, preuve comptable |
| Demandes d'aide | nom, e-mail, téléphone, message | service client |
| Recherche | requêtes, nombre de résultats | amélioration du catalogue |
| Sécurité | IP, agent utilisateur, journal d'audit | prévention de la fraude, traçabilité des accès |

Aucune donnée bancaire n'est stockée : les paiements Wave ont lieu hors du site.

## Mesures techniques en place

- Mots de passe hachés en **scrypt** avec sel aléatoire ; jamais de mot de passe en clair, ni en base,
  ni dans les journaux.
- Sessions opaques stockées côté serveur (cookie `httpOnly`, `sameSite=lax`, `secure` en production).
- Contrôle d'accès par rôle **côté serveur** sur chaque action sensible, journalisé.
- Isolation des données client : un client ne voit que ses propres commandes, adresses et
  informations ; l'accès par numéro de commande exige un jeton secret ou le compte propriétaire.
- Limitation des tentatives de connexion et des envois de formulaires.
- Secrets uniquement en variables d'environnement ; aucune donnée sensible exposée au navigateur.
- HTTPS obligatoire en production (Vercel).

## À faire par le propriétaire

1. **Déclaration / autorisation** auprès de l'ARTCI selon le traitement réalisé (la déclaration n'est
   pas présumée faite).
2. Désigner un **responsable de traitement** et une adresse de contact pour les demandes de droits.
3. Fixer les **durées de conservation** (comptabilité : conserver les factures selon la durée légale
   applicable ; comptes inactifs : suppression après une durée à définir).
4. Formaliser les contrats avec les sous-traitants (hébergement Vercel, base Neon, stockage des
   images, Wave).
5. Rédiger une procédure de réponse aux demandes d'accès / rectification / effacement (délai de
   réponse à définir, généralement un mois).
6. Prévoir une procédure de notification en cas de violation de données.

## Droits des personnes

Les pages `/confidentialite` et `/contact` expliquent comment exercer ces droits. Les demandes
arrivent dans `/admin` (messages de contact) ; elles doivent être traitées et la réponse consignée.

## Bonnes pratiques internes

- Un compte nominatif par collaborateur, désactivé immédiatement en cas de départ.
- Ne pas exporter la base vers un fichier non chiffré, ne pas envoyer de données clients par messagerie
  non maîtrisée.
- Vérifier chaque trimestre le journal d'audit (`/admin/journal`) pour détecter les accès anormaux.
