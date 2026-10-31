/**
 * Réglages de l'application lus depuis l'environnement.
 * Aucun secret n'est exposé au navigateur : ce module n'est importé que côté serveur.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

import { resolveDatabaseUrl, resolveDirectUrl } from './db-url';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',

  /** Connexion applicative (poolée). */
  databaseUrl: resolveDatabaseUrl(),
  /** Connexion directe (migrations) : DIRECT_URL, sinon DATABASE_URL_UNPOOLED, sinon dérivée. */
  directUrl: resolveDirectUrl(),

  /** URL publique du site (liens de retour Wave, e-mails, partage). */
  appUrl: optional('APP_URL', 'http://localhost:3000'),

  /**
   * Jeton à usage unique pour créer le premier compte propriétaire sur
   * /activation. Vide = activation désactivée (comportement par défaut).
   * Lu à chaque appel : l'activation peut être révoquée sans redéploiement.
   */
  get adminSetupToken(): string {
    return optional('ADMIN_SETUP_TOKEN');
  },

  /** Wave — API Checkout officielle (https://docs.wave.com/checkout). */
  wave: {
    apiKey: optional('WAVE_API_KEY'),
    signingSecret: optional('WAVE_SIGNING_SECRET'),
    webhookSecret: optional('WAVE_WEBHOOK_SECRET'),
    /** Numéro Wave marchand affiché au client en mode manuel. */
    merchantNumber: optional('WAVE_MERCHANT_NUMBER'),
    apiBase: optional('WAVE_API_BASE', 'https://api.wave.com'),
    /** MANUAL (confirmation admin) ou AUTO (webhooks + vérification API). */
    mode: (optional('WAVE_MODE', 'MANUAL').toUpperCase() === 'AUTO' ? 'AUTO' : 'MANUAL') as 'AUTO' | 'MANUAL',
    get enabled() {
      return Boolean(optional('WAVE_API_KEY'));
    },
  },

  storage: {
    driver: (optional('STORAGE_DRIVER', 'local') as 'local' | 'cloudinary'),
    localDir: optional('STORAGE_LOCAL_DIR', 'public/uploads'),
    publicBase: optional('STORAGE_PUBLIC_BASE', '/uploads'),
    cloudinary: {
      cloudName: optional('CLOUDINARY_CLOUD_NAME'),
      apiKey: optional('CLOUDINARY_API_KEY'),
      apiSecret: optional('CLOUDINARY_API_SECRET'),
      folder: optional('CLOUDINARY_FOLDER', 'medi/products'),
    },
    get configured() {
      if (this.driver === 'cloudinary') {
        return Boolean(this.cloudinary.cloudName && this.cloudinary.apiKey && this.cloudinary.apiSecret);
      }
      return true;
    },
  },

  /**
   * Fournisseur d'embeddings visuels. `local` = descripteur perceptif calculé
   * dans l'application (aucune dépendance externe). `http` = modèle de vision
   * externe compatible OpenAI (ex. CLIP servi par une API).
   */
  vision: {
    provider: (optional('VISION_PROVIDER', 'local') as 'local' | 'http' | 'none'),
    apiUrl: optional('VISION_API_URL'),
    apiKey: optional('VISION_API_KEY'),
    model: optional('VISION_MODEL', 'clip-vit-base-patch32'),
    dim: Number(optional('VISION_DIM', '0')) || undefined,
  },

  sessionCookieName: 'medi_session',
  cartCookieName: 'medi_cart',
  sessionTtlDays: 30,
};

export function assertServerEnv() {
  required('DATABASE_URL');
}
