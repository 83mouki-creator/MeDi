import { env } from './env';

/**
 * Envoi d'e-mails transactionnels.
 *
 * Aucune dépendance : deux fournisseurs par API HTTP, au choix.
 *
 *   RESEND_API_KEY   → https://resend.com   (le plus simple : domaine vérifié)
 *   BREVO_API_KEY    → https://brevo.com    (offre gratuite, expéditeurs vérifiés)
 *   EMAIL_FROM       → expéditeur, ex. « MeDi <no-reply@medidaloa.ci> »
 *
 * Sans clé, `configured` est false : l'application ne prétend pas envoyer d'e-mail
 * et propose la remise du lien par WhatsApp depuis l'écran Utilisateurs.
 */

export function emailStatus() {
  const provider = env.email.resendApiKey ? 'resend' : env.email.brevoApiKey ? 'brevo' : null;
  return {
    configured: Boolean(provider && env.email.from),
    provider,
    from: env.email.from || null,
    note: provider
      ? `Fournisseur : ${provider}. Les liens de réinitialisation sont envoyés automatiquement.`
      : 'Aucun fournisseur d’e-mail configuré : les liens de réinitialisation sont remis par WhatsApp depuis l’écran Utilisateurs.',
  };
}

export type EmailPayload = { to: string; subject: string; text: string };

/** Envoie un e-mail ; retourne un statut, ne lève jamais. */
export async function sendEmail(payload: EmailPayload): Promise<{ sent: boolean; error?: string }> {
  const { to, subject, text } = payload;
  const from = env.email.from;
  if (!from) return { sent: false, error: 'EMAIL_FROM n’est pas configuré.' };

  try {
    if (env.email.resendApiKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.email.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) return { sent: true };
      return { sent: false, error: `Resend HTTP ${response.status}` };
    }

    if (env.email.brevoApiKey) {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': env.email.brevoApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: parseSender(from),
          to: [{ email: to }],
          subject,
          textContent: text,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) return { sent: true };
      return { sent: false, error: `Brevo HTTP ${response.status}` };
    }

    return { sent: false, error: 'Aucun fournisseur d’e-mail configuré.' };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : 'Réseau indisponible' };
  }
}

/** « MeDi <no-reply@x.ci> » → { name, email } (format attendu par Brevo). */
function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1] || 'MeDi', email: match[2]! };
  return { name: 'MeDi', email: from.trim() };
}
