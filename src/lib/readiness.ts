/**
 * Diagnostic « la boutique peut-elle vendre ? »
 *
 * Rien n'est inventé : chaque point est calculé à partir des données réellement
 * enregistrées (réglages, catalogue, zones de livraison) et de la configuration
 * technique du serveur. Un point est :
 *
 *  • `ready`    — en place, rien à faire ;
 *  • `todo`     — recommandé avant d'ouvrir la vente (photos, mentions, e-mail…) ;
 *  • `blocking` — la vente ne peut pas fonctionner correctement sans lui.
 *
 * Ce module est pur (aucune requête) : la page `/admin/pret-a-vendre` assemble
 * l'instantané, et les tests vérifient les règles sans base de données.
 */

export type ReadinessStatus = 'ready' | 'todo' | 'blocking';

/** Qui doit agir : la boutique (contenu) ou la technique (configuration). */
export type ReadinessOwner = 'boutique' | 'technique';

export type ReadinessCheck = {
  id: string;
  /** Phrase courte, traduite par `t()` dans la page. */
  label: string;
  /** Ce qui est en place ou ce qu'il reste à faire, en mots simples. */
  detail: string;
  status: ReadinessStatus;
  owner: ReadinessOwner;
  /** Valeurs à insérer dans `detail` (`{count}`, `{number}`…), traduites par `t`. */
  vars?: Record<string, string | number>;
  /** Où corriger, quand un écran existe. */
  href?: string;
};

export type ReadinessSnapshot = {
  settings: {
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    addressLine: string | null;
    openingHours: string | null;
    waveNumber: string | null;
    waveMerchantName: string | null;
    legalNotice: string | null;
    allowLocalDelivery: boolean;
    allowCod: boolean;
    tagline: string | null;
  };
  catalog: {
    activeProducts: number;
    inStockProducts: number;
    withPhoto: number;
    zeroPrice: number;
    categories: number;
    activePromotions: number;
  };
  delivery: {
    localZonesWithTariff: number;
    nationalZones: number;
  };
  staff: {
    /** Comptes OWNER / ADMIN actifs : sans eux, personne ne peut gérer la boutique. */
    managerAccounts: number;
    /** Agents et autres comptes internes actifs. */
    activeStaff: number;
  };
  /**
   * Ce qui se passe après la commande : expédition, messages, tranquillité du
   * propriétaire quand il n'est pas devant son écran.
   */
  operations: {
    /** Commandes payées hors Daloa qui attendent un transporteur. */
    awaitingDispatch: number;
    /** Expéditions déjà confiées au transporteur et pas encore livrées. */
    inTransit: number;
    /** Une clé d'API Colis Express est configurée (statuts synchronisés). */
    carrierSync: boolean;
    /** Messages clients sans réponse. */
    unansweredMessages: number;
    /** Nombre de tâches automatiques déclarées (voir `vercel.json`). */
    automations: number;
  };
  infrastructure: {
    database: boolean;
    /** Wave API configurée (webhooks + vérification automatique). */
    waveAuto: boolean;
    /** Mode manuel : la boutique confirme chaque paiement à la main. */
    waveManual: boolean;
    storage: 'cloudinary' | 'database' | 'local';
    email: boolean;
    cron: boolean;
    appUrlIsHttps: boolean;
  };
};

export type ReadinessVerdict = 'pret' | 'presque' | 'pas_pret';

export type ReadinessReport = {
  verdict: ReadinessVerdict;
  checks: ReadinessCheck[];
  blocking: number;
  todo: number;
  ready: number;
  /** Le pourcentage de points en place, arrondi (0–100). */
  score: number;
};

const phoneLike = (value: string | null) => Boolean(value && value.replace(/\D/g, '').length >= 8);

export function computeReadiness(snapshot: ReadinessSnapshot): ReadinessReport {
  const { settings, catalog, delivery, infrastructure, staff, operations } = snapshot;

  const checks: ReadinessCheck[] = [
    // ── Ce que la boutique doit fournir ─────────────────────────────────────
    {
      id: 'coordonnees',
      label: 'Téléphone et WhatsApp joignables',
      detail:
        phoneLike(settings.phone) && phoneLike(settings.whatsapp)
          ? 'Les clients peuvent appeler et écrire sur WhatsApp.'
          : 'Renseignez le téléphone et le numéro WhatsApp : ce sont les deux canaux de contact affichés partout.',
      status: phoneLike(settings.phone) && phoneLike(settings.whatsapp) ? 'ready' : 'todo',
      owner: 'boutique',
      href: '/admin/parametres',
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp de la boutique',
      detail: settings.whatsapp
        ? 'Numéro WhatsApp publié : c’est le canal utilisé pour le transport et le suivi.'
        : 'Ajoutez le numéro WhatsApp : sans lui, les clients ne peuvent pas convenir du transport hors Daloa.',
      status: settings.whatsapp ? 'ready' : 'blocking',
      owner: 'boutique',
      href: '/admin/parametres',
    },
    {
      id: 'horaires',
      label: 'Horaires d’ouverture',
      detail: settings.openingHours
        ? 'Horaires affichés aux clients.'
        : 'Précisez les jours et heures d’ouverture : ils servent aussi à la livraison.',
      status: settings.openingHours ? 'ready' : 'todo',
      owner: 'boutique',
      href: '/admin/parametres',
    },
    {
      id: 'identite-legale',
      label: 'Identité de l’entreprise (mentions légales)',
      detail: settings.legalNotice
        ? 'Raison sociale, RCCM et informations légales publiées.'
        : 'Ajoutez la raison sociale, le RCCM et le compte contribuable dans « Mentions légales ». C’est obligatoire pour vendre.',
      status: settings.legalNotice ? 'ready' : 'todo',
      owner: 'boutique',
      href: '/admin/parametres',
    },
    {
      id: 'wave-marchand',
      label: 'Compte Wave de la boutique',
      detail: settings.waveNumber
        ? settings.waveMerchantName
          ? 'Les clients paient au {number} ({name}).'
          : 'Les clients paient au {number}.'
        : 'Renseignez le numéro Wave marchand : sans lui, aucun paiement ne peut être envoyé.',
      vars: { number: settings.waveNumber ?? '', name: settings.waveMerchantName ?? '' },
      status: settings.waveNumber ? 'ready' : 'blocking',
      owner: 'boutique',
      href: '/admin/parametres',
    },
    {
      id: 'catalogue',
      label: 'Produits en vente',
      detail:
        catalog.activeProducts > 0
          ? '{count} produit(s) publié(s), {available} disponible(s) tout de suite.'
          : 'Aucun produit publié : ajoutez au moins une référence avant d’ouvrir la boutique.',
      vars: { count: catalog.activeProducts, available: catalog.inStockProducts },
      status: catalog.activeProducts > 0 ? 'ready' : 'blocking',
      owner: 'boutique',
      href: '/admin/produits/nouveau',
    },
    {
      id: 'stock',
      label: 'Stock réellement disponible',
      detail:
        catalog.inStockProducts > 0
          ? 'Des articles sont disponibles immédiatement.'
          : 'Tous les produits sont à zéro : mettez le stock à jour, sinon les clients ne peuvent rien acheter.',
      status: catalog.inStockProducts > 0 ? 'ready' : 'blocking',
      owner: 'boutique',
      href: '/admin/stock',
    },
    {
      id: 'prix',
      label: 'Prix renseignés',
      detail:
        catalog.zeroPrice === 0
          ? 'Aucun produit actif à 0 FCFA.'
          : '{count} produit(s) actif(s) à 0 FCFA : corrigez le prix, sinon la commande est refusée.',
      vars: { count: catalog.zeroPrice },
      status: catalog.zeroPrice === 0 ? 'ready' : 'blocking',
      owner: 'boutique',
      href: '/admin/produits',
    },
    {
      id: 'photos',
      label: 'Photos des produits',
      detail:
        catalog.activeProducts > 0 && catalog.withPhoto >= catalog.activeProducts
          ? 'Chaque produit publié a au moins une photo.'
          : '{photos} produit(s) sur {total} ont une photo. Une fiche sans photo se vend mal : complétez les autres.',
      vars: { photos: catalog.withPhoto, total: catalog.activeProducts },
      status: catalog.activeProducts > 0 && catalog.withPhoto >= catalog.activeProducts ? 'ready' : 'todo',
      owner: 'boutique',
      href: '/admin/import',
    },
    {
      id: 'rayons',
      label: 'Rayons du catalogue',
      detail: catalog.categories > 0 ? '{count} rayon(s) en place.' : 'Créez au moins un rayon pour ranger les produits.',
      vars: { count: catalog.categories },
      status: catalog.categories > 0 ? 'ready' : 'todo',
      owner: 'boutique',
      href: '/admin/categories',
    },
    {
      id: 'livraison-daloa',
      label: 'Livraison à Daloa',
      detail:
        delivery.localZonesWithTariff > 0
          ? '{count} zone(s) de livraison avec un tarif.'
          : 'Aucune zone de livraison locale avec un tarif : les clients de Daloa ne peuvent pas choisir leur quartier.',
      vars: { count: delivery.localZonesWithTariff },
      status: delivery.localZonesWithTariff > 0 ? 'ready' : 'blocking',
      owner: 'boutique',
      href: '/admin/livraison',
    },
    {
      id: 'hors-daloa',
      label: 'Villes hors Daloa',
      detail:
        delivery.nationalZones > 0
          ? '{count} ville(s) hors Daloa proposée(s), transport à convenir sur WhatsApp.'
          : 'Aucune ville hors Daloa : les clients d’Abidjan ou de Bouaké ne peuvent pas commander.',
      vars: { count: delivery.nationalZones },
      status: delivery.nationalZones > 0 ? 'ready' : 'todo',
      owner: 'boutique',
      href: '/admin/livraison',
    },

    {
      id: 'comptes',
      label: 'Comptes de gestion',
      detail:
        staff.managerAccounts > 0
          ? '{managers} compte(s) de gérance actif(s), {staff} agent(s).'
          : 'Aucun compte propriétaire actif : personne ne peut valider un paiement ni corriger un prix.',
      vars: { managers: staff.managerAccounts, staff: staff.activeStaff },
      status: staff.managerAccounts > 0 ? 'ready' : 'blocking',
      owner: 'boutique',
      href: '/admin/utilisateurs',
    },

    // ── Ce qui se passe après la commande ───────────────────────────────────
    {
      id: 'expeditions',
      label: 'Colis remis au transporteur',
      detail:
        operations.awaitingDispatch === 0
          ? 'Aucune commande payée n’attend d’être expédiée.'
          : '{count} commande(s) payée(s) attendent un code de suivi : le client a payé, le colis doit partir.',
      vars: { count: operations.awaitingDispatch },
      status: operations.awaitingDispatch === 0 ? 'ready' : 'blocking',
      owner: 'boutique',
      href: '/admin/expeditions',
    },
    {
      id: 'suivi-transporteur',
      label: 'Suivi des colis chez le transporteur',
      detail: operations.carrierSync
        ? 'Colis Express est branché en API : le statut des colis se met à jour tout seul.'
        : operations.inTransit > 0
          ? '{count} colis en route. Le lien de suivi fonctionne, mais le statut se met à jour à la main : renseignez COLIS_EXPRESS_API_BASE pour l’automatiser.'
          : 'Le lien de suivi Colis Express fonctionne. La synchronisation automatique des statuts n’est pas branchée (facultatif).',
      vars: { count: operations.inTransit },
      status: operations.carrierSync || operations.inTransit === 0 ? 'ready' : 'todo',
      owner: 'technique',
      href: '/admin/expeditions',
    },
    {
      id: 'messages',
      label: 'Questions des clients sans réponse',
      detail:
        operations.unansweredMessages === 0
          ? 'Aucun message client en attente : personne n’est laissé sans réponse.'
          : '{count} message(s) attendent une réponse. Un client sans réponse n’achète pas deux fois.',
      vars: { count: operations.unansweredMessages },
      status: operations.unansweredMessages === 0 ? 'ready' : 'todo',
      owner: 'boutique',
      href: '/admin/messages',
    },
    {
      id: 'automatisation',
      label: 'Tâches qui tournent sans vous',
      detail:
        operations.automations > 0
          ? '{count} tâche(s) planifiée(s) : réservations expirées libérées, paiements suivis, sauvegardes.'
          : 'Aucune tâche planifiée déclarée : certaines corvées (libération du stock réservé) reposent sur une visite du site.',
      vars: { count: operations.automations },
      status: operations.automations > 0 ? 'ready' : 'todo',
      owner: 'technique',
    },

    // ── Ce qui dépend de la configuration technique ─────────────────────────
    {
      id: 'base',
      label: 'Base de données joignable',
      detail: infrastructure.database
        ? 'La base répond : catalogue, commandes et stock sont enregistrés.'
        : 'La base ne répond pas : rien ne peut être vendu. Vérifiez DATABASE_URL sur l’hébergement.',
      status: infrastructure.database ? 'ready' : 'blocking',
      owner: 'technique',
    },
    {
      id: 'paiement',
      label: 'Paiement opérationnel',
      detail: infrastructure.waveAuto
        ? 'Wave est branché en automatique : le paiement est vérifié par l’API.'
        : infrastructure.waveManual
          ? 'Mode manuel : la boutique vérifie et confirme chaque paiement reçu (fonctionne, mais demande une vérification humaine).'
          : 'Aucun moyen de paiement prêt.',
      status: infrastructure.waveAuto || infrastructure.waveManual ? 'ready' : 'blocking',
      owner: 'technique',
      href: '/admin/paiements',
    },
    {
      id: 'stockage',
      label: 'Conservation des photos',
      detail:
        infrastructure.storage === 'cloudinary'
          ? 'Les photos partent sur Cloudinary.'
          : infrastructure.storage === 'database'
            ? 'Les photos sont conservées dans la base : elles survivent aux déploiements, sans service externe.'
            : 'Stockage sur disque local : les photos ajoutées disparaîtront au prochain déploiement.',
      status: infrastructure.storage === 'local' ? 'blocking' : 'ready',
      owner: 'technique',
    },
    {
      id: 'email',
      label: 'E-mails transactionnels',
      detail: infrastructure.email
        ? 'Les liens de réinitialisation de mot de passe partent par e-mail.'
        : 'Pas de fournisseur d’e-mail : les liens de réinitialisation sont remis sur WhatsApp par un agent. Acceptable, mais moins autonome.',
      status: infrastructure.email ? 'ready' : 'todo',
      owner: 'technique',
      href: '/admin/utilisateurs',
    },
    {
      id: 'planification',
      label: 'Libération automatique du stock réservé',
      detail: infrastructure.cron
        ? 'La tâche planifiée et le balayage à chaque visite libèrent les réservations expirées.'
        : 'La tâche planifiée n’est pas configurée : le stock est libéré uniquement à la visite d’un client (cela fonctionne, mais moins régulièrement).',
      status: infrastructure.cron ? 'ready' : 'todo',
      owner: 'technique',
    },
    {
      id: 'url',
      label: 'Adresse publique du site (HTTPS)',
      detail: infrastructure.appUrlIsHttps
        ? 'Le site répond en HTTPS : liens de retour Wave, partages et e-mails sont corrects.'
        : 'APP_URL n’est pas en HTTPS : certains liens (retour de paiement, partage) seront refusés.',
      status: infrastructure.appUrlIsHttps ? 'ready' : 'todo',
      owner: 'technique',
    },
  ];

  const blocking = checks.filter((check) => check.status === 'blocking').length;
  const todo = checks.filter((check) => check.status === 'todo').length;
  const ready = checks.filter((check) => check.status === 'ready').length;

  const verdict: ReadinessVerdict = blocking > 0 ? 'pas_pret' : todo > 0 ? 'presque' : 'pret';

  return {
    verdict,
    checks,
    blocking,
    todo,
    ready,
    score: Math.round((ready / checks.length) * 100),
  };
}
