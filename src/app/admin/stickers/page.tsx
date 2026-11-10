import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { products } from '@/db/schema';
import { requirePagePermission } from '@/lib/auth';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { listStickers } from '@/lib/stickers';
import { Card } from '@/components/ui/primitives';
import { StickerAssignForm, StickerForm, StickerIntro, StickerList } from '@/components/admin/sticker-forms';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Stickers produits — Perokado' };

/**
 * Administration des stickers produits.
 *
 * Deux gestes seulement, dans cet ordre :
 *   1. créer une vignette réutilisable (texte + couleur + symbole) ;
 *   2. l'affecter à tous les produits, à une recherche, ou à une sélection.
 *
 * Le produit peut aussi recevoir ses deux stickers depuis sa propre fiche.
 */
export default async function AdminStickersPage() {
  await requirePagePermission('products.write');
  const { t } = await getAdminI18n();

  const [stickerRows, productRows] = await Promise.all([
    listStickers(false).catch(() => []),
    db
      .select({ id: products.id, name: products.name, sku: products.sku })
      .from(products)
      .where(eq(products.isArchived, false))
      .orderBy(asc(products.name))
      .limit(500)
      .catch(() => []),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">{t('Stickers des produits')}</h1>
        <p className="mt-1 text-sm text-navy-600">
          {t('Garantie, réduction, livraison offerte : dites-le directement sur la photo, sans retoucher le produit.')}
        </p>
      </header>

      <StickerIntro />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-bold">{t('Appliquer un sticker')}</h2>
            <StickerAssignForm stickers={stickerRows} products={productRows} />
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-bold">{t('Stickers existants')}</h2>
            <StickerList stickers={stickerRows} />
          </Card>
        </div>

        <Card className="h-fit p-4">
          <h2 className="mb-3 text-sm font-bold">{t('Nouveau sticker')}</h2>
          <StickerForm />
        </Card>
      </div>
    </div>
  );
}
