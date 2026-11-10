import { type Permission, type StaffRole, permissionsFor } from './auth';

export type RoleDefinition = {
  value: StaffRole;
  /** Libellé affiché dans l'administration (français). */
  label: string;
  description: string;
  /** Écran d'accueil après connexion : la tâche assignée, pas un menu vide. */
  home: string;
  /** Compte de direction : peut gérer les autres comptes. */
  management: boolean;
};

/**
 * Catalogue des rôles internes.
 *
 * Les libellés sont en français uniquement : l'administration n'a plus qu'une
 * langue, donc plus de doublon de traduction à maintenir.
 *
 * Les sept rôles ajoutés (ACCOUNTANT → SUPPORT_AGENT) correspondent aux postes
 * réellement présents dans une quincaillerie familiale : caisse, vente, magasin,
 * catalogue en ligne, comptabilité, livraison et service client.
 */
export const ROLES: RoleDefinition[] = [
  {
    value: 'OWNER',
    label: 'Propriétaire',
    description: 'Tous les droits, y compris la création des administrateurs. Seul compte qui ne peut pas être désactivé par un autre.',
    home: '/admin',
    management: true,
  },
  {
    value: 'ADMIN',
    label: 'Administrateur',
    description: 'Gère la boutique et les agents (sauf les comptes administrateur et propriétaire).',
    home: '/admin',
    management: true,
  },
  {
    value: 'ACCOUNTANT',
    label: 'Comptable',
    description: 'Encaissements, rapprochements, statistiques et journal d’activité. Ne modifie ni les produits ni les réglages.',
    home: '/admin/statistiques',
    management: false,
  },
  {
    value: 'CASHIER',
    label: 'Caissier',
    description: 'Confirme les paiements encaissés (espèces, Wave) et consulte les commandes. Ne touche pas au catalogue.',
    home: '/admin/paiements',
    management: false,
  },
  {
    value: 'SALES_ADVISOR',
    label: 'Conseiller de vente',
    description: 'Suit les commandes, répond aux clients et fait évoluer les commandes jusqu’à la livraison. Pas d’accès aux réglages.',
    home: '/admin/commandes',
    management: false,
  },
  {
    value: 'WAREHOUSE_KEEPER',
    label: 'Magasinier',
    description: 'Réception, inventaire et ajustements de stock avec motif. Consulte les commandes à préparer.',
    home: '/admin/stock',
    management: false,
  },
  {
    value: 'CATALOG_MANAGER',
    label: 'Gestionnaire catalogue',
    description: 'Fiches produits, prix, promotions, photos et import CSV. Ne valide pas les paiements.',
    home: '/admin/produits',
    management: false,
  },
  {
    value: 'DELIVERY_MANAGER',
    label: 'Responsable livraisons',
    description: 'Expéditions, transporteurs, zones et frais de livraison. Ne modifie ni les prix ni les comptes.',
    home: '/admin/commandes',
    management: false,
  },
  {
    value: 'SUPPORT_AGENT',
    label: 'Service client',
    description: 'Répond aux demandes reçues et consulte le suivi des commandes. Lecture seule sur le reste.',
    home: '/admin/messages',
    management: false,
  },
  {
    value: 'STOCK_MANAGER',
    label: 'Responsable stock',
    description: 'Rôle historique : catalogue, stock et import, sans paiement ni réglages.',
    home: '/admin/stock',
    management: false,
  },
  {
    value: 'ORDER_MANAGER',
    label: 'Responsable commandes',
    description: 'Rôle historique : commandes, paiements à vérifier et demandes clients.',
    home: '/admin/commandes',
    management: false,
  },
];

const BY_VALUE = new Map(ROLES.map((role) => [role.value, role]));

export function roleDefinition(role: string | null | undefined): RoleDefinition | null {
  return role ? (BY_VALUE.get(role as StaffRole) ?? null) : null;
}

/** Libellé lisible d'un rôle. */
export function roleLabel(role: string | null | undefined): string {
  return roleDefinition(role)?.label ?? role ?? '—';
}

export function roleHome(role: string | null | undefined): string {
  return roleDefinition(role)?.home ?? '/admin';
}

export function rolePermissions(role: string | null | undefined): Permission[] {
  return permissionsFor(role);
}

/** Libellés des droits, utilisés par la matrice des rôles. */
const PERMISSION_LABELS: Record<Permission, string> = {
  'products.read': 'Consulter les produits',
  'products.write': 'Créer et modifier les produits',
  'stock.write': 'Ajuster le stock',
  'catalog.import': 'Importer catalogue et photos',
  'orders.read': 'Consulter les commandes',
  'orders.write': 'Traiter les commandes',
  'payments.read': 'Consulter les paiements',
  'payments.confirm': 'Confirmer les paiements',
  'messages.handle': 'Répondre aux demandes clients',
  'delivery.manage': 'Gérer les livraisons',
  'settings.write': 'Modifier les paramètres',
  'users.manage': 'Gérer les comptes et les rôles',
  'audit.read': 'Lire le journal d’activité',
  'stats.read': 'Consulter les statistiques',
};

export function permissionLabel(permission: Permission): string {
  return PERMISSION_LABELS[permission] ?? permission;
}

/** Rôles proposés dans le formulaire de création selon l'acteur connecté. */
export function assignableRoleDefinitions(assignable: StaffRole[]): RoleDefinition[] {
  const allowed = new Set(assignable);
  return ROLES.filter((role) => allowed.has(role.value));
}
