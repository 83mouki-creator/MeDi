import { describe, expect, it } from 'vitest';
import { existsSync, globSync, readFileSync } from 'node:fs';
import { BRAND, STORE_WHATSAPP, STORE_WHATSAPP_DIGITS, WHATSAPP_MESSAGES } from '@/lib/brand';
import { whatsappLink } from '@/lib/settings';

/**
 * Garde-fous du contact client.
 *
 * Trois promesses au client, vérifiées ici pour qu'aucune refonte ne les casse :
 *   1. **un seul numéro** — le WhatsApp Business `+225 05 44 01 41 82`, partout ;
 *   2. **un message déjà écrit** — le bouton ouvre la conversation préremplie,
 *      le client n'a plus qu'à appuyer sur « envoyer » ;
 *   3. **un bouton toujours à portée** — l'aide est accessible depuis toutes les
 *      pages, pas seulement depuis le bas de la page contact.
 */

const UI_FILES = [...globSync('src/app/(site)/**/*.tsx'), ...globSync('src/components/*.tsx')];

describe('numéro unique de la boutique', () => {
  it('est le WhatsApp Business +225 05 44 01 41 82', () => {
    expect(STORE_WHATSAPP).toBe('+225 05 44 01 41 82');
    expect(STORE_WHATSAPP_DIGITS).toBe('2250544014182');
  });

  it('a remplacé l’ancien numéro de test partout dans l’interface', () => {
    const offenders = UI_FILES.filter((file) => /07 08 90 48 91|0708904891/.test(readFileSync(file, 'utf8')));
    expect(offenders, `Ancien numéro encore affiché : ${offenders.join(' | ')}`).toEqual([]);
  });

  it('n’est jamais écrit en dur dans un composant : il vient des réglages', () => {
    // Le numéro peut apparaître dans les textes d'aide (placeholder, exemple),
    // mais jamais comme lien wa.me ou tel: figé.
    const offenders = UI_FILES.filter((file) => /wa\.me\/\d{8,}/.test(readFileSync(file, 'utf8')));
    expect(offenders, `Lien WhatsApp codé en dur : ${offenders.join(' | ')}`).toEqual([]);
  });
});

describe('boutons WhatsApp', () => {
  const settings = { whatsapp: STORE_WHATSAPP };

  it('ouvrent la conversation avec un message prérempli', () => {
    for (const key of Object.keys(WHATSAPP_MESSAGES) as (keyof typeof WHATSAPP_MESSAGES)[]) {
      const href = whatsappLink(settings, WHATSAPP_MESSAGES[key]);
      expect(href, `message manquant : ${key}`).toBeTruthy();
      expect(href!).toContain(`wa.me/${STORE_WHATSAPP_DIGITS}?text=`);
      expect(decodeURIComponent(href!)).toContain(WHATSAPP_MESSAGES[key]);
    }
  });

  it('préremplissent un message même quand l’appelant n’en passe aucun', () => {
    const href = whatsappLink(settings);
    expect(decodeURIComponent(href!)).toContain(WHATSAPP_MESSAGES.help);
  });

  it('retombent sur le message d’aide si le message fourni est vide', () => {
    const href = whatsappLink(settings, '   ');
    expect(decodeURIComponent(href!)).toContain(WHATSAPP_MESSAGES.help);
  });

  it('citent la boutique dans le message', () => {
    for (const message of Object.values(WHATSAPP_MESSAGES)) {
      expect(message).toContain('Perokado');
    }
  });
});

describe('aide accessible depuis tout le site', () => {
  it('affiche un bouton flottant sur toutes les pages de la vitrine', () => {
    const layout = readFileSync('src/app/(site)/layout.tsx', 'utf8');
    expect(layout).toContain('WhatsAppHelpButton');
    const button = readFileSync('src/components/whatsapp-help-button.tsx', 'utf8');
    expect(button).toContain('whatsappLink');
    expect(button).toContain('WHATSAPP_MESSAGES.help');
    // Le bouton est rendu côté serveur : aucun numéro n'est recalculé au navigateur.
    expect(button).not.toContain("'use client'");
  });

  it('propose le WhatsApp sur la page contact, avec un message prérempli', () => {
    const page = readFileSync('src/app/(site)/contact/page.tsx', 'utf8');
    expect(page).toContain('whatsappLink');
    expect(page).toContain('WHATSAPP_MESSAGES.help');
    expect(page).not.toMatch(/https:\/\/wa\.me\/\$\{/);
  });

  it('contextualise le message de la fiche produit (nom et référence)', () => {
    const page = readFileSync('src/app/(site)/produit/[slug]/page.tsx', 'utf8');
    expect(page).toContain('WHATSAPP_MESSAGES.product');
    expect(page).toContain('product.sku');
  });
});

describe('identité affichée', () => {
  it('utilise l’emblème 3D « sac de boutique » aux endroits clés', () => {
    // L'emblème 3D est le dessin de référence : icônes, filigrane, partage.
    expect(BRAND.emblem3d).toBe('/brand/perokado-emblem-3d.png');
    expect(BRAND.icon).toBe('/brand/perokado-icon.png');
    // L'administration reprend l'emblème en filigrane, l'en-tête et le pied de
    // page le verrou complet.
    const admin = readFileSync('src/app/admin/layout.tsx', 'utf8');
    expect(admin).toContain('BRAND.emblem3d');
    const header = readFileSync('src/components/site-header.tsx', 'utf8');
    expect(header).toContain('BRAND.logoHorizontalWhite');
    // L'accueil affiche la photo du bandeau par la constante de marque, pour
    // qu'un changement d'image ne se fasse qu'à un seul endroit.
    const home = readFileSync('src/app/(site)/page.tsx', 'utf8');
    expect(home).toContain('BRAND.heroImage');
    expect(home).not.toContain('fond-quincaillerie');
  });

  it('les fichiers de marque référencés existent réellement dans public/', () => {
    for (const file of [BRAND.emblem3d, BRAND.heroImage, BRAND.icon, BRAND.icon192, BRAND.iconMaskable, BRAND.appleTouchIcon, BRAND.favicon, BRAND.ogImage, BRAND.logoHorizontalWhite, BRAND.logoHorizontal, BRAND.logoStacked, BRAND.logoStackedWhite]) {
      expect(existsSync(`public${file}`), `Fichier de marque manquant : ${file}`).toBe(true);
    }
  });

  it('n’affiche plus l’ancienne enseigne nulle part dans l’interface', () => {
    const adminFiles = [...globSync('src/app/admin/**/*.tsx'), ...globSync('src/components/admin/*.tsx')];
    const offenders = [...UI_FILES, ...adminFiles].filter((file) => /MeDi Shop|\bMeDi\b/.test(readFileSync(file, 'utf8')));
    expect(offenders, `Ancienne enseigne : ${offenders.join(' | ')}`).toEqual([]);
  });
});
