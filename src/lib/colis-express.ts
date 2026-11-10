/**
 * Colis Express — le transporteur branché sur la boutique.
 *
 * Colis Express (https://colisexpress-shopin30.vercel.app) est le service de
 * livraison utilisé pour expédier les commandes hors de Daloa. Le prestataire
 * publie un site public ; il ne documente pas d'API JSON. L'intégration est donc
 * construite en deux étages, du plus sûr au plus fin :
 *
 *  1. **liens de suivi** — toujours disponibles : la page `/suivi.html` du
 *     prestataire accepte un code (`CLI-XXXXXX`) en paramètre et affiche le
 *     parcours du colis. Aucune configuration n'est nécessaire, et un client
 *     peut suivre son colis même si rien d'autre n'est branché ;
 *  2. **synchronisation API** — facultative : si `COLIS_EXPRESS_API_BASE` est
 *     renseigné (et le jeton s'il en faut un), l'administration interroge
 *     l'API du prestataire pour lire le dernier statut connu. Les chemins sont
 *     regroupés ici, en un seul endroit, pour être corrigés sans toucher aux
 *     écrans si le prestataire les renomme.
 *
 * Rien n'est simulé : sans configuration, `status()` retourne simplement
 * `configured: false` et l'administration affiche le lien de suivi à ouvrir.
 */
import { env } from './env';

/** Identifiant du transporteur dans `shipments.carrier`. */
export const COLIS_EXPRESS_CARRIER = 'COLIS_EXPRESS';

/** Nom affiché au client et à l'équipe. */
export const COLIS_EXPRESS_LABEL = 'Colis Express';

/** Les quatre étapes d'un colis Colis Express, dans l'ordre. */
export const COLIS_EXPRESS_STEPS = ['Expédié', 'En transit', 'Arrivé', 'Retiré'] as const;
export type ColisExpressStep = (typeof COLIS_EXPRESS_STEPS)[number];

/**
 * Statut de l'expédition dans **notre** vocabulaire (`shipment_status`), à partir
 * du libellé renvoyé par le transporteur.
 *
 * La comparaison est volontairement tolérante (accents, majuscules, variantes
 * « en cours de livraison », « livré ») : on ne contrôle pas la casse de l'API
 * distante, et une expédition mal classée vaut moins qu'une expédition classée
 * approximativement.
 */
export function shipmentStatusFromProvider(label: string | null | undefined): 'DISPATCHED' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED' | 'RETURNED' {
  const text = normalise(label);
  if (!text) return 'DISPATCHED';
  if (text.includes('retour') || text.includes('refus') || text.includes('annul')) return 'RETURNED';
  // « En cours de livraison » contient « livr » : l'ordre des tests compte, le
  // transport en cours doit être reconnu avant la livraison effective.
  if (text.includes('cours') || text.includes('transit') || text.includes('route') || text.includes('achemin')) return 'IN_TRANSIT';
  if (text.includes('arriv')) return 'ARRIVED';
  if (text.includes('retir') || text.includes('livr') || text.includes('remis')) return 'DELIVERED';
  if (text.includes('expedi') || text.includes('depos') || text.includes('enregistr') || text.includes('pris')) return 'DISPATCHED';
  return 'IN_TRANSIT';
}

/**
 * Position d'une expédition sur les quatre étapes du client (0 à 3).
 *
 * Les libellés internes (« Arrivé en agence ») sont plus précis que les quatre
 * étapes montrées au client : cette fonction fait la correspondance, pour que la
 * frise du suivi ne dépende pas d'une égalité de chaînes.
 */
export function stepIndexForStatus(status: 'PENDING' | 'DISPATCHED' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED' | 'RETURNED'): number {
  switch (status) {
    case 'PENDING':
    case 'DISPATCHED':
      return 0;
    case 'IN_TRANSIT':
      return 1;
    case 'ARRIVED':
      return 2;
    case 'DELIVERED':
      return 3;
    case 'RETURNED':
      return -1;
  }
}

/** Le statut interne des expéditions, dit en clair pour l'équipe et le client. */
export const SHIPMENT_STATUS_LABELS: Record<'PENDING' | 'DISPATCHED' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED' | 'RETURNED', string> = {
  PENDING: 'À remettre au transporteur',
  DISPATCHED: 'Expédié',
  IN_TRANSIT: 'En transit',
  ARRIVED: 'Arrivé en agence',
  DELIVERED: 'Retiré par le client',
  RETURNED: 'Retourné à la boutique',
};

/**
 * Un code de suivi Colis Express a la forme `CLI-` suivi de six caractères.
 *
 * On accepte les minuscules et les espaces (le code est souvent dicté au
 * téléphone) et on normalise en majuscules : le prestataire compare les codes
 * tels quels.
 */
export function normaliseTrackingCode(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!cleaned) return null;
  // « CLI123456 » saisi sans tiret : on le remet.
  const withDash = /^CLI[A-Z0-9]{6}$/.test(cleaned) ? `${cleaned.slice(0, 3)}-${cleaned.slice(3)}` : cleaned;
  return isValidTrackingCode(withDash) ? withDash : null;
}

export function isValidTrackingCode(code: string): boolean {
  return /^CLI-[A-Z0-9]{6}$/.test(code);
}

/** Lien public de suivi, à ouvrir dans un nouvel onglet. */
export function trackingUrl(code: string): string {
  const base = env.colisExpress.trackingBase.replace(/\/$/, '');
  return `${base}/suivi.html?code=${encodeURIComponent(code)}`;
}

/** Lien d'inscription / connexion au service, pour l'équipe. */
export function providerHomeUrl(): string {
  return env.colisExpress.trackingBase.replace(/\/$/, '');
}

type ProviderStatus = {
  configured: boolean;
  /** Libellé brut renvoyé par le prestataire. */
  label: string | null;
  /** Statut correspondant dans notre vocabulaire. */
  status: 'DISPATCHED' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED' | 'RETURNED' | null;
  /** Date de mise à jour, si le prestataire la fournit. */
  updatedAt: Date | null;
  error: string | null;
};

/**
 * Lit le dernier statut d'un colis chez le prestataire.
 *
 * Sans `COLIS_EXPRESS_API_BASE`, la fonction ne tente **aucun** appel réseau :
 * elle retourne `configured: false`, et l'écran d'expédition propose d'ouvrir le
 * lien de suivi. Cela évite de faire croire à une synchronisation qui n'existe
 * pas.
 */
export async function fetchProviderStatus(code: string): Promise<ProviderStatus> {
  const base = env.colisExpress.apiBase;
  if (!base) return { configured: false, label: null, status: null, updatedAt: null, error: null };
  if (!isValidTrackingCode(code)) {
    return { configured: true, label: null, status: null, updatedAt: null, error: 'Code de suivi invalide.' };
  }

  const url = `${base.replace(/\/$/, '')}${env.colisExpress.apiStatusPath.replace('{code}', encodeURIComponent(code))}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.colisExpress.timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(env.colisExpress.token ? { Authorization: `Bearer ${env.colisExpress.token}` } : {}),
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        configured: true,
        label: null,
        status: null,
        updatedAt: null,
        error: `Colis Express a répondu ${response.status}.`,
      };
    }

    const payload = (await response.json()) as unknown;
    const record = firstRecord(payload);
    const label = readString(record, ['statut', 'status', 'etat', 'state', 'libelle', 'lastStatus']);
    const rawDate = readString(record, ['updatedAt', 'updated_at', 'date', 'dateMaj', 'derniereMiseAJour']);

    return {
      configured: true,
      label,
      status: label ? shipmentStatusFromProvider(label) : null,
      updatedAt: rawDate ? new Date(rawDate) : null,
      error: null,
    };
  } catch (error) {
    return {
      configured: true,
      label: null,
      status: null,
      updatedAt: null,
      error:
        error instanceof Error && error.name === 'AbortError'
          ? 'Colis Express n’a pas répondu à temps.'
          : 'Colis Express est injoignable pour le moment.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalise(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Le colis peut être à la racine, sous `data`, ou dans un tableau `colis`. */
function firstRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  for (const key of ['data', 'colis', 'parcel', 'result']) {
    const nested = root[key];
    if (Array.isArray(nested) && nested[0] && typeof nested[0] === 'object') return nested[0] as Record<string, unknown>;
    if (nested && typeof nested === 'object') return nested as Record<string, unknown>;
  }
  return root;
}

function readString(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}
