'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { inventoryMovements, products } from '@/db/schema';
import { clientIpFrom, requirePermission } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { newId } from '@/lib/utils';
import { refreshStorefront } from '@/lib/revalidate';

export type GlobalStockState = { error?: string; success?: string; skipped?: number };

/**
 * Ajout ou retrait de pièces sur TOUT le stock en une seule fois.
 *
 * Utilisation réelle en quincaillerie : « le fournisseur nous a livré 5 pièces
 * de chaque référence » ou « inventaire : on retire 1 pièce partout ». Chaque
 * produit touché garde sa propre ligne de mouvement, donc rien n'est anonyme ;
 * les produits qui deviendraient négatifs (ou passeraient sous les unités déjà
 * réservées) sont simplement écartés et signalés.
 */
export async function adjustAllStockAction(_prev: GlobalStockState, formData: FormData): Promise<GlobalStockState> {
  let actor;
  try {
    actor = await requirePermission('stock.write');
  } catch {
    return { error: 'Action non autorisée pour votre rôle.' };
  }

  const raw = Number(formData.get('quantity') ?? 0);
  const sign = formData.get('sign') === 'remove' ? -1 : 1;
  const quantity = Math.trunc(Math.abs(raw)) * sign;
  const reason = String(formData.get('reason') ?? '').trim();

  if (!Number.isFinite(raw) || quantity === 0) return { error: 'Indiquez un nombre de pièces supérieur à zéro.' };
  if (Math.abs(quantity) > 10_000) return { error: 'Quantité trop grande pour un ajustement global.' };
  if (reason.length < 3) return { error: 'Un motif est requis pour tracer le mouvement.' };

  const ip = clientIpFrom(await headers());
  let updated = 0;
  let skipped = 0;

  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: products.id, stock: products.stock, reserved: products.reserved })
      .from(products)
      .where(sql`${products.isArchived} = false`)
      .for('update');

    for (const row of rows) {
      const next = row.stock + quantity;
      if (next < 0 || next < row.reserved) {
        skipped += 1;
        continue;
      }
      await tx.update(products).set({ stock: next, updatedAt: new Date() }).where(sql`${products.id} = ${row.id}`);
      await tx.insert(inventoryMovements).values({
        id: newId('mov_'),
        productId: row.id,
        type: quantity > 0 ? 'RESTOCK' : 'ADJUSTMENT',
        quantity,
        stockAfter: next,
        reservedAfter: row.reserved,
        reason: `Stock global : ${reason}`,
        userId: actor.id,
      });
      updated += 1;
    }
  });

  await audit(actor, {
    action: 'stock.adjusted_all',
    entity: 'product',
    entityId: 'all',
    metadata: { quantity, reason, updated, skipped },
    ip,
  });

  revalidatePath('/admin/stock');
  refreshStorefront();

  const prefix = quantity > 0 ? '+' : '';
  return {
    success:
      `${prefix}${quantity} pièce(s) appliqué(s) à ${updated} produit(s).` +
      (skipped > 0 ? ` ${skipped} produit(s) ignoré(s) : stock insuffisant.` : ''),
    skipped,
  };
}
