import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formate un montant FCFA : 12500 → « 12 500 FCFA » */
export function formatFCFA(amount: number | string | null | undefined, opts: { suffix?: boolean } = {}) {
  const value = typeof amount === 'string' ? Number(amount) : (amount ?? 0);
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  const formatted = new Intl.NumberFormat('fr-CI', { maximumFractionDigits: 0 }).format(safe);
  return opts.suffix === false ? formatted : `${formatted} FCFA`;
}

/** Convertit un numeric PostgreSQL (string) en entier FCFA sans erreur d'arrondi. */
export function toFcfa(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function formatDate(date: Date | string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...opts,
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined) {
  return formatDate(date, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Normalise un texte pour la recherche : minuscules, sans accents, ponctuation réduite. */
export function normalizeText(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+./ -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(input: string) {
  return normalizeText(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function truncate(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Identifiant court, trié dans le temps (préfixe base36 de l'horodatage). */
export function newId(prefix = '') {
  const time = Date.now().toString(36);
  const random = crypto.getRandomValues(new Uint8Array(8));
  const suffix = Array.from(random, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
  return `${prefix}${time}${suffix}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function absoluteUrl(path: string, base: string) {
  try {
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}
