import { formatFCFA } from './utils';
import { FINAL_SALE_NOTICE, OUTSIDE_DALOA_MAX_DAYS, PICKUP_HOLD_HOURS } from './store-policy';

/**
 * Modèles d'e-mails transactionnels.
 *
 * Règle de la maison : **aucune donnée inventée**. Tout ce qui s'affiche vient
 * de la commande, des réglages de la boutique ou des règles de vente
 * (`store-policy`). Si une information manque (téléphone, adresse), la ligne
 * disparaît au lieu d'afficher un texte de remplissage.
 *
 * Chaque modèle retourne les deux versions : `text` (lisible par tous les
 * clients, y compris les montres) et `html` (mise en page aux couleurs de la
 * boutique). Aucune image distante : les e-mails ne dépendent d'aucun serveur
 * pour s'afficher, donc ils ne partent pas en spam pour cause d'images.
 */

const NAVY = '#0b2545';
const NAVY_SOFT = '#1c3a63';
const YELLOW = '#f2b705';
const PAPER = '#f6f7f9';
const INK = '#1f2937';
const MUTED = '#5b6b82';

export type EmailMessage = { subject: string; text: string; html: string };

/** Coordonnées de la boutique telles qu'elles apparaissent en pied d'e-mail. */
export type StoreEmailInfo = {
  name: string;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  addressLine?: string | null;
  city?: string | null;
  /** Coordonnées GPS au format Google Maps (ex. 6°53'04.4"N 6°26'50.9"W). */
  dms?: string | null;
  siteUrl: string;
};

/** Échappe le texte inséré dans le HTML (nom de produit, adresse, notes…). */
export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function footerLines(store: StoreEmailInfo): string[] {
  const lines: string[] = [];
  if (store.addressLine) lines.push(store.addressLine);
  else if (store.city) lines.push(store.city);
  else if (store.dms) lines.push(store.dms);
  if (store.addressLine && store.dms) lines.push(store.dms);
  if (store.phone) lines.push(`Téléphone : ${store.phone}`);
  if (store.whatsapp) lines.push(`WhatsApp : ${store.whatsapp}`);
  if (store.email) lines.push(`E-mail : ${store.email}`);
  lines.push(store.siteUrl);
  return lines;
}

type LayoutOptions = {
  title: string;
  /** Première phrase lue dans la boîte de réception (masquée dans l'e-mail). */
  preheader: string;
  bodyHtml: string;
  store: StoreEmailInfo;
};

function layout({ title, preheader, bodyHtml, store }: LayoutOptions): string {
  const footer = footerLines(store)
    .map((line) => `<div style="margin:2px 0;">${escapeHtml(line)}</div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e3e7ee;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
        <tr>
          <td style="background:${NAVY};padding:20px 24px;">
            <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:.2px;">${escapeHtml(store.name)}</div>
            <div style="height:4px;width:56px;background:${YELLOW};border-radius:2px;margin-top:10px;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;color:${INK};font-size:15px;line-height:1.55;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="background:#f0f3f8;padding:18px 24px;color:${MUTED};font-size:12px;line-height:1.5;">
            ${footer}
          </td>
        </tr>
      </table>
      <div style="max-width:600px;color:#98a3b5;font-size:11px;margin-top:12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
        ${escapeHtml(store.name)} — message automatique, merci de ne pas y répondre directement.
      </div>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr>
    <td style="background:${YELLOW};border-radius:10px;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 22px;font-weight:700;color:${NAVY};text-decoration:none;font-size:15px;">${escapeHtml(label)}</a>
    </td>
  </tr></table>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;">${escapeHtml(text)}</p>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:${MUTED};font-size:13px;width:45%;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;color:${INK};font-size:13px;font-weight:600;vertical-align:top;">${escapeHtml(value)}</td>
  </tr>`;
}

function noticeBox(text: string): string {
  return `<div style="margin:18px 0 0;padding:12px 14px;background:#fff8e1;border-left:4px solid ${YELLOW};border-radius:6px;color:${NAVY_SOFT};font-size:13px;line-height:1.5;">${escapeHtml(text)}</div>`;
}

/* ------------------------------------------------------------------ */
/* Bienvenue                                                           */
/* ------------------------------------------------------------------ */

export function welcomeEmail(input: {
  firstName: string | null | undefined;
  email: string;
  store: StoreEmailInfo;
}): EmailMessage {
  const { store } = input;
  const hello = input.firstName?.trim() ? `Bonjour ${input.firstName.trim()},` : 'Bonjour,';

  const subject = `${store.name} — votre compte est créé`;
  const text = [
    hello,
    '',
    `Votre compte ${store.name} est actif, avec l’adresse ${input.email}.`,
    '',
    'Ce que vous pouvez faire dès maintenant :',
    '• suivre vos commandes et retrouver vos bons ;',
    '• enregistrer vos adresses de livraison à Daloa ;',
    '• changer votre mot de passe à tout moment.',
    '',
    'Commander sans compte reste possible : le compte sert seulement à garder l’historique.',
    '',
    `Se connecter : ${store.siteUrl}/connexion`,
    '',
    ...footerLines(store),
  ].join('\n');

  const html = layout({
    title: subject,
    preheader: 'Votre compte est actif : suivez vos commandes et vos bons.',
    store,
    bodyHtml: [
      `<p style="margin:0 0 14px;font-size:16px;font-weight:700;color:${NAVY};">Bienvenue chez ${escapeHtml(store.name)}</p>`,
      paragraph(hello),
      paragraph(
        `Votre compte est actif avec l’adresse ${input.email}. Vous pouvez désormais suivre vos commandes, retrouver vos bons et enregistrer vos adresses de livraison.`,
      ),
      button(`${store.siteUrl}/compte`, 'Ouvrir mon compte'),
      noticeBox('Commander sans compte reste possible : le compte sert à garder l’historique et vos adresses.'),
    ].join(''),
  });

  return { subject, text, html };
}

/* ------------------------------------------------------------------ */
/* Réinitialisation de mot de passe                                    */
/* ------------------------------------------------------------------ */

export function passwordResetEmail(input: {
  firstName: string | null | undefined;
  resetUrl: string;
  expiresInMinutes?: number;
  store: StoreEmailInfo;
}): EmailMessage {
  const { store } = input;
  const minutes = input.expiresInMinutes ?? 60;
  const hello = input.firstName?.trim() ? `Bonjour ${input.firstName.trim()},` : 'Bonjour,';

  const subject = `${store.name} — réinitialisation de votre mot de passe`;
  const text = [
    hello,
    '',
    `${store.name} : réinitialisation de votre mot de passe.`,
    `Lien valable ${minutes} minutes, à usage unique :`,
    input.resetUrl,
    '',
    'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.',
    '',
    ...footerLines(store),
  ].join('\n');

  const html = layout({
    title: subject,
    preheader: `Lien valable ${minutes} minutes pour choisir un nouveau mot de passe.`,
    store,
    bodyHtml: [
      paragraph(hello),
      paragraph('Une réinitialisation de votre mot de passe a été demandée pour ce compte.'),
      button(input.resetUrl, 'Choisir un nouveau mot de passe'),
      `<p style="margin:0 0 14px;color:${MUTED};font-size:13px;">Lien valable ${minutes} minutes, à usage unique.</p>`,
      noticeBox('Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.'),
    ].join(''),
  });

  return { subject, text, html };
}

/* ------------------------------------------------------------------ */
/* Commande : confirmation et bon                                       */
/* ------------------------------------------------------------------ */

export type OrderEmailLine = {
  name: string;
  quantity: number;
  unitPrice: string | number;
  lineTotal: string | number;
};

export type OrderEmailData = {
  /** `created` = accusé de réception ; `receipt` = bon / justificatif demandé. */
  kind: 'created' | 'receipt';
  number: string;
  /** Lien de suivi sécurisé (contient le jeton de la commande). */
  link: string;
  createdAt: Date;
  customerFirstName: string | null | undefined;
  customerName: string;
  phone: string;
  city: string;
  deliveryMethod: string;
  paymentMethod: string;
  status: string;
  paymentStatus: string;
  items: OrderEmailLine[];
  subtotal: string | number;
  shippingFee: string | number;
  discount: string | number;
  total: string | number;
  store: StoreEmailInfo;
};

function frDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Abidjan',
  }).format(date);
}

export function orderEmail(data: OrderEmailData): EmailMessage {
  const { store } = data;
  const hello = data.customerFirstName?.trim() ? `Bonjour ${data.customerFirstName.trim()},` : 'Bonjour,';
  const created = data.kind === 'created';
  const subject = created
    ? `${store.name} — commande ${data.number} enregistrée`
    : `${store.name} — votre bon de commande ${data.number}`;

  const linesText = data.items
    .map((item) => `• ${item.name} — ${item.quantity} × ${formatFCFA(item.unitPrice)} = ${formatFCFA(item.lineTotal)}`)
    .join('\n');

  const totalsText = [
    `Sous-total : ${formatFCFA(data.subtotal)}`,
    Number(data.shippingFee) > 0 ? `Livraison : ${formatFCFA(data.shippingFee)}` : null,
    Number(data.discount) > 0 ? `Remise : -${formatFCFA(data.discount)}` : null,
    `TOTAL : ${formatFCFA(data.total)}`,
  ]
    .filter(Boolean)
    .join('\n');

  const text = [
    hello,
    '',
    created
      ? `Votre commande ${data.number} a bien été enregistrée le ${frDate(data.createdAt)}.`
      : `Voici le bon de votre commande ${data.number} du ${frDate(data.createdAt)}.`,
    '',
    `État : ${data.status} · Paiement : ${data.paymentStatus}`,
    '',
    'Articles :',
    linesText,
    '',
    totalsText,
    '',
    `Retrait / livraison : ${data.deliveryMethod}`,
    `Paiement choisi : ${data.paymentMethod}`,
    `Téléphone : ${data.phone} · Ville : ${data.city}`,
    '',
    `Suivre la commande : ${data.link}`,
    '',
    `Retrait en boutique sous ${PICKUP_HOLD_HOURS} h. Hors Daloa : ${OUTSIDE_DALOA_MAX_DAYS} jours maximum selon la ville, transport à convenir sur WhatsApp.`,
    FINAL_SALE_NOTICE,
    '',
    ...footerLines(store),
  ].join('\n');

  const itemRows = data.items
    .map(
      (item) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eef1f6;font-size:13px;color:${INK};">
          ${escapeHtml(item.name)}<br /><span style="color:${MUTED};font-size:12px;">${item.quantity} × ${formatFCFA(item.unitPrice)}</span>
        </td>
        <td align="right" style="padding:8px 0;border-bottom:1px solid #eef1f6;font-size:13px;font-weight:700;color:${INK};white-space:nowrap;">
          ${formatFCFA(item.lineTotal)}
        </td>
      </tr>`,
    )
    .join('');

  const totalsRows = [
    `<tr><td style="padding:4px 0;color:${MUTED};font-size:13px;">Sous-total</td><td align="right" style="padding:4px 0;color:${INK};font-size:13px;">${formatFCFA(data.subtotal)}</td></tr>`,
    Number(data.shippingFee) > 0
      ? `<tr><td style="padding:4px 0;color:${MUTED};font-size:13px;">Livraison</td><td align="right" style="padding:4px 0;color:${INK};font-size:13px;">${formatFCFA(data.shippingFee)}</td></tr>`
      : '',
    Number(data.discount) > 0
      ? `<tr><td style="padding:4px 0;color:${MUTED};font-size:13px;">Remise</td><td align="right" style="padding:4px 0;color:${INK};font-size:13px;">-${formatFCFA(data.discount)}</td></tr>`
      : '',
    `<tr><td style="padding:8px 0 0;border-top:2px solid ${NAVY};font-size:15px;font-weight:800;color:${NAVY};">TOTAL</td><td align="right" style="padding:8px 0 0;border-top:2px solid ${NAVY};font-size:15px;font-weight:800;color:${NAVY};">${formatFCFA(data.total)}</td></tr>`,
  ].join('');

  const html = layout({
    title: subject,
    preheader: created
      ? `Commande ${data.number} enregistrée — ${formatFCFA(data.total)}`
      : `Bon de commande ${data.number} — ${formatFCFA(data.total)}`,
    store,
    bodyHtml: [
      `<p style="margin:0 0 6px;font-size:17px;font-weight:800;color:${NAVY};">${created ? 'Commande enregistrée' : 'Votre bon de commande'}</p>`,
      `<p style="margin:0 0 18px;color:${MUTED};font-size:13px;">N° <strong style="color:${INK};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(data.number)}</strong> · ${escapeHtml(frDate(data.createdAt))}</p>`,
      paragraph(hello),
      paragraph(
        created
          ? 'Nous avons bien reçu votre commande. La boutique vous contacte au numéro indiqué pour la confirmation, le retrait ou la livraison.'
          : 'Voici le justificatif de votre commande. Il reprend les articles, les montants et l’état du paiement.',
      ),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:${MUTED};font-size:13px;width:45%;">État</td><td style="padding:6px 0;color:${INK};font-size:13px;font-weight:600;">${escapeHtml(data.status)}</td></tr>
        <tr><td style="padding:6px 0;color:${MUTED};font-size:13px;">Paiement</td><td style="padding:6px 0;color:${INK};font-size:13px;font-weight:600;">${escapeHtml(data.paymentStatus)} — ${escapeHtml(data.paymentMethod)}</td></tr>
        <tr><td style="padding:6px 0;color:${MUTED};font-size:13px;">Livraison</td><td style="padding:6px 0;color:${INK};font-size:13px;font-weight:600;">${escapeHtml(data.deliveryMethod)}</td></tr>
        ${infoRow('Client', data.customerName)}
        ${infoRow('Téléphone', data.phone)}
        ${infoRow('Ville', data.city)}
      </table>`,
      `<p style="margin:22px 0 6px;font-size:14px;font-weight:800;color:${NAVY};">Articles</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${itemRows}</table>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:10px;">${totalsRows}</table>`,
      button(data.link, created ? 'Suivre ma commande' : 'Ouvrir le bon'),
      noticeBox(
        `Retrait en boutique sous ${PICKUP_HOLD_HOURS} h. Hors Daloa : ${OUTSIDE_DALOA_MAX_DAYS} jours maximum selon la ville, transport à convenir sur WhatsApp.`,
      ),
      noticeBox(FINAL_SALE_NOTICE),
    ].join(''),
  });

  return { subject, text, html };
}
