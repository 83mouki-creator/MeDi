/**
 * Constantes d'affichage des stickers — **utilisables côté navigateur**.
 *
 * Ce fichier ne contient volontairement **aucun accès à la base de données** : les
 * composants clients (vignette produit, écran d'administration des stickers) ont
 * besoin des teintes, des symboles et de la limite de deux par produit, mais
 * importer `@/lib/stickers` embarquerait tout le pilote PostgreSQL dans le
 * paquet JavaScript envoyé au téléphone du client.
 *
 * Les requêtes, elles, restent dans `@/lib/stickers` (serveur uniquement).
 */
import type { StickerIcon, StickerTone } from '../db/schema';

/** Vignette telle qu'affichée au client (jamais de dates ni d'identifiants internes). */
export type StickerView = {
  id: string;
  label: string;
  detail: string | null;
  tone: StickerTone;
  icon: StickerIcon;
  /** 0 = en bas à gauche de la photo, 1 = en bas à droite. */
  position: number;
};

/**
 * Sticker tel que le voit l'administration : la vignette **et** ses conditions
 * (dates, activation, nombre de produits concernés).
 */
export type StickerRecord = {
  id: string;
  label: string;
  detail: string | null;
  tone: StickerTone;
  icon: StickerIcon;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  productCount: number;
};

/** Deux emplacements par produit : un à gauche, un à droite. */
export const MAX_STICKERS_PER_PRODUCT = 2;

export const STICKER_TONES: StickerTone[] = ['GOLD', 'GREEN', 'RED', 'NAVY', 'WHITE'];

export const STICKER_ICONS: StickerIcon[] = ['none', 'shield', 'percent', 'tag', 'truck', 'clock', 'star', 'gift'];

/** Classes Tailwind par teinte : lisibles sur n'importe quelle photo produit. */
export const STICKER_TONE_CLASSES: Record<StickerTone, string> = {
  GOLD: 'bg-accent-500 text-navy-950 ring-accent-300',
  GREEN: 'bg-emerald-600 text-white ring-emerald-300',
  RED: 'bg-rose-600 text-white ring-rose-300',
  NAVY: 'bg-navy-900 text-white ring-navy-600',
  WHITE: 'bg-white text-navy-950 ring-navy-200',
};

export const STICKER_TONE_LABELS: Record<StickerTone, string> = {
  GOLD: 'Doré',
  GREEN: 'Vert',
  RED: 'Rouge',
  NAVY: 'Bleu nuit',
  WHITE: 'Blanc',
};

export const STICKER_ICON_LABELS: Record<StickerIcon, string> = {
  none: 'Sans symbole',
  shield: 'Garantie (bouclier)',
  percent: 'Réduction (%)',
  tag: 'Étiquette (prix)',
  truck: 'Livraison (camion)',
  clock: 'Durée (horloge)',
  star: 'Coup de cœur (étoile)',
  gift: 'Cadeau',
};

/** Un sticker est visible si actif et dans sa fenêtre de dates. */
export function isStickerLive(
  sticker: { isActive: boolean; startsAt: Date | string | null; endsAt: Date | string | null },
  now = new Date(),
): boolean {
  if (!sticker.isActive) return false;
  const starts = sticker.startsAt ? new Date(sticker.startsAt) : null;
  const ends = sticker.endsAt ? new Date(sticker.endsAt) : null;
  if (starts && starts.getTime() > now.getTime()) return false;
  if (ends && ends.getTime() < now.getTime()) return false;
  return true;
}
