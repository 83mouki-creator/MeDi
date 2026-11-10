import { Clock, Gift, Percent, ShieldCheck, Star, Tag, Truck, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STICKER_TONE_CLASSES, type StickerView } from '@/lib/sticker-constants';
import type { StickerIcon } from '@/db/schema';

const ICONS: Record<StickerIcon, LucideIcon | null> = {
  none: null,
  shield: ShieldCheck,
  percent: Percent,
  tag: Tag,
  truck: Truck,
  clock: Clock,
  star: Star,
  gift: Gift,
};

/**
 * Vignette affichée sur la photo d'un produit : « Garantie 12 mois », « -20 % »…
 *
 * Mobile d'abord : la vignette reste lisible à 32 px de haut sur une vignette
 * produit de 160 px de large, sans jamais recouvrir le prix ni le bouton
 * d'achat. `compact` est utilisé dans les grilles, la version complète sur la
 * fiche produit.
 */
export function ProductSticker({
  sticker,
  compact = false,
  className,
}: {
  sticker: StickerView;
  compact?: boolean;
  className?: string;
}) {
  const Icon = ICONS[sticker.icon] ?? null;
  return (
    <span
      className={cn(
        'pointer-events-none inline-flex max-w-full items-center gap-1 rounded-md font-bold shadow-sm ring-1',
        compact ? 'px-1.5 py-0.5 text-[10px] leading-tight' : 'px-2 py-1 text-[11px] leading-tight sm:text-xs',
        STICKER_TONE_CLASSES[sticker.tone],
        className,
      )}
    >
      {Icon ? <Icon className={compact ? 'size-3 shrink-0' : 'size-3.5 shrink-0'} aria-hidden /> : null}
      <span className="flex min-w-0 flex-col">
        <span className="line-clamp-1">{sticker.label}</span>
        {sticker.detail ? (
          <span className={cn('font-semibold opacity-80', compact ? 'text-[9px]' : 'text-[10px]')}>{sticker.detail}</span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * La paire de stickers d'un produit, positionnée sur la photo.
 * `position 0` en haut à gauche, `position 1` en haut à droite.
 */
export function ProductStickerOverlay({
  stickers,
  compact = false,
  className,
}: {
  stickers: StickerView[];
  compact?: boolean;
  className?: string;
}) {
  if (stickers.length === 0) return null;
  const left = stickers.filter((sticker) => sticker.position === 0);
  const right = stickers.filter((sticker) => sticker.position !== 0);
  return (
    <div className={cn('pointer-events-none absolute inset-x-1.5 bottom-1.5 flex items-end justify-between gap-1', className)}>
      <span className="flex max-w-[52%] flex-col items-start gap-1">
        {left.map((sticker) => (
          <ProductSticker key={sticker.id} sticker={sticker} compact={compact} />
        ))}
      </span>
      <span className="flex max-w-[46%] flex-col items-end gap-1">
        {right.map((sticker) => (
          <ProductSticker key={sticker.id} sticker={sticker} compact={compact} />
        ))}
      </span>
    </div>
  );
}

/** Bandeau récapitulatif sur la fiche produit (sous le prix). */
export function ProductStickerList({ stickers }: { stickers: StickerView[] }) {
  if (stickers.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {stickers.map((sticker) => (
        <li key={sticker.id}>
          <ProductSticker sticker={sticker} />
        </li>
      ))}
    </ul>
  );
}
