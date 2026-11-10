'use client';

import { useActionState, useState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import {
  assignStickerAction,
  deleteStickerAction,
  saveStickerAction,
  toggleStickerAction,
  type StickerState,
} from '@/app/actions/admin-stickers';
import { useAdminI18n } from '@/components/admin/admin-i18n';
import { ProductSticker } from '@/components/product-sticker';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select } from '@/components/ui/form';
import { Alert, Card } from '@/components/ui/primitives';
import {
  MAX_STICKERS_PER_PRODUCT,
  STICKER_ICON_LABELS,
  STICKER_ICONS,
  STICKER_TONE_LABELS,
  STICKER_TONES,
  type StickerRecord,
  type StickerView,
} from '@/lib/sticker-constants';

type ProductOption = { id: string; name: string; sku: string };

const initial: StickerState = {};

/**
 * Création / édition d'un sticker.
 *
 * Le formulaire est volontairement court : un texte court, une couleur, un
 * symbole, et éventuellement une période. L'aperçu à droite montre exactement
 * ce que le client verra sur la photo du produit.
 */
export function StickerForm({ sticker }: { sticker?: StickerRecord }) {
  const { t } = useAdminI18n();
  const [state, formAction, pending] = useActionState(saveStickerAction, initial);

  const [label, setLabel] = useState(sticker?.label ?? '');
  const [detail, setDetail] = useState(sticker?.detail ?? '');
  const [tone, setTone] = useState(sticker?.tone ?? 'GOLD');
  const [icon, setIcon] = useState(sticker?.icon ?? 'shield');

  const preview: StickerView = {
    id: 'preview',
    label: label || t('Garantie 12 mois'),
    detail: detail || null,
    tone,
    icon,
    position: 0,
  };

  return (
    <form action={formAction} className="space-y-3">
      {sticker ? <input type="hidden" name="id" value={sticker.id} /> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t('Texte affiché sur la photo')}
          htmlFor="label"
          required
          hint={t('Court et concret : « Garantie 12 mois », « -20 % cette semaine ».')}
        >
          <Input
            id="label"
            name="label"
            required
            maxLength={40}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t('Garantie 12 mois')}
          />
        </Field>
        <Field label={t('Précision (facultatif)')} htmlFor="detail" hint={t('Deuxième ligne plus petite, ex. « pièces et main-d’œuvre ».')}>
          <Input
            id="detail"
            name="detail"
            maxLength={60}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder={t('Pièces et main-d’œuvre')}
          />
        </Field>
        <Field label={t('Couleur')} htmlFor="tone">
          <Select id="tone" name="tone" value={tone} onChange={(event) => setTone(event.target.value as StickerView['tone'])}>
            {STICKER_TONES.map((value) => (
              <option key={value} value={value}>
                {STICKER_TONE_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('Symbole')} htmlFor="icon">
          <Select
            id="icon"
            name="icon"
            value={icon}
            onChange={(event) => setIcon(event.target.value as StickerView['icon'])}
          >
            {STICKER_ICONS.map((value) => (
              <option key={value} value={value}>
                {STICKER_ICON_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('Du (facultatif)')} htmlFor="startsAt" hint={t('Vide = tout de suite.')}>
          <Input
            id="startsAt"
            name="startsAt"
            type="date"
            defaultValue={sticker?.startsAt ? sticker.startsAt.toISOString().slice(0, 10) : ''}
          />
        </Field>
        <Field label={t('Au (facultatif)')} htmlFor="endsAt" hint={t('Vide = sans date de fin.')}>
          <Input
            id="endsAt"
            name="endsAt"
            type="date"
            defaultValue={sticker?.endsAt ? sticker.endsAt.toISOString().slice(0, 10) : ''}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="isActive" defaultChecked={sticker?.isActive ?? true} />
          {t('Afficher ce sticker sur les produits')}
        </label>
        <Button type="submit" loading={pending}>
          <Sparkles className="size-4" aria-hidden />
          {sticker ? t('Enregistrer les modifications') : t('Créer le sticker')}
        </Button>
      </div>

      <div className="rounded-lg border border-dashed border-navy-200 bg-navy-50 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-500">{t('Aperçu sur la photo d’un produit')}</p>
        <div className="flex h-24 w-40 items-center justify-center rounded-lg bg-white ring-1 ring-navy-100">
          <ProductSticker sticker={preview} />
        </div>
      </div>
    </form>
  );
}

/**
 * Affectation d'un sticker à des produits.
 *
 * Trois portées, dans l'ordre de simplicité voulu par la boutique :
 * « tous les produits » (une case à cocher et c'est fini), « les produits d'une
 * recherche », ou un choix manuel dans la liste.
 */
export function StickerAssignForm({
  stickers,
  products,
}: {
  stickers: StickerRecord[];
  products: ProductOption[];
}) {
  const { t } = useAdminI18n();
  const [state, formAction, pending] = useActionState(assignStickerAction, initial);
  const [scope, setScope] = useState<'all' | 'selection' | 'search'>('selection');
  const [query, setQuery] = useState('');

  const matching = query.trim()
    ? products.filter((product) =>
        `${product.name} ${product.sku}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : products;

  if (stickers.length === 0) {
    return (
      <p className="text-sm text-navy-500">
        {t('Créez d’abord un sticker : il apparaîtra ensuite ici pour être affecté aux produits.')}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('Sticker à appliquer')} htmlFor="stickerId" required>
          <Select id="stickerId" name="stickerId" required>
            {stickers.map((sticker) => (
              <option key={sticker.id} value={sticker.id}>
                {sticker.label}
                {sticker.isActive ? '' : t(' (désactivé)')}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('Sur quels produits ?')} htmlFor="scope" required>
          <Select
            id="scope"
            name="scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as 'all' | 'selection' | 'search')}
          >
            <option value="all">{t('Tous les produits du catalogue')}</option>
            <option value="selection">{t('Les produits que je coche')}</option>
            <option value="search">{t('Les produits d’une recherche')}</option>
          </Select>
        </Field>
        <Field label={t('Comportement')} htmlFor="mode" hint={t('Deux stickers maximum par produit.')}>
          <Select id="mode" name="mode" defaultValue="add">
            <option value="add">{t('Ajouter (sans dépasser deux)')}</option>
            <option value="replace">{t('Remplacer les stickers existants')}</option>
          </Select>
        </Field>
        {scope === 'search' ? (
          <Field label={t('Recherche (nom ou référence)')} htmlFor="query" hint={t('Applique à tous les produits trouvés.')}>
            <Input
              id="query"
              name="query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('perceuse')}
            />
          </Field>
        ) : null}
      </div>

      {scope === 'selection' ? (
        <div className="rounded-lg border border-navy-200">
          <div className="border-b border-navy-100 p-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('Filtrer la liste des produits…')}
              aria-label={t('Filtrer la liste des produits')}
            />
          </div>
          {matching.length === 0 ? (
            <p className="p-3 text-sm text-navy-500">{t('Aucun produit ne correspond à cette recherche.')}</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto p-2">
              {matching.map((product) => (
                <li key={product.id}>
                  <label className="flex items-center gap-2 rounded px-1.5 py-1.5 text-sm hover:bg-navy-50">
                    <Checkbox name="productIds" value={product.id} />
                    <span className="min-w-0 flex-1 truncate">{product.name}</span>
                    <span className="shrink-0 font-mono text-xs text-navy-400">{product.sku}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {t('Appliquer le sticker')}
        </Button>
        <p className="text-xs text-navy-500">
          {t('Un produit porte au plus {max} stickers, un à gauche de la photo et un à droite.', {
            max: MAX_STICKERS_PER_PRODUCT,
          })}
        </p>
      </div>
    </form>
  );
}

/** Liste des stickers existants, avec activation et suppression. */
export function StickerList({ stickers }: { stickers: StickerRecord[] }) {
  const { t } = useAdminI18n();

  if (stickers.length === 0) {
    return (
      <p className="text-sm text-navy-500">
        {t('Aucun sticker pour le moment. Créez-en un : « Garantie 12 mois » ou « -20 % » par exemple.')}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {stickers.map((sticker) => (
        <li key={sticker.id} className="rounded-lg border border-navy-100 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <ProductSticker
                sticker={{
                  id: sticker.id,
                  label: sticker.label,
                  detail: sticker.detail,
                  tone: sticker.tone,
                  icon: sticker.icon,
                  position: 0,
                }}
              />
              <p className="mt-2 text-xs text-navy-500">
                {sticker.productCount === 0
                  ? t('Affecté à aucun produit')
                  : t('Affecté à {count} produit(s)', { count: sticker.productCount })}
                {sticker.startsAt || sticker.endsAt
                  ? ` · ${t('du')} ${sticker.startsAt ? sticker.startsAt.toLocaleDateString('fr-FR') : '…'} ${t('au')} ${
                      sticker.endsAt ? sticker.endsAt.toLocaleDateString('fr-FR') : '…'
                    }`
                  : ''}
                {sticker.isActive ? '' : ` · ${t('désactivé')}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <form action={toggleStickerAction}>
                <input type="hidden" name="id" value={sticker.id} />
                <Button type="submit" variant="outline" size="sm">
                  {sticker.isActive ? t('Désactiver') : t('Activer')}
                </Button>
              </form>
              <form action={deleteStickerAction}>
                <input type="hidden" name="id" value={sticker.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="text-danger-500 hover:bg-rose-50"
                  aria-label={t('Supprimer {label}', { label: sticker.label })}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </form>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Rappel affiché en haut de page. */
export function StickerIntro() {
  const { t } = useAdminI18n();
  return (
    <Card className="p-4 text-sm text-navy-700">
      <p>
        {t('Un sticker est une vignette affichée sur la photo du produit : garantie, réduction, livraison offerte… Chaque produit en porte au maximum {max} : le premier en bas à gauche, le second en bas à droite.', {
          max: MAX_STICKERS_PER_PRODUCT,
        })}
      </p>
    </Card>
  );
}
