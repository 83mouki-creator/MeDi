import { env } from './env';
import { whatsappDigits } from './staff-access';

/**
 * Envoi WhatsApp.
 *
 * Deux modes, sans dépendance externe :
 *
 * 1. **API WhatsApp Business (Meta)** — si `WHATSAPP_API_TOKEN` et
 *    `WHATSAPP_PHONE_NUMBER_ID` sont définis. Meta n'autorise un message libre
 *    que dans les 24 h suivant un message du destinataire : pour une première
 *    prise de contact, il faut un **modèle approuvé**
 *    (`WHATSAPP_TEMPLATE_NAME`, langue `WHATSAPP_TEMPLATE_LANG`).
 * 2. **Lien `wa.me` prérempli** — toujours disponible : l'administrateur ouvre
 *    WhatsApp avec le message déjà écrit et appuie sur « envoyer ». Aucune clé
 *    requise, fonctionne dès aujourd'hui.
 */

export type WhatsAppDelivery = {
  /** true si le message est réellement parti par l'API. */
  delivered: boolean;
  mode: 'api' | 'link';
  /** Lien prérempli, dans tous les cas (repli ou renvoi manuel). */
  link: string;
  error?: string;
};

export function whatsappStatus() {
  const apiConfigured = Boolean(env.whatsapp.apiToken && env.whatsapp.phoneNumberId);
  return {
    apiConfigured,
    templateConfigured: Boolean(env.whatsapp.templateName),
    templateName: env.whatsapp.templateName || null,
    mode: apiConfigured ? ('api' as const) : ('link' as const),
    note: apiConfigured
      ? env.whatsapp.templateName
        ? `API WhatsApp Business configurée (modèle « ${env.whatsapp.templateName} »).`
        : 'API WhatsApp Business configurée (message libre — uniquement dans les 24 h suivant un message du destinataire).'
      : 'Envoi assisté : le message est prérempli dans WhatsApp, l’administrateur valide l’envoi. Aucune clé API requise.',
  };
}

/** Lien cliquable `wa.me` avec message prérempli. */
export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${whatsappDigits(phone)}?text=${encodeURIComponent(message)}`;
}

async function postToGraph(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const version = env.whatsapp.apiVersion;
  const url = `https://graph.facebook.com/${version}/${env.whatsapp.phoneNumberId}/messages`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.whatsapp.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return { ok: true };
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    return { ok: false, error: payload?.error?.message ?? `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Réseau indisponible' };
  }
}

/**
 * Envoie un message WhatsApp si l'API est configurée.
 * Ne lève jamais d'exception : en cas d'échec, le lien manuel reste disponible.
 */
export async function sendWhatsApp(params: {
  to: string;
  message: string;
  /** Paramètres du modèle approuvé (dans l'ordre des variables du corps). */
  templateParams?: string[];
}): Promise<WhatsAppDelivery> {
  const link = whatsappLink(params.to, params.message);
  if (!env.whatsapp.apiToken || !env.whatsapp.phoneNumberId) {
    return { delivered: false, mode: 'link', link };
  }

  const to = whatsappDigits(params.to);
  if (env.whatsapp.templateName && params.templateParams?.length) {
    const result = await postToGraph({
      to,
      type: 'template',
      template: {
        name: env.whatsapp.templateName,
        language: { code: env.whatsapp.templateLang },
        components: [
          {
            type: 'body',
            parameters: params.templateParams.map((text) => ({ type: 'text', text })),
          },
        ],
      },
    });
    if (result.ok) return { delivered: true, mode: 'api', link };
    return { delivered: false, mode: 'api', link, error: result.error };
  }

  const result = await postToGraph({ to, type: 'text', text: { preview_url: true, body: params.message } });
  if (result.ok) return { delivered: true, mode: 'api', link };
  return { delivered: false, mode: 'api', link, error: result.error };
}
