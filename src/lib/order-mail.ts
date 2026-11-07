import { env } from './env';
import { deliveryMethodLabels, paymentMethodLabels, type DeliveryMethod, type PaymentMethod } from './delivery';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus } from './order-status';
import { orderEmail, type EmailMessage } from './email-templates';
import { storeEmailInfo } from './email-store';
import { getOrderDetails, orderTotals } from './orders';
import { getStoreSettings } from './settings';

/**
 * Fabrication des e-mails de commande à partir de la base — jamais du
 * formulaire du navigateur. Les montants, les articles et les libellés sont
 * ceux enregistrés au moment de la commande (instantanés), donc un e-mail
 * renvoyé trois semaines plus tard dit exactement la même chose.
 */

/** Lien de suivi sécurisé : contient le jeton d'accès de la commande. */
export function orderAccessLink(order: { number: string; accessToken: string }): string {
  return `${env.appUrl.replace(/\/$/, '')}/commande/${order.number}?t=${encodeURIComponent(order.accessToken)}`;
}

export type BuiltOrderEmail = { to: string | null; message: EmailMessage };

/**
 * Construit l'e-mail d'une commande.
 *
 * `created`  → accusé de réception envoyé automatiquement après la commande.
 * `receipt`  → bon / justificatif, envoyé à la demande du client.
 */
export async function buildOrderEmail(orderId: string, kind: 'created' | 'receipt'): Promise<BuiltOrderEmail | null> {
  const details = await getOrderDetails(orderId);
  if (!details) return null;
  const { order, items } = details;
  const settings = await getStoreSettings();
  const totals = orderTotals(order);

  const message = orderEmail({
    kind,
    number: order.number,
    link: orderAccessLink(order),
    createdAt: order.createdAt,
    customerFirstName: order.customerFirstName,
    customerName: `${order.customerFirstName} ${order.customerLastName}`.trim(),
    phone: order.phone,
    city: order.city,
    deliveryMethod: deliveryMethodLabels[order.deliveryMethod as DeliveryMethod] ?? order.deliveryMethod,
    paymentMethod: paymentMethodLabels[order.paymentMethod as PaymentMethod] ?? order.paymentMethod,
    status: ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status,
    paymentStatus: PAYMENT_STATUS_LABELS[order.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS] ?? order.paymentStatus,
    items: items.map((item) => ({
      name: item.nameSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    subtotal: totals.subtotal,
    shippingFee: totals.shippingFee,
    discount: totals.discount,
    total: totals.total,
    store: storeEmailInfo(settings),
  });

  return { to: order.email, message };
}

export { storeEmailInfo };
