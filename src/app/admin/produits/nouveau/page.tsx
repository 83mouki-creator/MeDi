import { asc } from 'drizzle-orm';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { db } from '@/db';
import { categories, brands, suppliers } from '@/db/schema';
import { ProductForm } from '@/components/admin/product-form';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const { t } = await getAdminI18n();
  const [categoryRows, brandRows, supplierRows] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.position)),
    db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name)),
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).orderBy(asc(suppliers.name)),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">{t('Nouveau produit')}</h1>
        <p className="text-sm text-navy-600">
          {t('La référence (SKU) et le prix sont obligatoires. Le produit n’est visible qu’une fois « visible dans la boutique » coché.')}
        </p>
      </header>
      <ProductForm categories={categoryRows} brands={brandRows} suppliers={supplierRows} attributes={[]} />
    </div>
  );
}
