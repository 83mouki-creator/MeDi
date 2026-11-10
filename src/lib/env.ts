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

  /**
   * Encaissement mobile money / carte (Wave, portefeuilles, agrégateur PSP).
   *
   * `merchantNumber` est le numéro marchand communiqué aux clients en mode
   * manuel (Wave marchand, compte marchand PSP). `merchantLabel` est le nom
   * affiché à côté de ce numéro (ex. « Wave », « Orange Money »).
   */
  psp: {
    /** Numéro / compte marchand affiché au client. */
    merchantNumber: optional('PSP_MERCHANT_NUMBER'),
    /** Nom du prestataire, en clair. */
    merchantLabel: optional('PSP_MERCHANT_LABEL'),
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

  /** WhatsApp Business (Meta Cloud API) — envoi des codes d'accès au personnel. */
  whatsapp: {
    apiToken: optional('WHATSAPP_API_TOKEN'),
    phoneNumberId: optional('WHATSAPP_PHONE_NUMBER_ID'),
    apiVersion: optional('WHATSAPP_API_VERSION', 'v21.0'),
    /** Modèle approuvé par Meta, requis pour une première prise de contact. */
    templateName: optional('WHATSAPP_TEMPLATE_NAME'),
    templateLang: optional('WHATSAPP_TEMPLATE_LANG', 'fr'),
    get configured() {
      return Boolean(optional('WHATSAPP_API_TOKEN') && optional('WHATSAPP_PHONE_NUMBER_ID'));
    },
  },

  /** E-mails transactionnels (bienvenue, commande, bon, réinitialisation). */
  email: {
    brevoApiKey: optional('BREVO_API_KEY'),
    resendApiKey: optional('RESEND_API_KEY'),
    from: optional('EMAIL_FROM'),
    /** Adresse de réponse affichée dans la boîte du client (optionnelle). */
    replyTo: optional('EMAIL_REPLY_TO'),
    get configured() {
      return Boolean((optional('BREVO_API_KEY') || optional('RESEND_API_KEY')) && optional('EMAIL_FROM'));
    },
  },

  /**
   * Colis Express — transporteur des commandes hors de Daloa.
   *
   * Le prestataire n'expose pas d'API publique documentée. Deux niveaux :
   *
   *  • `trackingBase` : adresse du site public, utilisée pour construire les
   *    liens de suivi `/suivi.html?code=CLI-XXXXXX`. Fonctionne toujours ;
   *  • `apiBase` + `apiStatusPath` + `token` : renseignés seulement si le
   *    prestataire fournit une API. Sans eux, l'administration n'appelle rien
   *    et se contente d'ouvrir le lien de suivi.
   */
  colisExpress: {
    trackingBase: optional('COLIS_EXPRESS_TRACKING_BASE', 'https://colisexpress-shopin30.vercel.app'),
    apiBase: optional('COLIS_EXPRESS_API_BASE'),
    token: optional('COLIS_EXPRESS_TOKEN'),
    /** Chemin de lecture d'un colis, `{code}` remplacé par le code de suivi. */
    apiStatusPath: optional('COLIS_EXPRESS_STATUS_PATH', '/api/colis/{code}'),
    timeoutMs: Number(optional('COLIS_EXPRESS_TIMEOUT_MS', '6000')),
    get configured() {
      return Boolean(optional('COLIS_EXPRESS_API_BASE'));
    },
  },

  sessionCookieName: 'perokado_session',
  cartCookieName: 'perokado_cart',
  sessionTtlDays: 30,
};

export function assertServerEnv() {
  required('DATABASE_URL');
}
