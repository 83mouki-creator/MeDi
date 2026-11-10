import { describe, expect, it } from 'vitest';
import { existsSync, globSync, readFileSync } from 'node:fs';
import { BRAND, BRAND_LOGO_SIZE, STORE_NAME, STORE_TAGLINE, STORE_WHATSAPP_DIGITS } from '@/lib/brand';

/**
 * Garde-fous du parcours arrêté par le propriétaire.
 *
 * Trois décisions structurent le site et ne doivent pas se perdre au fil des
 * modifications :
 *   1. **Perokado** est la seule enseigne, avec son slogan exact ;
 *   2. la vente se fait en **livraison à domicile uniquement** (ni retrait en
 *      magasin, ni carte, ni coordonnées GPS) ;
 *   3. la vitrine **et** l'administration sont en français, sans sélecteur de
 *      langue.
 *
 * Ces tests lisent le code source plutôt que le rendu : ils attrapent une
 * régression même dans une page que personne n'ouvre pendant des semaines.
 */

const SITE_FILES = [
  ...globSync('src/app/(site)/**/*.tsx'),
  ...globSync('src/components/*.tsx'),
  ...globSync('src/lib/*.ts'),
].filter((file) => !file.includes('/admin') && !file.includes('store-location'));

/** Fichiers d'interface : on y cherche des textes affichés au client. */
const UI_FILES = [...globSync('src/app/(site)/**/*.tsx'), ...globSync('src/components/*.tsx')];

describe('identité de la boutique', () => {
  it('porte l’enseigne et le slogan exacts demandés', () => {
    expect(STORE_NAME).toBe('Perokado');
    expect(STORE_TAGLINE).toBe('Tout ce que vous cherchez au même endroit.');
  });

  it('utilise le WhatsApp de la boutique, aussi compte marchand', () => {
    expect(STORE_WHATSAPP_DIGITS).toBe('2250544014182');
  });

  it('expose les fichiers de marque réellement présents', () => {
    for (const path of [BRAND.logoHorizontalWhite, BRAND.logoHorizontal, BRAND.icon, BRAND.icon192, BRAND.iconMaskable, BRAND.ogImage]) {
      expect(existsSync(`public${path}`), `fichier absent : ${path}`).toBe(true);
    }
    // Format du verrou horizontal, utilisé partout dans le site.
    expect(BRAND_LOGO_SIZE).toEqual({ width: 515, height: 132 });
  });

  it('n’emploie plus l’ancienne enseigne nulle part dans la vitrine', () => {
    const offenders = SITE_FILES.filter((file) => /MeDi Shop|\bMeDi\b/.test(readFileSync(file, 'utf8')));
    expect(offenders, `Ancienne enseigne : ${offenders.join(' | ')}`).toEqual([]);
  });

  it('n’emploie plus l’ancienne enseigne dans l’administration', () => {
    const adminFiles = [...globSync('src/app/admin/**/*.tsx'), ...globSync('src/components/admin/*.tsx')];
    const offenders = adminFiles.filter((file) => /MeDi Shop|\bMeDi\b/.test(readFileSync(file, 'utf8')));
    expect(offenders, `Ancienne enseigne : ${offenders.join(' | ')}`).toEqual([]);
  });
});

describe('livraison à domicile uniquement', () => {
  it('ne propose plus le retrait en magasin au client', () => {
    const offenders = UI_FILES.filter((file) => {
      const source = readFileSync(file, 'utf8');
      // Les libellés « (archivé) » du module de livraison restent autorisés : ils
      // servent à relire d'anciennes commandes, pas à en créer de nouvelles.
      return /retrait en boutique|retirer en boutique|colis gardé/i.test(source);
    });
    expect(offenders, `Retrait encore proposé : ${offenders.join(' | ')}`).toEqual([]);
  });

  it('ne publie plus d’adresse ni de coordonnées GPS', () => {
    const offenders = UI_FILES.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /coordonnées GPS|Google Maps|OpenStreetMap|latitude|longitude/i.test(source);
    });
    expect(offenders, `Géolocalisation encore affichée : ${offenders.join(' | ')}`).toEqual([]);
  });

  it('n’a plus de page « Nous trouver » ni de module de géolocalisation', () => {
    expect(existsSync('src/app/(site)/nous-trouver/page.tsx')).toBe(false);
    expect(existsSync('src/lib/geo.ts')).toBe(false);
  });

  it('ne référence plus /nous-trouver dans les liens internes', () => {
    const files = [...globSync('src/**/*.ts'), ...globSync('src/**/*.tsx')];
    const offenders = files.filter((file) => readFileSync(file, 'utf8').includes('/nous-trouver'));
    expect(offenders, `Lien mort : ${offenders.join(' | ')}`).toEqual([]);
  });

  it('force le retrait à false : une ancienne valeur en base ne peut pas le réactiver', () => {
    const settings = readFileSync('src/lib/settings.ts', 'utf8');
    expect(settings).toMatch(/allowPickup: false/);
    const actions = readFileSync('src/app/actions/admin-settings.ts', 'utf8');
    expect(actions).toMatch(/allowPickup: false/);
    expect(actions).toMatch(/isPickup: false/);
  });

  it('ne garde que deux méthodes de livraison et deux moyens de paiement', () => {
    const validation = readFileSync('src/lib/validation.ts', 'utf8');
    expect(validation).toContain("z.enum(['LOCAL_DELIVERY', 'CARRIER'])");
    expect(validation).toContain("z.enum(['WAVE', 'CASH_ON_DELIVERY'])");
    expect(validation).not.toContain("'PICKUP'");
    expect(validation).not.toContain("'CASH_IN_STORE'");
  });
});

describe('français uniquement', () => {
  it('n’a plus de sélecteur de langue sur la vitrine', () => {
    expect(existsSync('src/components/site-locale-selector.tsx')).toBe(false);
    expect(existsSync('src/app/actions/site-locale.ts')).toBe(false);
    const header = readFileSync('src/components/site-header.tsx', 'utf8');
    expect(header).not.toMatch(/LocaleSwitcher|SiteLocaleSelector/);
  });

  it('n’a plus de sélecteur de langue dans l’administration', () => {
    expect(existsSync('src/app/actions/admin-locale.ts')).toBe(false);
    const topBar = readFileSync('src/components/admin/admin-top-bar.tsx', 'utf8');
    expect(topBar).not.toMatch(/LocaleSwitcher|LocaleSelector/);
  });

  it('déclare le français de Côte d’Ivoire sur la page racine', () => {
    const layout = readFileSync('src/app/layout.tsx', 'utf8');
    expect(layout).toContain('lang="fr-CI"');
    expect(layout).toContain('dir="ltr"');
  });
});

describe('prix d’achat et bénéfice', () => {
  it('garde la colonne figée dans le schéma et dans la migration', () => {
    const schema = readFileSync('src/db/schema.ts', 'utf8');
    expect(schema).toContain('purchasePrice');
    expect(schema).toContain('purchasePriceSnapshot');
    const migration = readFileSync('drizzle/0009_order_item_purchase_price.sql', 'utf8');
    expect(migration).toContain('purchase_price_snapshot');
  });

  it('expose le prix d’achat dans le formulaire produit et l’import CSV', () => {
    expect(readFileSync('src/components/admin/product-form.tsx', 'utf8')).toContain('name="purchasePrice"');
    expect(readFileSync('src/lib/import.ts', 'utf8')).toContain('prix_achat');
  });

  it('affiche le bénéfice net sur le tableau de bord et dans les statistiques', () => {
    expect(readFileSync('src/app/admin/page.tsx', 'utf8')).toContain('metrics.profitTotal');
    const stats = readFileSync('src/app/admin/statistiques/page.tsx', 'utf8');
    expect(stats).toContain('metrics.profitTotal');
    expect(stats).toContain('productProfitability');
  });
});

describe('stickers produits', () => {
  it('propose un écran d’administration dédié, accessible depuis le menu', () => {
    expect(existsSync('src/app/admin/stickers/page.tsx')).toBe(true);
    expect(readFileSync('src/app/admin/layout.tsx', 'utf8')).toContain("href: '/admin/stickers'");
  });

  it('limite à deux emplacements et les expose sur la fiche produit', () => {
    expect(readFileSync('src/lib/sticker-constants.ts', 'utf8')).toContain('MAX_STICKERS_PER_PRODUCT = 2');
    expect(readFileSync('src/app/admin/produits/[id]/page.tsx', 'utf8')).toContain('ProductStickerSlots');
  });

  it('affiche les stickers sur la vignette et la fiche produit', () => {
    expect(readFileSync('src/components/product-card.tsx', 'utf8')).toContain('ProductStickerOverlay');
    expect(readFileSync('src/app/(site)/produit/[slug]/page.tsx', 'utf8')).toContain('ProductStickerList');
  });

  it('garde le module de données hors du navigateur', () => {
    // `lib/stickers` interroge PostgreSQL : il ne doit jamais être importé par un
    // composant client, sinon le pilote `pg` finit dans le paquet JavaScript.
    const client = [...globSync('src/components/**/*.tsx'), ...globSync('src/components/*.tsx')];
    const offenders = client.filter(
      (file) => readFileSync(file, 'utf8').includes("from '@/lib/stickers'") && readFileSync(file, 'utf8').includes("'use client'"),
    );
    expect(offenders, `Import serveur dans un composant client : ${offenders.join(' | ')}`).toEqual([]);
  });
});
