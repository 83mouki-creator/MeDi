import { formatFCFA } from './utils';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus } from './order-status';

/**
 * Traduction des actions techniques en phrases compréhensibles.
 *
 * Le journal enregistre des codes (`product.updated`, `payment.confirmed`…) et
 * des données brutes (identifiants, JSON). Personne dans la boutique ne lit
 * cela. Ce module transforme chaque ligne en une phrase simple : **qui a fait
 * quoi, sur quoi, quand**, avec un ton (réussi / à surveiller / problème).
 *
 * Les phrases sont des gabarits traduisibles : `{produit}`, `{commande}`… sont
 * remplacés à l'affichage, et les valeurs marquées `translate` (statuts) sont
 * elles aussi traduites en arabe.
 */

export type ActivityCategoryKey =
  | 'commandes'
  | 'paiements'
  | 'produits'
  | 'stock'
  | 'clients'
  | 'livraison'
  | 'comptes'
  | 'reglages'
  | 'autre';

export type ActivityTone = 'success' | 'info' | 'warning' | 'danger';

/** Catégories affichées comme filtres, avec un mot simple et un pictogramme. */
export const ACTIVITY_CATEGORIES: { key: ActivityCategoryKey; label: string; emoji: string }[] = [
  { key: 'commandes', label: 'Commandes', emoji: '🧾' },
  { key: 'paiements', label: 'Paiements', emoji: '💰' },
  { key: 'produits', label: 'Produits', emoji: '📦' },
  { key: 'stock', label: 'Stock', emoji: '🔢' },
  { key: 'clients', label: 'Messages des clients', emoji: '💬' },
  { key: 'livraison', label: 'Livraisons', emoji: '🚚' },
  { key: 'comptes', label: 'Comptes et accès', emoji: '👤' },
  { key: 'reglages', label: 'Réglages', emoji: '⚙️' },
  { key: 'autre', label: 'Autre', emoji: '📝' },
];

/**
 * Catégorie de chaque action journalisée.
 *
 * Sert à filtrer le journal par mot simple (« Paiements », « Stock »…) sans
 * exposer les codes techniques. Tout code absent de cette table tombe dans
 * « Autre » et reste lisible grâce à la phrase générique.
 */
export const ACTION_CATEGORIES: Record<string, ActivityCategoryKey> = {
  'order.created': 'commandes',
  'order.status_changed': 'commandes',
  'order.note_updated': 'commandes',
  'order.shipment_recorded': 'livraison',
  'payment.confirmed': 'paiements',
  'payment.rejected': 'paiements',
  'payment.expired': 'paiements',
  'product.created': 'produits',
  'product.updated': 'produits',
  'product.archived': 'produits',
  'product.restored': 'produits',
  'product.images_uploaded': 'produits',
  'product.image_deleted': 'produits',
  'stock.adjusted': 'stock',
  'category.created': 'produits',
  'category.updated': 'produits',
  'brand.created': 'produits',
  'brand.updated': 'produits',
  'catalog.import': 'produits',
  'catalog.import_preview': 'produits',
  'media.bulk_upload': 'produits',
  'media.assigned': 'produits',
  'media.rejected': 'produits',
  'visual.reindex': 'produits',
  'delivery_zone.created': 'livraison',
  'delivery_zone.updated': 'livraison',
  'delivery_zone.disabled': 'livraison',
  'contact.message_status': 'clients',
  'settings.updated': 'reglages',
  'staff.created': 'comptes',
  'staff.access_activated': 'comptes',
  'staff.code_regenerated': 'comptes',
  'staff.code_revoked': 'comptes',
  'auth.login': 'comptes',
  'auth.logout': 'comptes',
  'auth.register': 'comptes',
  'auth.password_reset_requested': 'comptes',
  'auth.password_reset_link_issued': 'comptes',
  'auth.password_reset_completed': 'comptes',
  'account.password_changed': 'comptes',
  'account.profile_updated': 'comptes',
  'admin.owner_created': 'comptes',
  'user.upserted': 'comptes',
  'user.created': 'comptes',
  'user.disabled': 'comptes',
  'user.enabled': 'comptes',
};

/** Codes d'action d'une catégorie (liste vide = toutes). */
export function actionsForCategory(category: ActivityCategoryKey | undefined): string[] {
  if (!category) return [];
  return Object.entries(ACTION_CATEGORIES)
    .filter(([, value]) => value === category)
    .map(([action]) => action);
}

export function categoryOf(action: string): ActivityCategoryKey {
  return ACTION_CATEGORIES[action] ?? 'autre';
}

export type ActivityText = {
  key: string;
  vars?: Record<string, string | number>;
  /** Variables dont la valeur est elle-même une phrase à traduire (statuts). */
  translate?: string[];
};

export type ActivityDescription = {
  category: ActivityCategoryKey;
  tone: ActivityTone;
  title: ActivityText;
  detail?: ActivityText;
  href?: string;
};

/** Noms lisibles résolus en base (produit, commande, agent…). */
export type ActivityNames = {
  product?: string;
  order?: string;
  user?: string;
  category?: string;
  brand?: string;
  zone?: string;
  contact?: string;
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  WAVE: 'payé par Wave',
  CASH_ON_DELIVERY: 'à payer à la livraison',
  CASH_IN_STORE: 'payé en boutique',
};

const CONTACT_STATUS_LABELS: Record<string, string> = {
  NEW: 'nouveau message',
  IN_PROGRESS: 'en cours de traitement',
  CLOSED: 'message traité',
};

const STOCK_MODE_LABELS: Record<string, string> = {
  set: 'nouveau compte',
  delta: 'ajout ou retrait',
};

function orderLabel(names: ActivityNames) {
  // Sans numéro (commande supprimée, ancienne ligne), « la commande concernée »
  // reste une phrase correcte en français.
  return names.order ?? 'concernée';
}

function productLabel(names: ActivityNames) {
  return names.product ?? 'ce produit';
}

function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Phrase principale + précision éventuelle.
 * Le ton colore la pastille : vert = réussi, orange = à surveiller, rouge = problème.
 */
export function describeActivity(
  action: string,
  metadata: Record<string, unknown> | null,
  names: ActivityNames = {},
  actorName?: string | null,
): ActivityDescription {
  const meta = metadata ?? {};
  const who = actorName || 'Un membre de l’équipe';

  switch (action) {
    case 'order.created':
      return {
        category: 'commandes',
        tone: 'info',
        title: { key: 'Une nouvelle commande est arrivée' },
        detail: {
          key: 'Commande {commande} · {montant} · {paiement}',
          vars: {
            commande: orderLabel(names),
            montant: num(meta.total) !== null ? formatFCFA(num(meta.total)!) : 'montant à confirmer',
            paiement: PAYMENT_METHOD_LABELS[String(meta.paymentMethod)] ?? 'mode de paiement à préciser',
          },
          translate: ['paiement'],
        },
        href: '/admin/commandes',
      };

    case 'order.status_changed': {
      const status = String(meta.to ?? '');
      const label = ORDER_STATUS_LABELS[status as OrderStatus] ?? 'nouvelle étape';
      const bad = status === 'CANCELLED' || status === 'REFUNDED';
      return {
        category: 'commandes',
        tone: bad ? 'danger' : status === 'DELIVERED' ? 'success' : 'info',
        title: { key: 'Commande {commande} : {statut}', vars: { commande: orderLabel(names), statut: label }, translate: ['statut'] },
        detail: text(meta.note) ? { key: 'Note ajoutée : « {note} »', vars: { note: text(meta.note)! } } : undefined,
        href: '/admin/commandes',
      };
    }

    case 'order.note_updated':
      return {
        category: 'commandes',
        tone: 'info',
        title: { key: 'Une note a été écrite sur la commande {commande}', vars: { commande: orderLabel(names) } },
        href: '/admin/commandes',
      };

    case 'order.shipment_recorded':
      return {
        category: 'livraison',
        tone: 'info',
        title: { key: 'Colis remis au transporteur pour la commande {commande}', vars: { commande: orderLabel(names) } },
        detail: {
          key: 'Transporteur : {transporteur}{suivi}',
          vars: {
            transporteur: text(meta.carrier) ?? 'non précisé',
            suivi: text(meta.trackingNumber) ? ` · numéro de suivi ${text(meta.trackingNumber)}` : '',
          },
        },
        href: '/admin/commandes',
      };

    case 'payment.confirmed':
      return {
        category: 'paiements',
        tone: 'success',
        title: { key: 'Le client a payé la commande {commande}', vars: { commande: orderLabel(names) } },
        detail: { key: 'L’argent est bien arrivé : vous pouvez préparer le colis.' },
        href: '/admin/paiements',
      };

    case 'payment.rejected':
      return {
        category: 'paiements',
        tone: 'danger',
        title: { key: 'Un paiement a été refusé' },
        detail: text(meta.reason)
          ? { key: 'Raison : {raison}', vars: { raison: text(meta.reason)! } }
          : { key: 'Le client doit vérifier son paiement avec la boutique.' },
        href: '/admin/paiements',
      };

    case 'payment.expired':
      return {
        category: 'paiements',
        tone: 'warning',
        title: { key: 'Une commande non payée a été annulée automatiquement' },
        detail: { key: 'Le stock réservé a été remis en vente.' },
        href: '/admin/paiements',
      };

    case 'product.created':
      return {
        category: 'produits',
        tone: 'success',
        title: { key: 'Un nouveau produit a été ajouté' },
        detail:
          names.product || num(meta.price) !== null
            ? {
                key: 'Produit : {produit}{prix}',
                vars: {
                  produit: names.product ?? 'nom non retrouvé',
                  prix: num(meta.price) !== null ? ` · prix : ${formatFCFA(num(meta.price)!)}` : '',
                },
              }
            : undefined,
        href: '/admin/produits',
      };

    case 'product.updated':
      return {
        category: 'produits',
        tone: 'info',
        title: { key: 'Fiche modifiée : {produit}', vars: { produit: productLabel(names) } },
        detail: num(meta.price) !== null ? { key: 'Nouveau prix enregistré : {prix}', vars: { prix: formatFCFA(num(meta.price)!) } } : undefined,
        href: '/admin/produits',
      };

    case 'product.archived':
      return {
        category: 'produits',
        tone: 'warning',
        title: { key: 'Produit retiré de la boutique : {produit}', vars: { produit: productLabel(names) } },
        detail: { key: 'Il n’est plus visible par les clients, rien n’est supprimé.' },
        href: '/admin/produits',
      };

    case 'product.restored':
      return {
        category: 'produits',
        tone: 'success',
        title: { key: 'Produit remis en vente : {produit}', vars: { produit: productLabel(names) } },
        href: '/admin/produits',
      };

    case 'product.images_uploaded':
      return {
        category: 'produits',
        tone: 'info',
        title: { key: '{nombre} photo(s) ajoutée(s) : {produit}', vars: { nombre: num(meta.count) ?? 1, produit: productLabel(names) } },
        href: '/admin/produits',
      };

    case 'product.image_deleted':
      return {
        category: 'produits',
        tone: 'info',
        title: { key: 'Une photo a été supprimée : {produit}', vars: { produit: productLabel(names) } },
        href: '/admin/produits',
      };

    case 'stock.adjusted': {
      const quantity = num(meta.quantity) ?? 0;
      const mode = String(meta.mode ?? 'delta');
      const movement =
        mode === 'set'
          ? `Stock compté : ${quantity}`
          : quantity > 0
            ? `${quantity} unité(s) ajoutée(s)`
            : `${Math.abs(quantity)} unité(s) retirée(s)`;
      return {
        category: 'stock',
        tone: quantity < 0 ? 'warning' : 'info',
        title: { key: 'Stock modifié : {produit}', vars: { produit: productLabel(names) } },
        detail: {
          key: '{mouvement}{motif}',
          vars: {
            mouvement: `${movement}`,
            motif: text(meta.reason) ? ` · motif : ${text(meta.reason)}` : '',
          },
        },
        href: '/admin/stock',
      };
    }

    case 'category.created':
      return {
        category: 'produits',
        tone: 'info',
        title: { key: 'Nouveau rayon créé : {rayon}', vars: { rayon: names.category ?? 'ce rayon' } },
        href: '/admin/categories',
      };

    case 'category.updated':
      return {
        category: 'produits',
        tone: 'info',
        title: { key: 'Rayon renommé ou modifié : {rayon}', vars: { rayon: names.category ?? 'ce rayon' } },
        href: '/admin/categories',
      };

    case 'brand.created':
      return {
        category: 'produits',
        tone: 'info',
        title: { key: 'Nouvelle marque ajoutée : {marque}', vars: { marque: names.brand ?? 'cette marque' } },
        href: '/admin/categories',
      };

    case 'brand.updated':
      return {
        category: 'produits',
        tone: 'info',
        title: { key: 'Marque modifiée : {marque}', vars: { marque: names.brand ?? 'cette marque' } },
        href: '/admin/categories',
      };

    case 'delivery_zone.created':
    case 'delivery_zone.updated':
    case 'delivery_zone.disabled': {
      const verb =
        action === 'delivery_zone.created'
          ? 'Nouvelle zone de livraison : {zone}'
          : action === 'delivery_zone.updated'
            ? 'Zone de livraison modifiée : {zone}'
            : 'Zone de livraison désactivée : {zone}';
      return {
        category: 'livraison',
        tone: action === 'delivery_zone.disabled' ? 'warning' : 'info',
        title: { key: verb, vars: { zone: names.zone ?? 'cette zone' } },
        detail: num(meta.fee) !== null ? { key: 'Frais de livraison : {frais}', vars: { frais: formatFCFA(num(meta.fee)!) } } : undefined,
        href: '/admin/livraison',
      };
    }

    case 'contact.message_status':
      return {
        category: 'clients',
        tone: String(meta.to) === 'CLOSED' ? 'success' : 'info',
        title: {
          key: 'Message de {client} : {statut}',
          vars: { client: names.contact ?? 'un client', statut: CONTACT_STATUS_LABELS[String(meta.to)] ?? 'mis à jour' },
          translate: ['statut'],
        },
        href: '/admin/messages',
      };

    case 'settings.updated':
      return {
        category: 'reglages',
        tone: 'warning',
        title: { key: 'Les réglages de la boutique ont été modifiés' },
        detail: {
          key: 'Paiement à la livraison : {cod} · Carte de la boutique : {carte}',
          vars: {
            cod: meta.allowCod === true ? 'autorisé' : 'désactivé',
            carte: meta.geoConfigured === true ? 'position enregistrée' : 'position manquante',
          },
          translate: ['cod', 'carte'],
        },
        href: '/admin/parametres',
      };

    case 'catalog.import':
      return {
        category: 'produits',
        tone: 'success',
        title: { key: 'Un fichier de produits a été importé' },
        detail: {
          key: '{ajoutes} produit(s) ajouté(s), {modifies} mis à jour, {refuses} refusé(s)',
          vars: { ajoutes: num(meta.created) ?? 0, modifies: num(meta.updated) ?? 0, refuses: num(meta.rejected) ?? 0 },
        },
        href: '/admin/produits',
      };

    case 'catalog.import_preview':
      return {
        category: 'produits',
        tone: 'info',
        title: { key: 'Un fichier de produits a été vérifié (sans enregistrer)' },
        detail: {
          key: '{ajoutes} à ajouter, {modifies} à mettre à jour, {refuses} refusés',
          vars: { ajoutes: num(meta.created) ?? 0, modifies: num(meta.updated) ?? 0, refuses: num(meta.rejected) ?? 0 },
        },
        href: '/admin/import',
      };

    case 'media.bulk_upload':
      return {
        category: 'produits',
        tone: 'info',
        title: { key: '{nombre} photo(s) ajoutée(s) d’un seul coup', vars: { nombre: num(meta.imported) ?? 0 } },
        detail: {
          key: '{doublons} doublon(s) ignoré(s), {refuses} fichier(s) refusé(s)',
          vars: { doublons: num(meta.duplicates) ?? 0, refuses: num(meta.rejected) ?? 0 },
        },
        href: '/admin/import',
      };

    case 'media.assigned':
      return {
        category: 'produits',
        tone: 'info',
        title: { key: 'Une photo a été rattachée à un produit' },
        detail: { key: 'Elle est maintenant visible sur la fiche du produit.' },
        href: '/admin/import',
      };

    case 'media.rejected':
      return {
        category: 'produits',
        tone: 'warning',
        title: { key: 'Une photo a été écartée' },
        detail: { key: 'Elle ne sera pas affichée dans la boutique.' },
        href: '/admin/import',
      };

    case 'visual.reindex':
      return {
        category: 'produits',
        tone: 'info',
        title: { key: 'La recherche par photo a été mise à jour' },
        detail: {
          key: '{pretes} photo(s) prêtes à être reconnues, {restantes} encore à traiter',
          vars: { pretes: num(meta.indexed) ?? 0, restantes: num(meta.left) ?? 0 },
        },
        href: '/admin/import',
      };

    case 'staff.created':
      return {
        category: 'comptes',
        tone: 'success',
        title: { key: 'Nouvel accès créé pour {agent}', vars: { agent: names.user ?? 'un agent' } },
        detail: {
          key: 'Tâche : {tache} · Rôle : {role}',
          vars: { tache: text(meta.task) ?? 'non précisée', role: text(meta.role) ?? 'agent' },
          translate: ['role'],
        },
        href: '/admin/utilisateurs',
      };

    case 'staff.access_activated':
      return {
        category: 'comptes',
        tone: 'success',
        title: { key: '{agent} a activé son accès', vars: { agent: names.user ?? 'Un agent' } },
        detail: { key: 'Il peut maintenant se connecter avec son téléphone.' },
        href: '/admin/utilisateurs',
      };

    case 'staff.code_regenerated':
      return {
        category: 'comptes',
        tone: 'info',
        title: { key: 'Nouveau code d’accès pour {agent}', vars: { agent: names.user ?? 'un agent' } },
        detail: { key: 'L’ancien code ne fonctionne plus.' },
        href: '/admin/utilisateurs',
      };

    case 'staff.code_revoked':
      return {
        category: 'comptes',
        tone: 'warning',
        title: { key: 'Code d’accès annulé : {agent}', vars: { agent: names.user ?? 'un agent' } },
        detail: { key: 'Ce code ne peut plus être utilisé pour entrer.' },
        href: '/admin/utilisateurs',
      };

    case 'auth.login':
      return {
        category: 'comptes',
        tone: 'info',
        title: { key: '{qui} s’est connecté', vars: { qui: who } },
      };

    case 'auth.logout':
      return {
        category: 'comptes',
        tone: 'info',
        title: { key: '{qui} s’est déconnecté', vars: { qui: who } },
      };

    case 'auth.register':
      return {
        category: 'comptes',
        tone: 'success',
        title: { key: 'Un nouveau client a créé son compte' },
        href: '/admin/utilisateurs',
      };

    case 'auth.password_reset_requested':
      return {
        category: 'comptes',
        tone: 'warning',
        title: { key: 'Quelqu’un a demandé un nouveau mot de passe' },
        detail: { key: 'La demande a été enregistrée ; le lien peut être remis par WhatsApp.' },
      };

    case 'auth.password_reset_link_issued':
      return {
        category: 'comptes',
        tone: 'info',
        title: { key: 'Un lien de nouveau mot de passe a été préparé pour {agent}', vars: { agent: names.user ?? 'un compte' } },
        detail: { key: 'Le lien est valable 1 heure et ne marche qu’une seule fois.' },
        href: '/admin/utilisateurs',
      };

    case 'auth.password_reset_completed':
      return {
        category: 'comptes',
        tone: 'success',
        title: { key: 'Un mot de passe a été changé' },
        detail: { key: 'La personne peut se connecter avec son nouveau mot de passe.' },
      };

    case 'account.password_changed':
      return {
        category: 'comptes',
        tone: 'info',
        title: { key: '{qui} a changé son mot de passe', vars: { qui: who } },
      };

    case 'account.profile_updated':
      return {
        category: 'comptes',
        tone: 'info',
        title: { key: '{qui} a mis à jour ses coordonnées', vars: { qui: who } },
      };

    case 'admin.owner_created':
      return {
        category: 'comptes',
        tone: 'success',
        title: { key: 'Le compte du propriétaire a été créé' },
      };

    case 'user.upserted':
      return {
        category: 'comptes',
        tone: 'info',
        title: { key: 'Un compte a été créé' },
        detail: {
          key: 'Compte : {agent}{role}',
          vars: {
            agent: names.user ?? String(meta.email ?? 'nom non retrouvé'),
            role: meta.role ? ` · rôle : ${meta.role}` : '',
          },
          translate: ['role'],
        },
        href: '/admin/utilisateurs',
      };

    case 'user.created':
      return {
        category: 'comptes',
        tone: 'info',
        title: { key: 'Un compte a été créé : {agent}', vars: { agent: names.user ?? 'nouveau compte' } },
        href: '/admin/utilisateurs',
      };

    case 'user.disabled':
      return {
        category: 'comptes',
        tone: 'warning',
        title: { key: 'Un compte a été désactivé : {agent}', vars: { agent: names.user ?? 'ce compte' } },
        detail: { key: 'La personne ne peut plus se connecter.' },
        href: '/admin/utilisateurs',
      };

    case 'user.enabled':
      return {
        category: 'comptes',
        tone: 'success',
        title: { key: 'Un compte a été réactivé : {agent}', vars: { agent: names.user ?? 'ce compte' } },
        href: '/admin/utilisateurs',
      };

    default:
      return {
        category: 'autre',
        tone: 'info',
        title: { key: 'Une action a été enregistrée' },
        detail: { key: 'Action technique : {code}', vars: { code: action.replace(/[._]/g, ' ') } },
      };
  }
}

// ─────────────────────────────── Heure lisible ───────────────────────────────

const pad = (value: number) => String(value).padStart(2, '0');
const clock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const shortDate = (date: Date) => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;

/**
 * « à l'instant », « il y a 12 min », « hier à 09:05 », « le 12/10/2026 ».
 * Renvoie un gabarit traduisible : le nombre et l'heure sont des variables.
 * Aucune notion de fuseau exotique : on compare des dates locales.
 */
export function describeWhen(date: Date, now: Date = new Date()): ActivityText {
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return { key: 'à l’instant' };
  if (minutes < 60) return { key: 'il y a {minutes} min', vars: { minutes } };

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayGap = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);

  if (dayGap === 0) return { key: 'aujourd’hui à {heure}', vars: { heure: clock(date) } };
  if (dayGap === 1) return { key: 'hier à {heure}', vars: { heure: clock(date) } };
  if (dayGap < 7) return { key: 'il y a {jours} jours', vars: { jours: dayGap } };
  return { key: 'le {date} à {heure}', vars: { date: shortDate(date), heure: clock(date) } };
}

/** Regroupement par jour, pour lire « Aujourd'hui / Hier / Plus tôt ». */
export function dayGroup(date: Date, now: Date = new Date()): 'aujourdhui' | 'hier' | 'plus-tot' {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const gap = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);
  if (gap <= 0) return 'aujourdhui';
  if (gap === 1) return 'hier';
  return 'plus-tot';
}

/** Texte du bloc « détails techniques », replié par défaut. */
export function technicalSummary(action: string, entity: string | null, entityId: string | null): string {
  const parts = [action];
  if (entity) parts.push(entity);
  if (entityId) parts.push(entityId);
  return parts.join(' · ');
}

export { PAYMENT_STATUS_LABELS, STOCK_MODE_LABELS };
