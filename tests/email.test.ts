import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { escapeHtml, orderEmail, passwordResetEmail, welcomeEmail, type OrderEmailData } from '@/lib/email-templates';
import { FINAL_SALE_NOTICE, OUTSIDE_DALOA_MAX_DAYS } from '@/lib/store-policy';
import { formatFCFA } from '@/lib/utils';
import { createOrder } from '@/lib/orders';
import { buildOrderEmail } from '@/lib/order-mail';
import type { CheckoutInput } from '@/lib/validation';
import { checkoutInput, createProduct, resetDb } from './helpers';

/**
 * E-mails transactionnels : modèles, fournisseur et branchement.
 *
 * Trois promesses sont vérifiées ici :
 *  1. le contenu d'un e-mail ne dit que la vérité de la commande (montants,
 *     articles, règles de retrait) et rien d'inventé ;
 *  2. aucune donnée client ne peut injecter de HTML dans le message ;
 *  3. la requête envoyée à Brevo (ou Resend) respecte exactement leur API —
 *     c'est ce qui fait la différence entre « configuré » et « ça marche ».
 */

const store = {
  name: 'Perokado',
  phone: '+225 07 00 00 00 00',
  whatsapp: '+225 07 00 00 00 00',
  email: 'contact@perokado.com',
  addressLine: 'Daloa, quartier Commerce',
  city: 'Daloa',
  dms: `6°53'04.4"N 6°26'50.9"W`,
  siteUrl: 'https://perokado.vercel.app',
};

function orderFixture(overrides: Partial<OrderEmailData> = {}): OrderEmailData {
  return {
    kind: 'created',
    number: 'CMD-2026-0042',
    link: 'https://perokado.vercel.app/commande/CMD-2026-0042?t=jeton-secret',
    createdAt: new Date('2026-11-07T09:30:00Z'),
    customerFirstName: 'Awa',
    customerName: 'Awa Koné',
    phone: '0701020304',
    city: 'Daloa',
    deliveryMethod: 'Livraison à domicile (Daloa)',
    paymentMethod: 'Wave (paiement mobile)',
    status: 'En attente de paiement',
    paymentStatus: 'Non payé',
    items: [
      { name: 'Ciment CPJ 35 — 50 kg', quantity: 2, unitPrice: '5500', lineTotal: '11000' },
      { name: 'Peinture blanche 5 L', quantity: 1, unitPrice: '12500', lineTotal: '12500' },
    ],
    subtotal: '23500',
    shippingFee: '0',
    discount: '0',
    total: '23500',
    store,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* Modèles                                                             */
/* ------------------------------------------------------------------ */

describe('modèles d’e-mails', () => {
  it('échappe le HTML des valeurs saisies par le client', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml(`L'atelier & "fils"`)).toBe('L&#39;atelier &amp; &quot;fils&quot;');
    expect(escapeHtml(null)).toBe('');
  });

  it('e-mail de bienvenue : nom, adresse et lien du compte', () => {
    const mail = welcomeEmail({ firstName: 'Awa', email: 'awa@example.com', store });
    expect(mail.subject).toContain('Perokado');
    expect(mail.text).toContain('Bonjour Awa,');
    expect(mail.text).toContain('awa@example.com');
    expect(mail.text).toContain('https://perokado.vercel.app/connexion');
    expect(mail.html).toContain('https://perokado.vercel.app/compte');
    expect(mail.html).toContain('#f2b705');
  });

  it('e-mail de bienvenue : formule neutre quand le prénom manque', () => {
    const mail = welcomeEmail({ firstName: null, email: 'anonyme@example.com', store });
    expect(mail.text.startsWith('Bonjour,')).toBe(true);
    expect(mail.text).not.toContain('Bonjour ,');
  });

  it('réinitialisation : lien, durée de validité et mise en garde', () => {
    const mail = passwordResetEmail({
      firstName: 'Awa',
      resetUrl: 'https://perokado.vercel.app/reinitialiser-mot-de-passe?token=abc',
      expiresInMinutes: 60,
      store,
    });
    expect(mail.text).toContain('Lien valable 60 minutes');
    expect(mail.text).toContain('reinitialiser-mot-de-passe?token=abc');
    expect(mail.html).toContain('reinitialiser-mot-de-passe?token=abc');
    expect(mail.text).toContain('ignorez ce message');
  });

  it('commande : numéro, articles, total et lien de suivi', () => {
    const mail = orderEmail(orderFixture());
    expect(mail.subject).toContain('CMD-2026-0042');
    expect(mail.subject).toContain('enregistrée');
    expect(mail.text).toContain('Ciment CPJ 35 — 50 kg');
    expect(mail.text).toContain(`2 × ${formatFCFA(5500)}`);
    expect(mail.text).toContain(formatFCFA(23500));
    expect(mail.text).toContain('?t=jeton-secret');
    expect(mail.html).toContain('?t=jeton-secret');
    expect(mail.html).toContain(formatFCFA(23500));
  });

  it('commande : les règles de la boutique sont rappelées', () => {
    const mail = orderEmail(orderFixture());
    expect(mail.text).toContain('Livraison à domicile à Daloa');
    expect(mail.text).toContain(`${OUTSIDE_DALOA_MAX_DAYS} jours`);
    // Le retrait en magasin n'est plus annoncé aux clients.
    expect(mail.text).not.toMatch(/retrait en boutique/i);
    expect(mail.text).toContain(FINAL_SALE_NOTICE);
    expect(mail.html).toContain('ni l’argent n’est rendu');
  });

  it('commande : livraison gratuite et remise omises quand elles sont nulles', () => {
    const { text } = orderEmail(orderFixture());
    expect(text).not.toContain('Livraison :');
    expect(text).not.toContain('Remise');
    const paid = orderEmail(orderFixture({ shippingFee: '1500', discount: '500', total: '24500' }));
    expect(paid.text).toContain(`Livraison : ${formatFCFA(1500)}`);
    expect(paid.text).toContain(`Remise : -${formatFCFA(500)}`);
  });

  it('bon : objet distinct de la confirmation, avec le même contenu', () => {
    const created = orderEmail(orderFixture({ kind: 'created' }));
    const receipt = orderEmail(orderFixture({ kind: 'receipt' }));
    expect(receipt.subject).toContain('bon de commande');
    expect(receipt.subject).not.toBe(created.subject);
    expect(receipt.html).toContain('justificatif');
    expect(receipt.text).toContain('Ciment CPJ 35 — 50 kg');
  });

  it('un nom de produit piégé ne peut pas injecter de HTML', () => {
    const mail = orderEmail(
      orderFixture({
        items: [{ name: '<script>fetch("//evil")</script>', quantity: 1, unitPrice: '1000', lineTotal: '1000' }],
      }),
    );
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    // La version texte reste brute : c'est du texte, pas du HTML.
    expect(mail.text).toContain('<script>');
  });

  it('aucune adresse de boutique inventée : une valeur absente disparaît', () => {
    const { html } = orderEmail(
      orderFixture({ store: { name: 'Perokado', siteUrl: 'https://perokado.vercel.app' } }),
    );
    expect(html).not.toContain('Téléphone :');
    expect(html).not.toContain('WhatsApp :');
    expect(html).toContain('Perokado');
  });
});

/* ------------------------------------------------------------------ */
/* Fournisseur                                                          */
/* ------------------------------------------------------------------ */

const savedEnv = { ...process.env };

afterEach(() => {
  process.env = { ...savedEnv };
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function loadEmailModule(vars: Record<string, string>) {
  for (const key of ['BREVO_API_KEY', 'RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_REPLY_TO']) delete process.env[key];
  for (const [key, value] of Object.entries(vars)) process.env[key] = value;
  vi.resetModules();
  return import('@/lib/email');
}

const payload = {
  to: 'client@example.com',
  subject: 'Perokado — commande PER-2026-0042',
  text: 'Bonjour, votre commande est enregistrée.',
  html: '<p>Bonjour</p>',
};

describe('envoi — Brevo', () => {
  it('appelle l’API Brevo avec expéditeur, HTML et adresse de réponse', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const { sendEmail, emailStatus } = await loadEmailModule({
      BREVO_API_KEY: 'xkeysib-test',
      EMAIL_FROM: 'Perokado <no-reply@perokado.com>',
      EMAIL_REPLY_TO: 'contact@perokado.com',
    });

    const status = emailStatus();
    expect(status.configured).toBe(true);
    expect(status.provider).toBe('brevo');

    const result = await sendEmail(payload);
    expect(result.sent).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init.headers as Record<string, string>)['api-key']).toBe('xkeysib-test');
    const body = JSON.parse(String(init.body));
    expect(body.sender).toEqual({ name: 'Perokado', email: 'no-reply@perokado.com' });
    expect(body.to).toEqual([{ email: 'client@example.com' }]);
    expect(body.subject).toBe(payload.subject);
    expect(body.textContent).toBe(payload.text);
    expect(body.htmlContent).toBe(payload.html);
    expect(body.replyTo).toEqual({ email: 'contact@perokado.com' });
  });

  it('remonte le code HTTP de Brevo sans lever', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 400 })));
    const { sendEmail } = await loadEmailModule({
      BREVO_API_KEY: 'xkeysib-test',
      EMAIL_FROM: 'Perokado <no-reply@perokado.com>',
    });
    const result = await sendEmail(payload);
    expect(result.sent).toBe(false);
    expect(result.error).toBe('Brevo HTTP 400');
  });

  it('ne contacte pas le fournisseur pour une adresse invalide', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { sendEmail } = await loadEmailModule({
      BREVO_API_KEY: 'xkeysib-test',
      EMAIL_FROM: 'Perokado <no-reply@perokado.com>',
    });
    const result = await sendEmail({ ...payload, to: 'pas-une-adresse' });
    expect(result.sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('envoi — Resend', () => {
  it('utilise l’API Resend quand seule cette clé est présente', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { sendEmail, emailStatus } = await loadEmailModule({
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'Perokado <no-reply@perokado.com>',
      EMAIL_REPLY_TO: 'contact@perokado.com',
    });

    expect(emailStatus().provider).toBe('resend');
    const result = await sendEmail(payload);
    expect(result.sent).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test');
    const body = JSON.parse(String(init.body));
    expect(body.from).toBe('Perokado <no-reply@perokado.com>');
    expect(body.to).toEqual(['client@example.com']);
    expect(body.html).toBe(payload.html);
    expect(body.reply_to).toBe('contact@perokado.com');
  });

  it('Brevo est prioritaire quand les deux clés existent', async () => {
    const { emailStatus } = await loadEmailModule({
      BREVO_API_KEY: 'xkeysib-test',
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'Perokado <no-reply@perokado.com>',
    });
    expect(emailStatus().provider).toBe('brevo');
  });
});

describe('état du service', () => {
  it('sans clé : non configuré, et l’interface le dit', async () => {
    const { emailStatus, sendEmail } = await loadEmailModule({});
    const status = emailStatus();
    expect(status.configured).toBe(false);
    expect(status.provider).toBeNull();
    expect(status.note).toContain('Aucun fournisseur');
    const result = await sendEmail(payload);
    expect(result.sent).toBe(false);
    expect(result.error).toContain('EMAIL_FROM');
  });

  it('clé sans expéditeur : toujours non configuré', async () => {
    const { emailStatus } = await loadEmailModule({ BREVO_API_KEY: 'xkeysib-test' });
    expect(emailStatus().configured).toBe(false);
  });

  it('filtre les adresses internes du personnel', async () => {
    const { isInternalAddress, isDeliverableAddress } = await loadEmailModule({
      BREVO_API_KEY: 'xkeysib-test',
      EMAIL_FROM: 'Perokado <no-reply@perokado.com>',
    });
    expect(isInternalAddress('agent.0701020304@agents.perokado.local')).toBe(true);
    expect(isInternalAddress('client@example.com')).toBe(false);
    expect(isDeliverableAddress('client@example.com')).toBe(true);
    expect(isDeliverableAddress('')).toBe(false);
  });

  it('la file n’envoie rien sans fournisseur configuré', async () => {
    await loadEmailModule({});
    vi.resetModules();
    const { shouldQueueEmail, queueEmail } = await import('@/lib/email-queue');
    expect(shouldQueueEmail('client@example.com')).toBe(false);
    expect(queueEmail({ to: 'client@example.com', subject: 'x', text: 'y' })).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Branchement dans l'application                                      */
/* ------------------------------------------------------------------ */

describe('branchement', () => {
  const read = (path: string) => readFileSync(path, 'utf8');

  it('l’inscription envoie l’e-mail de bienvenue', () => {
    const source = read('src/app/actions/auth.ts');
    expect(source).toContain('welcomeEmail(');
    expect(source).toContain('queueEmail({');
  });

  it('la commande envoie l’accusé de réception après la réponse', () => {
    const source = read('src/app/actions/checkout.ts');
    expect(source).toContain("buildOrderEmail(orderId, 'created')");
    expect(source).toContain('inBackground(');
    expect(source).toContain('emailStatus().configured');
  });

  it('le bon peut être renvoyé par e-mail depuis le suivi', () => {
    const page = read('src/app/(site)/commande/[number]/page.tsx');
    expect(page).toContain('EmailReceiptForm');
    expect(page).toContain('mail.configured');
    const action = read('src/app/actions/order-email.ts');
    expect(action).toContain("buildOrderEmail(order.id, 'receipt')");
    expect(action).toContain('rateLimit(');
    // Le jeton de suivi vaut autorisation, comme sur la page de confirmation.
    expect(action).toContain('order.accessToken');
  });
});

/* ------------------------------------------------------------------ */
/* Données réelles                                                     */
/* ------------------------------------------------------------------ */

describe('e-mail construit depuis la base', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('la confirmation reprend exactement la commande enregistrée', async () => {
    const product = await createProduct({ name: 'Marteau 500 g', price: '3500', stock: 10 });
    const { order } = await createOrder({
      input: checkoutInput({
        items: [{ productId: product.id, quantity: 3 }],
        deliveryMethod: 'LOCAL_DELIVERY',
        neighbourhood: 'Commerce',
        paymentMethod: 'WAVE',
      }) as unknown as CheckoutInput,
    });

    const built = await buildOrderEmail(order.id, 'created');
    expect(built).not.toBeNull();
    expect(built!.to).toBe('awa@example.ci');
    expect(built!.message.subject).toContain(order.number);
    expect(built!.message.text).toContain('Marteau 500 g');
    expect(built!.message.text).toContain(formatFCFA(order.total));
    expect(built!.message.text).toContain(`/commande/${order.number}?t=`);
    // Les règles de la boutique, pas une formulation libre.
    expect(built!.message.text).toContain(FINAL_SALE_NOTICE);
  });

  it('le bon demandé plus tard garde les montants d’origine', async () => {
    const product = await createProduct({ name: 'Peinture 5 L', price: '12500', stock: 5 });
    const { order } = await createOrder({
      input: checkoutInput({
        items: [{ productId: product.id, quantity: 2 }],
        deliveryMethod: 'LOCAL_DELIVERY',
        neighbourhood: 'Commerce',
        paymentMethod: 'WAVE',
        customerNote: 'Livrer avant midi',
      }) as unknown as CheckoutInput,
    });

    const receipt = await buildOrderEmail(order.id, 'receipt');
    expect(receipt!.message.subject).toContain('bon de commande');
    expect(receipt!.message.text).toContain(formatFCFA(25000));

    // Le prix change : un bon renvoyé ensuite ne réécrit pas l'histoire.
    await createProduct({ name: 'Peinture 5 L', price: '15000', stock: 5 });
    const again = await buildOrderEmail(order.id, 'receipt');
    expect(again!.message.text).toContain(formatFCFA(25000));
    expect(again!.message.text).not.toContain(formatFCFA(30000));
  });
});
