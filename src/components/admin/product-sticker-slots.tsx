'use client';

import { useActionState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import {
  setProductStickersAction,
  unassignStickerAction,
  type StickerState,
} from '@/app/actions/admin-stickers';
import { useAdminI18n } from '@/components/admin/admin-i18n';
import { ProductSticker } from '@/components/product-sticker';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';
import type { StickerRecord } from '@/lib/sticker-constants';

type Assigned = { stickerId: string; label: string; detail: string | null; tone: StickerRecord['tone']; icon: StickerRecord['icon']; position: number };

const initial: StickerState = {};

/**
 * Les deux emplacements de sticker d'un produit.
 *
 * Emplacement gauche = position 0, emplacement droit = position 1 (ce qui est
 * affiché sur la photo dans le catalogue). Choisir « aucun » retire le sticker.
 * Les stickers déjà affectés sont listés avec un bouton pour les retirer d'un
 * seul clic, sans passer par le formulaire.
 */
export function ProductStickerSlots({
  productId,
  stickers,
  assigned,
}: {
  productId: string;
  stickers: StickerRecord[];
  assigned: Assigned[];
}) {
  const { t } = useAdminI18n();
  const [state, formAction, pending] = useActionState(setProductStickersAction, initial);

  const left = assigned.find((entry) => entry.position === 0)?.stickerId ?? '';
  const right = assigned.find((entry) => entry.position !== 0)?.stickerId ?? '';

  return (
    <div className="space-y-3">
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      {assigned.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {assigned.map((entry) => (
            <li key={entry.stickerId} className="flex items-center gap-1.5 rounded-lg border border-navy-100 p-1.5">
              <ProductSticker
                sticker={{
                  id: entry.stickerId,
                  label: entry.label,
                  detail: entry.detail,
                  tone: entry.tone,
                  icon: entry.icon,
                  position: entry.position,
                }}
                compact
              />
              <form action={unassignStickerAction}>
                <input type="hidden" name="productId" value={productId} />
                <input type="hidden" name="stickerId" value={entry.stickerId} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="text-danger-500 hover:bg-rose-50"
                  aria-label={t('Retirer {label}', { label: entry.label })}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-navy-500">
          {t('Aucun sticker sur ce produit. Un sticker se crée une fois dans Stickers, puis s’applique ici ou à tout le catalogue.')}
        </p>
      )}

      {stickers.length === 0 ? null : (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="productId" value={productId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('Emplacement gauche')} htmlFor="stickerLeft">
              <Select id="stickerLeft" name="stickerLeft" defaultValue={left}>
                <option value="">{t('Aucun')}</option>
                {stickers.map((sticker) => (
                  <option key={sticker.id} value={sticker.id}>
                    {sticker.label}
                    {sticker.isActive ? '' : t(' (désactivé)')}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('Emplacement droit')} htmlFor="stickerRight">
              <Select id="stickerRight" name="stickerRight" defaultValue={right}>
                <option value="">{t('Aucun')}</option>
                {stickers.map((sticker) => (
                  <option key={sticker.id} value={sticker.id}>
                    {sticker.label}
                    {sticker.isActive ? '' : t(' (désactivé)')}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit" variant="outline" size="sm" loading={pending}>
            <Sparkles className="size-4" aria-hidden /> {t('Enregistrer les stickers')}
          </Button>
        </form>
      )}
    </div>
  );
}
