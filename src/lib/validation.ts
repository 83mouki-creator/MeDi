import { z } from 'zod';

/** Téléphone ivoirien : 10 chiffres (ex. 0701020304) ou format international +225… */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]/g, ''))
  .refine((v) => /^(?:\+?225)?\d{10}$/.test(v) || /^\d{8,15}$/.test(v), {
    message: 'Numéro de téléphone invalide (ex. 0701020304)',
  });

export const emailSchema = z.string().trim().toLowerCase().email('Adresse e-mail invalide');

export const passwordSchema = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caractères')
  .max(200, 'Mot de passe trop long')
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), {
    message: 'Le mot de passe doit contenir au moins une lettre et un chiffre',
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis'),
});

export const registerSchema = z.object({
  firstName: z.string().trim().min(2, 'Prénom requis').max(60),
  lastName: z.string().trim().min(2, 'Nom requis').max(60),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  acceptTerms: z.literal('on', { message: 'Vous devez accepter les conditions de vente' }),
});

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(999),
});

export const cartSchema = z.object({
  items: z.array(cartItemSchema).max(60),
});

export const checkoutSchema = z
  .object({
    firstName: z.string().trim().min(2, 'Prénom requis').max(60),
    lastName: z.string().trim().min(2, 'Nom requis').max(60),
    phone: phoneSchema,
    email: z.union([emailSchema, z.literal('')]).optional(),
    deliveryMethod: z.enum(['PICKUP', 'LOCAL_DELIVERY', 'CARRIER']),
    zoneId: z.string().optional(),
    city: z.string().trim().min(2, 'Ville requise').max(80),
    commune: z.string().trim().max(80).optional(),
    addressLine: z.string().trim().max(200).optional(),
    landmark: z.string().trim().max(200).optional(),
    carrier: z.string().trim().max(80).optional(),
    paymentMethod: z.enum(['WAVE', 'CASH_ON_DELIVERY', 'CASH_IN_STORE']),
    customerNote: z.string().trim().max(500).optional(),
    items: z.array(cartItemSchema).min(1, 'Votre panier est vide').max(60),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryMethod === 'LOCAL_DELIVERY') {
      if (!data.addressLine || data.addressLine.length < 5) {
        ctx.addIssue({ code: 'custom', path: ['addressLine'], message: 'Adresse de livraison requise' });
      }
    }
    if (data.deliveryMethod === 'CARRIER') {
      if (!data.addressLine || data.addressLine.length < 5) {
        ctx.addIssue({ code: 'custom', path: ['addressLine'], message: 'Adresse du destinataire requise' });
      }
      if (!data.commune) {
        ctx.addIssue({ code: 'custom', path: ['commune'], message: 'Commune ou quartier requis' });
      }
      if (!data.carrier) {
        ctx.addIssue({ code: 'custom', path: ['carrier'], message: 'Indiquez le transporteur souhaité' });
      }
    }
  });

export const adminProductSchema = z.object({
  name: z.string().trim().min(3, 'Nom trop court').max(160),
  sku: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[A-Za-z0-9._-]+$/, 'Référence : lettres, chiffres, point, tiret'),
  slug: z.string().trim().max(80).optional(),
  shortDescription: z.string().trim().max(300).optional(),
  description: z.string().trim().max(8000).optional(),
  price: z.coerce.number().int('Prix entier en FCFA').min(1, 'Prix requis').max(100_000_000),
  promoPrice: z.coerce.number().int().min(0).max(100_000_000).optional().nullable(),
  promoStartsAt: z.string().optional().nullable(),
  promoEndsAt: z.string().optional().nullable(),
  stock: z.coerce.number().int().min(0, 'Stock négatif interdit').max(1_000_000),
  lowStockThreshold: z.coerce.number().int().min(0).max(10_000).optional().nullable(),
  allowPreorder: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  categoryId: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  warranty: z.string().trim().max(120).optional(),
  keywords: z.string().trim().max(500).optional(),
  attributes: z.array(z.object({ name: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(200) })).max(40).optional(),
});

export const reviewPaymentSchema = z.object({
  paymentId: z.string().min(1),
  decision: z.enum(['CONFIRM', 'REJECT']),
  note: z.string().trim().max(500).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Transforme les erreurs zod en dictionnaire champ → message lisible. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
