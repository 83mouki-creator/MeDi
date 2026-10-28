import { beforeEach, describe, expect, it } from 'vitest';
import { getCartSummary } from '@/lib/cart';
import { createOrder, OrderError } from '@/lib/orders';
import type { CheckoutInput } from '@/lib/validation';
import { resetDb, createProduct, createUser, productState, checkoutInput } from './helpers';

let zones: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  zones = await resetDb();
});

describe('panier : recalcul serveur', () => {
  it('calcule le total à partir du prix en base, jamais du client', async () => {
    const product = await createProduct({ name: 'Ciment CEM II 50 kg', price: '4800', stock: 30 });
    const summary = await getCartSummary([
      { productId: product.id, quantity: 3 },
      // Un prix falsifié fourni par le navigateur n'entre pas dans le calcul.
      { productId: product.id, quantity: -5 },
    ]);

    // 3 + (-5) : la quantité négative est écartée, la ligne positive est conservée.
    expect(summary.itemCount).toBe(3);
    expect(summary.lines).toHaveLength(1);
    expect(summary.lines[0]!.unitPrice).toBe(4800);
    expect(summary.subtotal).toBe(14_400);
  });

  it('applique le prix promotionnel actif', async () => {
    const product = await createProduct({
      name: 'Meuleuse 125 mm',
      price: '30000',
      promoPrice: '24000',
      promoStartsAt: new Date(Date.now() - 3600_000),
      stock: 5,
    });

    const summary = await getCartSummary([{ productId: product.id, quantity: 2 }]);
    expect(summary.lines[0]!.unitPrice).toBe(24000);
    expect(summary.lines[0]!.onPromo).toBe(true);
    expect(summary.subtotal).toBe(48_000);
  });

  it('signale un produit épuisé ou en quantité insuffisante', async () => {
    const product = await createProduct({ name: 'Fil de fer galvanisé', price: '2500', stock: 2 });
    const tooMuch = await getCartSummary([{ productId: product.id, quantity: 5 }]);

    expect(tooMuch.lines[0]!.available).toBe(2);
    expect(tooMuch.lines[0]!.quantity).toBe(2);
    expect(tooMuch.lines[0]!.issue).toBeTruthy();
    expect(tooMuch.hasIssues).toBe(true);
  });

  it('ignore un produit supprimé du catalogue', async () => {
    const product = await createProduct({ name: 'Produit retiré', stock: 4, isArchived: true });
    const summary = await getCartSummary([{ productId: product.id, quantity: 1 }]);
    expect(summary.lines).toHaveLength(0);
  });
});

describe('commande : contrôle du stock', () => {
  it('refuse une quantité supérieure au stock disponible', async () => {
    const product = await createProduct({ name: 'Perceuse 700 W', price: '35000', stock: 2 });
    const input = checkoutInput({
      items: [{ productId: product.id, quantity: 3 }],
      deliveryMethod: 'PICKUP',
      paymentMethod: 'CASH_IN_STORE',
    }) as unknown as CheckoutInput;

    await expect(createOrder({ input })).rejects.toMatchObject({ code: 'STOCK' });
    expect(await productState(product.id)).toMatchObject({ stock: 2, reserved: 0 });
  });

  it('refuse un produit épuisé, sauf précommande', async () => {
    const outOfStock = await createProduct({ name: 'Groupe électrogène', price: '250000', stock: 0 });
    const input = checkoutInput({
      items: [{ productId: outOfStock.id, quantity: 1 }],
      deliveryMethod: 'PICKUP',
      paymentMethod: 'CASH_IN_STORE',
    }) as unknown as CheckoutInput;

    await expect(createOrder({ input })).rejects.toMatchObject({ code: 'STOCK' });

    const preorder = await createProduct({ name: 'Compresseur sur commande', price: '180000', stock: 0, allowPreorder: true });
    const result = await createOrder({
      input: checkoutInput({
        items: [{ productId: preorder.id, quantity: 1 }],
        deliveryMethod: 'PICKUP',
        paymentMethod: 'CASH_IN_STORE',
      }) as unknown as CheckoutInput,
    });
    expect(result.order.number).toMatch(/^MED-\d{4}-\d{5}$/);
  });

  it('réserve le stock et refuse la double vente de la dernière unité (concurrence)', async () => {
    const product = await createProduct({ name: 'Dernière scie sauteuse', price: '42000', stock: 1 });

    const makeInput = () =>
      checkoutInput({
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'PICKUP',
        paymentMethod: 'CASH_IN_STORE',
        phone: '0701020304',
      }) as unknown as CheckoutInput;

    const results = await Promise.allSettled([createOrder({ input: makeInput() }), createOrder({ input: makeInput() })]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(OrderError);
    expect((rejected[0]!.reason as OrderError).code).toBe('STOCK');

    expect(await productState(product.id)).toMatchObject({ stock: 1, reserved: 1 });
  });

  it('ne permet pas de dépasser le stock avec deux commandes parallèles de quantités partielles', async () => {
    const product = await createProduct({ name: 'Câble électrique 2,5 mm²', price: '9000', stock: 3 });

    const order = (qty: number) =>
      createOrder({
        input: checkoutInput({
          items: [{ productId: product.id, quantity: qty }],
          deliveryMethod: 'PICKUP',
          paymentMethod: 'CASH_IN_STORE',
        }) as unknown as CheckoutInput,
      });

    const results = await Promise.allSettled([order(2), order(2)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await productState(product.id)).reserved).toBe(2);
  });

  it('associe la commande au compte connecté', async () => {
    const user = await createUser();
    const product = await createProduct({ stock: 5, price: '15000' });
    const result = await createOrder({
      input: checkoutInput({
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'PICKUP',
        paymentMethod: 'CASH_IN_STORE',
      }) as unknown as CheckoutInput,
      userId: user.id,
    });

    expect(result.order.userId).toBe(user.id);
    expect(result.order.accessToken).toMatch(/^tok_/);
  });
});
