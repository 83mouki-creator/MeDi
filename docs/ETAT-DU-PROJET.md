# État du projet

Dernière mise à jour : **2026-11-01**.

## Résumé honnête

La plateforme est **fonctionnelle de bout en bout sur le plan logiciel** : catalogue réel en base,
recherche texte et visuelle, panier recalculé côté serveur, commandes avec réservation de stock,
paiement Wave (mode manuel vérifié par un administrateur), espace client, back-office complet,
migrations versionnées, build de production et **116 tests d'intégration exécutés avec succès**.

Elle n'est **pas encore « prête à vendre »** en production, pour des raisons qui ne sont pas du code :
identifiants Wave (ou validation du mode manuel), coordonnées et mentions légales de la boutique,
photos et catalogue réels, configuration du stockage d'images et de la base Neon.

## Terminé et vérifié

### Boutique
- Accueil : hero, recherche, rayons, promotions, meilleures ventes, nouveautés, marques, bloc
  livraison Daloa / national, bandeau WhatsApp conditionnel, pied de page complet.
- Catalogue : filtres persistés dans l'URL (catégorie, marque, prix, disponibilité, promotions),
  tri, pagination, compteur, états vide / chargement / erreur.
- Fiche produit : référence, galerie, prix FCFA, promotion, caractéristiques, disponibilité explicite
  (en stock / plus que N / épuisé / précommande), produits similaires et complémentaires, info
  retrait et livraison, données structurées `Product` (SEO).
- Recherche : nom, référence, marque, catégorie, mots-clés et synonymes ; préfixe, similarité,
  tolérance aux fautes (pg_trgm + full-text français) ; suggestions instantanées.
- Recherche visuelle : capture photo (mobile) ou fichier, aperçu, reprise, analyse, résultats avec
  score et avertissement d'incertitude ; comparaison réelle aux photos indexées.
- Panier : cookie `httpOnly`, recalcul serveur des prix/promos/disponibilités, quantités bornées,
  fusion des doublons.
- Commande : destination choisie avant le paiement, retrait / livraison locale / transporteur,
  frais issus de la base, paiement Wave ou espèces, prépaiement obligatoire hors Daloa, page de
  confirmation protégée par jeton, suivi par numéro + téléphone.
- Espace client : inscription, connexion, déconnexion, profil, mot de passe, adresses, commandes et
  détail, isolation stricte des données.
- Pages : livraison, paiement, retours, CGV, confidentialité, mentions légales, contact,
  `not-found`, `error`, `sitemap.xml`, `robots.txt`, `/api/health`.

### Administration
- Connexion e-mail + mot de passe (scrypt), sessions serveur, limitation des tentatives, aucun
  compte public, aucun mot de passe par défaut.
- Rôles OWNER / ADMIN / STOCK_MANAGER / ORDER_MANAGER avec contrôle serveur de chaque permission et
  journal d'audit.
- Interface d'administration **bilingue français / arabe** (arabe standard, mise en page RTL
  complète) : bascule mémorisée par cookie, données du catalogue laissées dans leur langue de
  saisie, boutique publique toujours en français.
- Interface d'administration **séparée de la boutique** : mise en page dédiée, sans en-tête, sans
  panier client et sans recherche publique. Tous les onglets sont repliés derrière un bouton à trois
  traits qui ouvre un panneau coulissant (fermeture par Échap, par le voile, à la navigation).
- Tableau de bord, produits (CRUD, promotions, photos, caractéristiques, archivage), stock avec
  recherche, filtres, compteurs et pagination, catégories, marques, commandes (recherche, filtres,
  statuts, paiement, expédition, notes), paiements à vérifier, **demandes clients reçues via le
  formulaire de contact** (prise en charge, clôture, réouverture), zones de livraison, paramètres,
  import CSV, import de photos, utilisateurs, journal d'activité (recherche), statistiques.
- Import CSV du catalogue avec simulation, rapport ligne par ligne, mise à jour par référence.
- Import massif de photos avec empreinte SHA-256, file de validation, rattachement manuel, rejet motivé.

### Technique
- Schéma relationnel normalisé (24 tables) avec clés étrangères, contraintes `CHECK` (stock ≥ 0,
  prix > 0), index de recherche, mouvements de stock, instantanés nom/référence/prix dans les lignes
  de commande.
- Migrations SQL versionnées (`drizzle/0000_init.sql`, `0001_contact_messages.sql`).
- Résolution automatique de la connexion directe (`src/lib/db-url.ts`) : compatible `DIRECT_URL`,
  `DATABASE_URL_UNPOOLED` (intégration Neon/Vercel), `POSTGRES_URL_NON_POOLING`, ou dérivation depuis
  l'URL poolée.
- Transactions avec verrou `FOR UPDATE` sur le stock ; numérotation `MED-AAAA-NNNNN` par séquence.
- Webhook Wave : signature HMAC, anti-rejeu, idempotence par événement, revérification du montant.
- Tâche planifiée d'expiration des réservations protégée par `CRON_SECRET`.
- Stockage d'images : local ou Cloudinary, validation du type réel, normalisation WebP.
- SEO : métadonnées, canoniques, plan du site, robots, données structurées.
- Build de production et TypeScript strict sans erreur ; 116 tests passants.

## Partiel — code présent, à valider avec les moyens du propriétaire

| Élément | Ce qui manque exactement |
| --- | --- |
| Paiement Wave automatique | clé API, secret de webhook, test réel. Le mode manuel est opérationnel. |
| Recherche visuelle « calibrée » | fournisseur sémantique (`VISION_PROVIDER=http`) et recalibrage des seuils. En l'état : descripteur local, résultats présentés comme pistes. |
| Envoi d'e-mails (mot de passe oublié) | fournisseur SMTP/API e-mail. Le mécanisme existe, l'expédition réelle doit être branchée. |
| Stockage des images en production | identifiants Cloudinary (sinon le disque des fonctions Vercel n'est pas persistant). |
| Vérification mobile réelle | test sur téléphone (mise en page, caméra, lenteur réseau). |
| Mentions légales / CGV définitives | RCCM, compte contribuable, forme juridique, adresse, tribunal compétent, politique de retour. |

## Renseigné par le propriétaire (2026-10-29)

| Élément | Valeur | Où la modifier |
| --- | --- | --- |
| Horaires | lundi – samedi 7h30 – 18h00, dimanche fermé | `/admin/parametres` |
| WhatsApp / téléphone | +225 07 08 90 48 91 | `/admin/parametres` |
| Numéro marchand Wave | même numéro (provisoire) | `/admin/parametres` |
| Logo | fourni par le propriétaire, décliné par `npm run brand:assets` | `public/brand/` |
| Barème de livraison | arrêté par le prestataire à la demande du propriétaire | `/admin/livraison` |

Ces valeurs sont posées par `npm run config:store`, exécuté à chaque déploiement :
le script ne remplit que les champs vides, les modifications faites dans
`/admin` ne sont donc jamais écrasées (`--force` pour réappliquer).

Barème en vigueur (modifiable) : retrait gratuit · Daloa centre 1 000 FCFA ·
Daloa périphérie 2 000 FCFA · Abidjan 4 000 · Yamoussoukro 3 000 · Bouaké 4 000 ·
San-Pédro 6 000 · autre ville 5 000 FCFA (expédition en prépaiement).

## Non configuré — volontairement, faute d'informations

- Adresse de la boutique (affichée « à compléter », jamais inventée).
- Adresse e-mail de contact.
- Conditions de retour, garanties commerciales, politique de remboursement.
- Références, prix et stocks réels des 200+ produits (photos non reçues).

## Données à fournir par le propriétaire

1. **Identité** : raison sociale, RCCM, compte contribuable, forme juridique, adresse exacte du siège
   et de la boutique, représentant légal.
2. **Contact** : numéro de téléphone, compte WhatsApp Business (si la fonctionnalité est souhaitée),
   adresse e-mail de contact, horaires réels.
3. **Livraison** : zones desservies à Daloa, tarifs, seuil de gratuité éventuel, délais, transporteurs
   partenaires et conditions de paiement du transport hors Daloa.
4. **Paiement** : numéro marchand Wave, décision sur le mode (manuel ou automatique), conditions du
   paiement à la livraison (autorisation et plafond).
5. **Catalogue** : les 200+ photos (une par produit, référence lisible sur la photo). Le
   prestataire en déduit nom, catégorie, prix et stock, puis importe via `npm run import:catalog`.
6. **Commercial** : politique de retour, garanties, conditions de précommande, remises éventuelles.
7. **Comptes** : liste des personnes ayant besoin d'un accès d'administration et leur rôle.
8. **Données personnelles** : responsable de traitement, durées de conservation, état de la
   déclaration ARTCI.
