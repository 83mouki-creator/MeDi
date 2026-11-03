import { expireReservations } from './orders';

/**
 * Libération opportuniste des réservations de stock expirées.
 *
 * Une commande non payée réserve ses articles pendant un délai (par défaut
 * 2 heures). Passé ce délai, les articles doivent revenir en vente : sinon le
 * stock « disparaît » de la boutique alors que les pièces sont toujours en
 * rayon — la boutique refuse alors de vendre ce qu'elle possède.
 *
 * Deux protections, complémentaires :
 *  • la tâche planifiée (`vercel.json` → `/api/cron/expire-reservations`) ;
 *  • ce balayage opportuniste, déclenché par les visites réelles (catalogue,
 *    fiche produit, commande). Même si la tâche planifiée n'est pas encore
 *    active ou si le quota d'hébergement ne la déclenche pas, le stock se
 *    libère tout seul dès qu'un client consulte la boutique.
 *
 * Le balayage est limité à un passage par intervalle et par instance : le coût
 * reste une requête indexée de temps en temps, jamais à chaque page.
 */

const DEFAULT_INTERVAL_MS = 60_000;

/** Les erreurs de balayage ne doivent jamais empêcher une page de s'afficher. */
export function sweepIntervalMs(): number {
  const fromEnv = Number(process.env.RESERVATION_SWEEP_INTERVAL_MS ?? '');
  return Number.isFinite(fromEnv) && fromEnv >= 0 ? fromEnv : DEFAULT_INTERVAL_MS;
}

/** Faut-il relancer un balayage maintenant ? (fonction pure, testable) */
export function shouldSweep(lastRunAt: number, now: number, intervalMs = DEFAULT_INTERVAL_MS): boolean {
  if (!Number.isFinite(lastRunAt) || lastRunAt <= 0) return true;
  if (intervalMs <= 0) return true;
  if (now < lastRunAt) return true; // horloge incohérente : on préfère balayer
  return now - lastRunAt >= intervalMs;
}

let lastSweepAt = 0;
let running: Promise<number> | null = null;

/**
 * Libère les réservations expirées, au plus une fois par intervalle.
 * Retourne le nombre de commandes annulées (0 si rien n'a été fait).
 */
export async function sweepExpiredReservations(options?: { force?: boolean }): Promise<number> {
  const interval = sweepIntervalMs();
  if (!options?.force && !shouldSweep(lastSweepAt, Date.now(), interval)) {
    return running ? await running : 0;
  }
  if (running) return running;

  lastSweepAt = Date.now();
  running = expireReservations(50)
    .then((result) => result.expired)
    .catch((error) => {
      console.error('[reservations] balayage impossible', error);
      return 0;
    })
    .finally(() => {
      running = null;
    });

  return running;
}
