import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env';

/**
 * Intégration Wave — API Checkout officielle (https://docs.wave.com/checkout).
 *
 * Prérequis réels côté marchand :
 *  - un compte Wave Business en Côte d'Ivoire (entité distincte de Wave Sénégal) ;
 *  - une clé API créée dans le portail développeur Wave Business, limitée aux
 *    API nécessaires (checkout) ;
 *  - l'URL de webhook enregistrée par un représentant Wave avec un secret
 *    de webhook dédié (différent de la clé API) ;
 *  - éventuellement une liste d'IP autorisées si l'option est activée.
 *
 * Sans clé API, la plateforme bascule sur le mode MANUAL : le client paie vers
 * le numéro Wave de la boutique et l'administrateur confirme après vérification
 * du crédit réel. Aucune confirmation n'est jamais simulée.
 */

export type WaveCheckoutSession = {
  id: string;
  amount: string;
  currency: string;
  checkout_status: 'open' | 'complete' | 'expired';
  payment_status: 'processing' | 'cancelled' | 'succeeded' | null;
  transaction_id: string | null;
  wave_launch_url: string;
  success_url: string;
  error_url: string;
  client_reference: string | null;
  when_created: string;
  when_expires: string;
  last_payment_error: { code: string; message: string } | null;
};

export type WaveStatus = {
  mode: 'AUTO' | 'MANUAL';
  apiConfigured: boolean;
  webhookConfigured: boolean;
  checkoutAvailable: boolean;
  reason: string;
};

export function waveStatus(): WaveStatus {
  const apiConfigured = Boolean(env.wave.apiKey);
  const webhookConfigured = Boolean(env.wave.webhookSecret);
  const autoRequested = env.wave.mode === 'AUTO';

  if (autoRequested && apiConfigured) {
    return {
      mode: 'AUTO',
      apiConfigured,
      webhookConfigured,
      checkoutAvailable: true,
      reason: webhookConfigured
        ? 'Paiement Wave automatique : session créée par l’API, confirmation par webhook signé et vérification serveur.'
        : 'Clé API Wave présente mais aucun secret de webhook : la confirmation repose sur la vérification serveur manuelle ou l’administration.',
    };
  }

  return {
    mode: 'MANUAL',
    apiConfigured,
    webhookConfigured,
    checkoutAvailable: false,
    reason: apiConfigured
      ? 'WAVE_MODE=MANUAL : le paiement est vérifié par un administrateur.'
      : 'Aucune clé API Wave configurée : paiement vers le numéro marchand avec vérification manuelle par un administrateur.',
  };
}

async function waveFetch<T>(path: string, init: RequestInit & { bodyString?: string } = {}): Promise<T> {
  if (!env.wave.apiKey) throw new Error('WAVE_API_KEY absent : intégration Wave indisponible.');

  const url = `${env.wave.apiBase}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${env.wave.apiKey}`);
  headers.set('Content-Type', 'application/json');

  const bodyString = init.bodyString;
  if (bodyString && env.wave.signingSecret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', env.wave.signingSecret).update(timestamp + bodyString).digest('hex');
    headers.set('Wave-Signature', `t=${timestamp},v1=${signature}`);
  }

  const response = await fetch(url, {
    ...init,
    headers,
    body: bodyString ?? init.body,
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = (json as { error?: { message?: string } })?.error?.message ?? `Erreur Wave (${response.status})`;
    throw new WaveError(message, response.status, json);
  }
  return json as T;
}

export class WaveError extends Error {
  constructor(
    message: string,
    public status: number,
    public payload: unknown,
  ) {
    super(message);
  }
}

/** Crée une session de paiement Wave. Le montant est toujours un entier XOF côté serveur. */
export async function createCheckoutSession(params: {
  amount: number;
  clientReference: string;
  successUrl: string;
  errorUrl: string;
  restrictPayerMobile?: string;
}): Promise<WaveCheckoutSession> {
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    throw new Error('Montant Wave invalide : entier XOF positif attendu.');
  }

  const payload: Record<string, string> = {
    amount: String(params.amount),
    currency: 'XOF',
    client_reference: params.clientReference,
    success_url: params.successUrl,
    error_url: params.errorUrl,
  };
  if (params.restrictPayerMobile) payload.restrict_payer_mobile = params.restrictPayerMobile;
  const bodyString = JSON.stringify(payload);

  return waveFetch<WaveCheckoutSession>('/v1/checkout/sessions', {
    method: 'POST',
    bodyString,
  });
}

export async function retrieveCheckoutSession(sessionId: string): Promise<WaveCheckoutSession> {
  return waveFetch<WaveCheckoutSession>(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'GET',
  });
}

export async function expireCheckoutSession(sessionId: string): Promise<WaveCheckoutSession> {
  return waveFetch<WaveCheckoutSession>(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`, {
    method: 'POST',
    bodyString: JSON.stringify({}),
  });
}

/**
 * Vérifie une notification serveur Wave.
 * En-tête attendu : `Wave-Signature: t=<timestamp>,v1=<hmac>[,v1=<autre>]`
 * signature = HMAC-SHA256(secret, timestamp + corps brut).
 * Les notifications de plus de 5 minutes sont rejetées (anti-rejeu).
 */
export function verifyWaveWebhook(rawBody: string, signatureHeader: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!signatureHeader || !secret) return { valid: false, reason: 'missing_signature' as const };

  const parts = signatureHeader.split(',');
  const timestampPart = parts.find((p) => p.trim().startsWith('t='));
  const signatureParts = parts.filter((p) => p.trim().startsWith('v1='));
  if (!timestampPart || signatureParts.length === 0) return { valid: false, reason: 'malformed' as const };

  const timestamp = Number(timestampPart.trim().slice(2));
  if (!Number.isFinite(timestamp)) return { valid: false, reason: 'malformed' as const };

  // Anti-rejeu : 5 minutes de tolérance.
  if (Math.abs(nowSeconds - timestamp) > 300) return { valid: false, reason: 'expired_timestamp' as const };

  const expected = createHmac('sha256', secret).update(`${timestamp}${rawBody}`).digest();
  const matches = signatureParts.some((part) => {
    const provided = Buffer.from(part.trim().slice(3), 'hex');
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  });

  return matches ? { valid: true, reason: 'ok' as const } : { valid: false, reason: 'bad_signature' as const };
}

export type WaveWebhookEvent = {
  id: string;
  type: string;
  data?: {
    id?: string;
    amount?: string;
    currency?: string;
    payment_status?: string;
    checkout_status?: string;
    transaction_id?: string;
    client_reference?: string;
  };
};

export function parseWaveEvent(rawBody: string): WaveWebhookEvent | null {
  try {
    const parsed = JSON.parse(rawBody) as WaveWebhookEvent;
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.type !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}
