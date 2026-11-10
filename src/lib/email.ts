import { env } from './env';

/**
 * Envoi d'e-mails transactionnels.
 *
 * Aucune dépendance : deux fournisseurs par API HTTP, au choix.
 *
 *   BREVO_API_KEY    → https://brevo.com    (300 e-mails/jour gratuits, domaine vérifié)
 *   RESEND_API_KEY   → https://resend.com   (alternative, mêmes fonctions)
 *   EMAIL_FROM       → expéditeur, ex. « Perokado <no-reply@perokado.com> »
 *   EMAIL_REPLY_TO   → option : adresse de réponse, ex. « contact@perokado.com »
 *
 * Brevo est prioritaire s'il est configuré ; les deux clés peuvent cohabiter,
 * ce qui permet de basculer d'un fournisseur à l'autre en une variable.
 *
 * Sans clé, `configured` est false : l'application ne prétend pas envoyer
 * d'e-mail et propose la remise du lien par WhatsApp depuis l'écran Utilisateurs.
 */

export function emailStatus() {
  const provider = env.email.brevoApiKey ? 'brevo' : env.email.resendApiKey ? 'resend' : null;
  return {
    configured: Boolean(provider && env.email.from),
    provider,
    from: env.email.from || null,
    replyTo: env.email.replyTo || null,
    note: provider
      ? `Fournisseur : ${provider}. Les e-mails (bienvenue, commande, bon, réinitialisation) partent automatiquement.`
      : 'Aucun fournisseur d’e-mail configuré : les liens de réinitialisation sont remis par WhatsApp depuis l’écran Utilisateurs, et les e-mails de commande ne partent pas.',
  };
}

/** Contenu d'un e-mail. `html` est optionnel : à défaut, le texte brut est envoyé. */
export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Adresse de réponse : le client peut écrire à la boutique depuis sa boîte. */
  replyTo?: string;
};

/** Envoie un e-mail ; retourne un statut, ne lève jamais. */
export async function sendEmail(payload: EmailPayload): Promise<{ sent: boolean; error?: string }> {
  const { to, subject, text, html } = payload;
  const from = env.email.from;
  const replyTo = payload.replyTo ?? env.email.replyTo;
  if (!from) return { sent: false, error: 'EMAIL_FROM n’est pas configuré.' };
  if (!isDeliverableAddress(to)) return { sent: false, error: `Adresse destinataire invalide : ${to}` };

  try {
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
          ...(html ? { htmlContent: html } : {}),
          ...(replyTo ? { replyTo: { email: replyTo } } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) return { sent: true };
      return { sent: false, error: `Brevo HTTP ${response.status}` };
    }

    if (env.email.resendApiKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.email.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          text,
          ...(html ? { html } : {}),
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) return { sent: true };
      return { sent: false, error: `Resend HTTP ${response.status}` };
    }

    return { sent: false, error: 'Aucun fournisseur d’e-mail configuré.' };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : 'Réseau indisponible' };
  }
}

/** « Perokado <no-reply@x.com> » → { name, email } (format attendu par Brevo). */
export function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1] || 'Perokado', email: match[2]! };
  return { name: 'Perokado', email: from.trim() };
}

/** Adresse plausible ? Évite d'appeler le fournisseur pour une saisie incomplète. */
export function isDeliverableAddress(value: string | null | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(value ?? '').trim());
}

/** Adresses techniques créées pour le personnel : jamais de courrier sortant. */
export function isInternalAddress(value: string | null | undefined): boolean {
  const address = String(value ?? '').toLowerCase();
  // L'ancien domaine reste reconnu : des comptes agents peuvent l'utiliser.
  return address.endsWith('@agents.perokado.local') || address.endsWith('@agents.medi.local');
}
