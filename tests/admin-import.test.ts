import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { products } from '@/db/schema';
import { importCatalogCsv, parseCsv } from '@/lib/import';
import { listProducts } from '@/lib/catalog';
import { adminProductSchema } from '@/lib/validation';
import { resetDb } from './helpers';

beforeEach(async () => {
  await resetDb();
});

const HEADER = 'sku;nom;prix;stock;categorie;marque;description_courte;prix_promo;mots_cles';

describe('analyseur CSV', () => {
  it('gère les guillemets, les virgules internes et les points-virgules', () => {
    const rows = parseCsv('sku;nom;prix\nA1;"Perceuse, 850 W";15000\nB2;"Ciment ""CPJ 45""";4800');
    expect(rows).toEqual([
      ['sku', 'nom', 'prix'],
      ['A1', 'Perceuse, 850 W', '15000'],
      ['B2', 'Ciment "CPJ 45"', '4800'],
    ]);
  });

  it('détecte le séparateur virgule', () => {
    const rows = parseCsv('sku,nom,prix\nC3,Marteau,5000');
    expect(rows[1]).toEqual(['C3', 'Marteau', '5000']);
  });
});

describe('import du catalogue', () => {
  it('crée les produits, leurs catégories et leurs marques', async () => {
    const csv = [
      HEADER,
      'MED-1001;Perceuse à percussion 850 W;25000;12;Outillage électroportatif;Nasco;Mandrin 13 mm;21000;perceuse visseuse',
      'MED-1002;Ciment CPJ 45 50 kg;4800;200;Matériaux;','',
    ].join('\n');

    const report = await importCatalogCsv(csv);
    expect(report.created).toBe(2);
    expect(report.rejected).toBe(0); // la ligne vide finale est ignorée
    expect(report.total).toBe(2);

    const created = await db.select().from(products).where(eq(products.sku, 'MED-1001'));
    expect(created).toHaveLength(1);
    expect(created[0]!.name).toBe('Perceuse à percussion 850 W');
    expect(Number(created[0]!.price)).toBe(25000);
    expect(Number(created[0]!.promoPrice)).toBe(21000);
    expect(created[0]!.stock).toBe(12);
    expect(created[0]!.searchText).toContain('perceuse');

    const catalogue = await listProducts({});
    expect(catalogue.total).toBe(2);
  });

  it('met à jour un produit existant par sa référence sans le dupliquer', async () => {
    await importCatalogCsv([HEADER, 'MED-2001;Marteau 500 g;6000;10;Outillage à main;Nasco;;;'].join('\n'));
    const report = await importCatalogCsv([HEADER, 'MED-2001;Marteau 500 g renforcé;6500;4;Outillage à main;Nasco;;;'].join('\n'));

    expect(report.updated).toBe(1);
    expect(report.created).toBe(0);

    const rows = await db.select().from(products).where(eq(products.sku, 'MED-2001'));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('Marteau 500 g renforcé');
    expect(Number(rows[0]!.price)).toBe(6500);
    expect(rows[0]!.stock).toBe(4);
  });

  it('ne modifie rien en simulation (dry-run)', async () => {
    const csv = [HEADER, 'MED-3001;Scie circulaire;45000;3;Outillage;Nasco;;;'].join('\n');
    const report = await importCatalogCsv(csv, { dryRun: true });

    expect(report.created).toBe(1);
    const rows = await db.select().from(products).where(eq(products.sku, 'MED-3001'));
    expect(rows).toHaveLength(0);
  });

  it('rejette les lignes invalides avec un motif, sans bloquer les lignes valides', async () => {
    const csv = [
      HEADER,
      ';Nom sans référence;1000;1;;;;;',
      'MED-4001;Prix négatif;-500;1;;;;;',
      'MED-4002;Stock négatif;5000;-2;;;;;',
      'MED-4003;Promo incohérente;5000;2;;;;6000;',
      'MED-4004;Produit valide;7000;2;;;;;',
    ].join('\n');

    const report = await importCatalogCsv(csv);
    expect(report.created).toBe(1);
    expect(report.rejected).toBe(4);

    const reasons = report.rows.filter((r) => r.status === 'rejected').map((r) => r.reason ?? '');
    expect(reasons.some((r) => /Référence \(sku\) manquante/.test(r))).toBe(true);
    expect(reasons.some((r) => /Prix invalide/.test(r))).toBe(true);
    expect(reasons.some((r) => /Stock invalide/.test(r))).toBe(true);
    expect(reasons.some((r) => /Prix promo/.test(r))).toBe(true);

    // Les lignes rejetées n'ont créé aucun produit.
    const all = await db.select().from(products);
    expect(all.map((p) => p.sku)).toEqual(['MED-4004']);
  });

  it('rejette une référence dupliquée dans le même fichier', async () => {
    const csv = [
      HEADER,
      'MED-5001;Premier produit;5000;1;;;;;',
      'MED-5001;Deuxième produit;6000;1;;;;;',
    ].join('\n');
    const report = await importCatalogCsv(csv);
    expect(report.created).toBe(1);
    expect(report.rejected).toBe(1);
    expect(report.rows[1]!.reason).toMatch(/double/);
  });
});

describe('validation d’un produit saisi dans l’administration', () => {
  const base = {
    name: 'Perceuse à percussion',
    sku: 'MED-6001',
    price: '25000',
    stock: '5',
  };

  it('accepte une saisie valide', () => {
    const parsed = adminProductSchema.safeParse({ ...base, promoPrice: '20000' });
    expect(parsed.success).toBe(true);
  });

  it('refuse un stock négatif, un prix nul et une référence invalide', () => {
    expect(adminProductSchema.safeParse({ ...base, stock: '-1' }).success).toBe(false);
    expect(adminProductSchema.safeParse({ ...base, price: '0' }).success).toBe(false);
    expect(adminProductSchema.safeParse({ ...base, sku: 'REF AVEC ESPACES' }).success).toBe(false);
    expect(adminProductSchema.safeParse({ ...base, name: 'ab' }).success).toBe(false);
  });

  it('refuse un prix décimal (les FCFA sont entiers)', () => {
    expect(adminProductSchema.safeParse({ ...base, price: '1500.5' }).success).toBe(false);
  });
});
