import { createHash, randomBytes } from 'node:crypto';

/**
 * Accès du personnel sans inscription libre.
 *
 * Un administrateur crée le compte (nom, prénom, téléphone ivoirien, tâche,
 * rôle) et l'application génère un **code d'accès à usage unique**. Le code est
 * transmis par WhatsApp ; il n'est jamais stocké en clair (SHA-256 uniquement)
 * et il n'est affiché qu'une seule fois, au moment de sa création.
 */

/** Alphabet sans caractères ambigus (pas de 0/O, 1/I/L) : lisible au téléphone. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_GROUPS = 3;
const CODE_GROUP_SIZE = 4;
const CODE_PREFIX = 'MEDI';

export const STAFF_CODE_TTL_HOURS = 24 * 7;
export const STAFF_PASSWORD_MIN = 10;

/**
 * Code au format `MEDI-XXXX-XXXX-XXXX` (~1,7 · 10¹⁷ combinaisons).
 * Généré par le module `crypto` : jamais par `Math.random`.
 */
export function generateStaffCode(): string {
  const groups: string[] = [];
  for (let group = 0; group < CODE_GROUPS; group += 1) {
    let chunk = '';
    // Rejet des octets hors alphabet pour rester uniforme.
    while (chunk.length < CODE_GROUP_SIZE) {
      for (const byte of randomBytes(CODE_GROUP_SIZE * 2)) {
        if (byte < 256 - (256 % CODE_ALPHABET.length)) {
          chunk += CODE_ALPHABET[byte % CODE_ALPHABET.length];
          if (chunk.length === CODE_GROUP_SIZE) break;
        }
      }
    }
    groups.push(chunk);
  }
  return [CODE_PREFIX, ...groups].join('-');
}

/** Forme canonique utilisée pour la comparaison (majuscules, sans séparateurs). */
export function normalizeStaffCode(code: string): string {
  return String(code ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function hashStaffCode(code: string): string {
  return createHash('sha256').update(normalizeStaffCode(code)).digest('hex');
}

/** Saisie tolérante : « medi 7k4p 9qx2 w8mt » → « MEDI-7K4P-9QX2-W8MT ». */
export function formatStaffCodeInput(code: string): string {
  const normalized = normalizeStaffCode(code);
  if (normalized.length <= 4) return normalized;
  return normalized.replace(/(.{4})(?=.)/g, '$1-');
}

export function isValidStaffCodeShape(code: string): boolean {
  return /^MEDI[A-Z0-9]{12}$/.test(normalizeStaffCode(code));
}

// ───────────────────────────── Téléphone ivoirien ─────────────────────────────

/** Mobiles `01/05/07` et fixes `21/23/25/27`, toujours 10 chiffres. */
const IVORIAN_PHONE = /^(0[157]|2[1357])\d{8}$/;

export type PhoneNormalization =
  | { ok: true; canonical: string; display: string }
  | { ok: false; reason: 'EMPTY' | 'INVALID' };

/**
 * Normalise un numéro ivoirien vers `+225XXXXXXXXXX`.
 *
 * Plan de numérotation ivoirien (10 chiffres) : mobiles `01/05/07` + 8 chiffres,
 * fixes `21/23/25/27` + 8 chiffres. Accepte « 07 08 90 48 91 », « 0708904891 »,
 * « +225 07 08 90 48 91 », « 00225 0708904891 », « 27 20 00 11 22 ».
 */
export function normalizeIvorianPhone(input: unknown): PhoneNormalization {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, reason: 'EMPTY' };

  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  // Indicatif pays uniquement s'il précède un numéro complet (13 chiffres au total).
  if (digits.length === 13 && digits.startsWith('225')) digits = digits.slice(3);

  if (!IVORIAN_PHONE.test(digits)) return { ok: false, reason: 'INVALID' };

  const display = digits.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5');
  return { ok: true, canonical: `+225${digits}`, display };
}

/** Numéro au format international sans `+`, pour `wa.me`. */
export function whatsappDigits(canonicalPhone: string): string {
  return canonicalPhone.replace(/[^\d]/g, '');
}

// ───────────────────────────── Messages WhatsApp ─────────────────────────────

export type StaffInvite = {
  firstName: string;
  lastName: string;
  phone: string;
  code: string;
  roleLabel: string;
  task: string;
  activationUrl: string;
  storeName?: string;
};

/** Message envoyé à l'agent : court, sans jargon, code bien visible. */
export function staffInviteMessage(invite: StaffInvite): string {
  const store = invite.storeName?.trim() || 'MeDi';
  const fullName = [invite.firstName, invite.lastName].filter(Boolean).join(' ');
  return [
    `Bonjour ${fullName},`,
    ``,
    `${store} vous ouvre l’accès à l’outil d’administration.`,
    `Tâche assignée : ${invite.task}`,
    `Rôle : ${invite.roleLabel}`,
    ``,
    `Votre code d’accès : ${invite.code}`,
    `Ce code est personnel, à usage unique, valable 7 jours.`,
    ``,
    `1. Ouvrez ${invite.activationUrl}`,
    `2. Saisissez ce code, votre nom et votre numéro de téléphone`,
    `3. Choisissez votre mot de passe : vous pouvez commencer à travailler.`,
    ``,
    `Ne partagez ce code avec personne. ${store}`,
  ].join('\n');
}

export function staffResetMessage(params: {
  firstName: string;
  resetUrl: string;
  storeName?: string;
  expiresInMinutes?: number;
}): string {
  const store = params.storeName?.trim() || 'MeDi';
  const minutes = params.expiresInMinutes ?? 60;
  return [
    `Bonjour ${params.firstName},`,
    ``,
    `${store} : réinitialisation de votre mot de passe.`,
    `Lien valable ${minutes} minutes, à usage unique :`,
    params.resetUrl,
    ``,
    `Si vous n’êtes pas à l’origine de cette demande, ignorez ce message. ${store}`,
  ].join('\n');
}

/**
 * Classes de mots de passe proposées au personnel : pas de mot de passe imposé,
 * mais un contrôle explicite côté serveur.
 */
export function validateStaffPassword(password: string, confirmation: string): string | null {
  if (password.length < STAFF_PASSWORD_MIN) return `Le mot de passe doit contenir au moins ${STAFF_PASSWORD_MIN} caractères.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  if (password !== confirmation) return 'Les deux mots de passe ne correspondent pas.';
  return null;
}

/** Initiales utilisées dans les avatars (« Awa Koné » → AK). */
export function initials(firstName?: string | null, lastName?: string | null): string {
  const a = (firstName ?? '').trim();
  const b = (lastName ?? '').trim();
  return `${a.charAt(0)}${b.charAt(0)}`.toUpperCase() || '—';
}
