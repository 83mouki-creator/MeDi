import { after } from 'next/server';
import { emailStatus, isDeliverableAddress, isInternalAddress, sendEmail, type EmailPayload } from './email';

/**
 * Mise en file des e-mails.
 *
 * Deux principes :
 *  1. l'envoi ne doit **jamais** ralentir ou faire échouer une commande ni une
 *     inscription — il part après la réponse HTTP (`after`) ;
 *  2. sans fournisseur configuré, rien n'est tenté et rien n'est promis au
 *     client : les écrans continuent d'afficher les liens à transmettre.
 *
 * Pendant les tests (`NODE_ENV=test`), la file ne fait rien : les tests
 * vérifient les modèles et la requête envoyée au fournisseur, jamais un envoi
 * réel.
 */

/** Faut-il tenter un envoi vers cette adresse ? */
export function shouldQueueEmail(to: string | null | undefined): boolean {
  if (!emailStatus().configured) return false;
  if (!to) return false;
  if (isInternalAddress(to)) return false;
  return isDeliverableAddress(to);
}

/** Exécute une tâche après l'envoi de la réponse (sans jamais lever). */
export function inBackground(task: () => Promise<unknown>): void {
  if (process.env.NODE_ENV === 'test') return;
  const run = () => {
    void task().catch((error) => console.error('[email] tâche de fond', error));
  };
  try {
    // `after` n'existe qu'en cours de requête ; hors requête (script, cron),
    // on exécute immédiatement plutôt que de perdre le message.
    after(run);
  } catch {
    run();
  }
}

/** Met un e-mail en file. No-op silencieux si rien n'est configuré. */
export function queueEmail(payload: EmailPayload): boolean {
  if (!shouldQueueEmail(payload.to)) return false;
  inBackground(async () => {
    const result = await sendEmail(payload);
    if (!result.sent) console.error('[email] envoi', payload.subject, result.error);
  });
  return true;
}
