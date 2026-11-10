import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Garde-fous de la fiche produit sur téléphone.
 *
 * Sur un écran de 6 pouces, trois éléments se disputent le bas de l'écran : la
 * barre d'achat collée (`MobileBuyBar`), le bouton d'aide WhatsApp flottant et
 * la marge de fin de page. Si l'un recouvre l'autre, le client tape à côté —
 * c'est le genre de régression qu'aucun test de données ne détecte.
 *
 * Le projet n'embarque pas de navigateur headless : ces vérifications lisent le
 * rendu source et les classes Tailwind, qui sont ici la seule vérité stable.
 */

const PRODUCT_PAGE = 'src/app/(site)/produit/[slug]/page.tsx';
const CLIENT_COMPONENTS = 'src/components/product-detail-client.tsx';
const WHATSAPP_BUTTON = 'src/components/whatsapp-help-button.tsx';

describe('barre d’achat mobile de la fiche produit', () => {
  const page = readFileSync(PRODUCT_PAGE, 'utf8');
  const components = readFileSync(CLIENT_COMPONENTS, 'utf8');
  const whatsapp = readFileSync(WHATSAPP_BUTTON, 'utf8');

  it('est montée sur la fiche produit avec le prix et la disponibilité', () => {
    expect(page).toContain('<MobileBuyBar');
    expect(page).toContain('priceLabel={formatFCFA(pricing.price)}');
    expect(page).toContain('available={availability.available}');
    expect(page).toContain('canOrder={availability.canOrder}');
  });

  it('laisse une marge en bas de page pour ne pas masquer la fin du contenu', () => {
    // La marge doit être mobile seulement (`lg:hidden`) et précéder la barre.
    const spacer = page.indexOf('h-20 lg:hidden');
    expect(spacer, 'marge de fin de page absente').toBeGreaterThan(-1);
    expect(spacer).toBeLessThan(page.indexOf('<MobileBuyBar'));
  });

  it('ne s’affiche que sur téléphone et jamais à l’impression', () => {
    const block = components.slice(components.indexOf('export function MobileBuyBar'));
    expect(block).toContain('fixed inset-x-0 bottom-0');
    expect(block).toContain('lg:hidden');
    expect(block).toContain('print:hidden');
  });

  it('garde le bouton WhatsApp au-dessus de la barre d’achat', () => {
    // `bottom-20` = 5 rem, soit plus haut que la barre (~4 rem) ; sur grand
    // écran la barre n'existe pas, donc `lg:bottom-4` suffit.
    expect(whatsapp).toContain('bottom-20');
    expect(whatsapp).toContain('lg:bottom-4');
    expect(whatsapp).toContain('print:hidden');
  });

  it('n’a pas d’indice de superposition supérieur à la barre d’achat', () => {
    const barZ = components.match(/z-(\d+)[^"]*bg-white\/95/);
    const helpZ = whatsapp.match(/z-(\d+)/);
    expect(barZ, 'barre d’achat sans z-index').not.toBeNull();
    expect(helpZ, 'bouton WhatsApp sans z-index').not.toBeNull();
    expect(Number(helpZ![1])).toBeLessThan(Number(barZ![1]));
  });

  it('affiche le prix, la remise et le stock dans la barre', () => {
    const block = components.slice(components.indexOf('export function MobileBuyBar'));
    expect(block).toContain('{priceLabel}');
    expect(block).toContain('discountPercent');
    expect(block).toContain("t('En stock')");
    expect(block).toContain("t('Épuisé')");
  });
});
