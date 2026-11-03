import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { computeReadiness, type ReadinessSnapshot } from '@/lib/readiness';
import { resolveStorageMode } from '@/lib/storage';
import { shouldSweep, sweepIntervalMs } from '@/lib/reservations';
import { formatStoreAddress } from '@/lib/store-location';
import { translate } from '@/lib/i18n/admin';
import { storedImages } from '@/db/schema';
import { db } from '@/db';

/** Réglages vides : rien n'a été saisi, la boutique ne peut pas vendre. */
function emptySnapshot(): ReadinessSnapshot {
  return {
    settings: {
      phone: null,
      whatsapp: null,
      email: null,
      addressLine: null,
      hasCoordinates: false,
      openingHours: null,
      waveNumber: null,
      waveMerchantName: null,
      legalNotice: null,
      allowPickup: true,
      allowLocalDelivery: true,
      allowCod: false,
      tagline: null,
    },
    catalog: { activeProducts: 0, inStockProducts: 0, withPhoto: 0, zeroPrice: 0, categories: 0, activePromotions: 0 },
    delivery: { localZonesWithTariff: 0, pickupZones: 0, nationalZones: 0 },
    staff: { managerAccounts: 1, activeStaff: 0 },
    infrastructure: {
      database: true,
      waveAuto: false,
      waveManual: false,
      storage: 'local',
      email: false,
      cron: false,
      appUrlIsHttps: false,
    },
  };
}

/** Boutique complète : tout est renseigné et l'infrastructure est en place. */
function readySnapshot(): ReadinessSnapshot {
  return {
    settings: {
      phone: '+225 07 00 00 00 00',
      whatsapp: '+225 07 00 00 00 00',
      email: 'boutique@example.ci',
      addressLine: 'Daloa, quartier Tazibouo',
      hasCoordinates: true,
      openingHours: 'Lundi – Samedi, 8 h – 18 h',
      waveNumber: '+225 07 00 00 00 00',
      waveMerchantName: 'MeDi',
      legalNotice: 'RCCM CI-DAL-2024-B-1234 — NCC 1234567 A',
      allowPickup: true,
      allowLocalDelivery: true,
      allowCod: false,
      tagline: 'Quincaillerie à Daloa',
    },
    catalog: { activeProducts: 146, inStockProducts: 120, withPhoto: 146, zeroPrice: 0, categories: 8, activePromotions: 1 },
    delivery: { localZonesWithTariff: 8, pickupZones: 1, nationalZones: 3 },
    staff: { managerAccounts: 1, activeStaff: 2 },
    infrastructure: {
      database: true,
      waveAuto: false,
      waveManual: true,
      storage: 'database',
      email: true,
      cron: true,
      appUrlIsHttps: true,
    },
  };
}

describe('Diagnostic « prêt à vendre »', () => {
  it('déclare la boutique non prête quand rien n’est renseigné', () => {
    const report = computeReadiness(emptySnapshot());
    expect(report.verdict).toBe('pas_pret');
    expect(report.blocking).toBeGreaterThan(0);
    expect(report.score).toBeLessThan(100);
    // Les blocages attendus : paiement, catalogue, stock, livraison locale.
    const ids = report.checks.filter((check) => check.status === 'blocking').map((check) => check.id);
    expect(ids).toContain('wave-marchand');
    expect(ids).toContain('catalogue');
    expect(ids).toContain('livraison-daloa');
    // Sans compte de gérance, personne ne peut gérer la boutique.
    const sansCompte = emptySnapshot();
    sansCompte.staff.managerAccounts = 0;
    expect(computeReadiness(sansCompte).checks.find((check) => check.id === 'comptes')?.status).toBe('blocking');
  });

  it('déclare la boutique prête quand tout est en place', () => {
    const report = computeReadiness(readySnapshot());
    expect(report.verdict).toBe('pret');
    expect(report.blocking).toBe(0);
    expect(report.todo).toBe(0);
    expect(report.score).toBe(100);
  });

  it('reste « presque » quand seules des finitions manquent', () => {
    const snapshot = readySnapshot();
    snapshot.settings.openingHours = null;
    const report = computeReadiness(snapshot);
    expect(report.verdict).toBe('presque');
    expect(report.blocking).toBe(0);
    expect(report.todo).toBe(1);
  });

  it('bloque si la base de données ne répond pas', () => {
    const snapshot = readySnapshot();
    snapshot.infrastructure.database = false;
    const report = computeReadiness(snapshot);
    expect(report.verdict).toBe('pas_pret');
    expect(report.checks.find((check) => check.id === 'base')?.status).toBe('blocking');
  });

  it('remplit les compteurs dans le texte, sans laisser d’accolade', () => {
    const report = computeReadiness(readySnapshot());
    const catalogue = report.checks.find((check) => check.id === 'catalogue');
    expect(catalogue?.detail).toContain('{count}');
    expect(catalogue?.vars).toEqual({ count: 146, available: 120 });
    expect(translate('fr', catalogue!.detail, catalogue!.vars)).toBe('146 produit(s) publié(s), 120 disponible(s) tout de suite.');
    expect(translate('ar', catalogue!.detail, catalogue!.vars)).not.toContain('{');
  });

  it('fournit toujours un lien vers l’écran de correction quand la boutique doit agir', () => {
    const report = computeReadiness(emptySnapshot());
    const boutiqueChecks = report.checks.filter((check) => check.owner === 'boutique' && check.status !== 'ready');
    expect(boutiqueChecks.every((check) => Boolean(check.href))).toBe(true);
  });

  it('chaque libellé et chaque explication existent en arabe', () => {
    const labels = new Set<string>();
    for (const snapshot of [emptySnapshot(), readySnapshot()]) {
      for (const check of computeReadiness(snapshot).checks) {
        labels.add(check.label);
        labels.add(check.detail);
      }
    }
    const missing = [...labels].filter((text) => /\p{Script=Latin}{2}/u.test(text) && translate('ar', text) === text);
    expect(missing, `Textes sans traduction arabe : ${missing.join(' | ')}`).toEqual([]);
  });
});

describe('Conservation des photos', () => {
  it('écrit dans la base dès qu’aucun disque durable n’est disponible', () => {
    expect(resolveStorageMode({ driver: 'local', cloudinaryReady: false, isProduction: true })).toBe('database');
    expect(resolveStorageMode({ driver: 'cloudinary', cloudinaryReady: false, isProduction: true })).toBe('database');
  });

  it('privilégie Cloudinary quand il est configuré', () => {
    expect(resolveStorageMode({ driver: 'cloudinary', cloudinaryReady: true, isProduction: true })).toBe('cloudinary');
  });

  it('garde le disque local en développement', () => {
    expect(resolveStorageMode({ driver: 'local', cloudinaryReady: false, isProduction: false })).toBe('local');
  });
});

describe('Libération automatique des réservations', () => {
  it('ne relance pas un balayage avant l’intervalle', () => {
    const now = 1_000_000;
    expect(shouldSweep(0, now)).toBe(true);
    expect(shouldSweep(now - 10_000, now)).toBe(false);
    expect(shouldSweep(now - 61_000, now)).toBe(true);
  });

  it('accepte un intervalle nul pour forcer le passage', () => {
    expect(shouldSweep(999_999, 1_000_000, 0)).toBe(true);
  });

  it('expose un intervalle par défaut raisonnable', () => {
    expect(sweepIntervalMs()).toBeGreaterThanOrEqual(0);
  });

  it('la tâche planifiée de production est déclarée dans vercel.json', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as { crons?: { path: string; schedule: string }[] };
    expect(config.crons?.some((cron) => cron.path === '/api/cron/expire-reservations')).toBe(true);
    for (const cron of config.crons ?? []) expect(cron.schedule).toMatch(/^[\d*/, -]+$/);
  });

  it('la migration des photos en base est enregistrée dans le journal Drizzle', () => {
    const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as { entries: { tag: string }[] };
    expect(journal.entries.some((entry) => entry.tag === '0005_stored_images')).toBe(true);
  });
});

describe('Adresse affichée', () => {
  it('ne répète pas la ville déjà écrite dans l’adresse', () => {
    expect(
      formatStoreAddress({
        addressLine: `6°53'04.4"N 6°26'50.9"W — Daloa`,
        city: 'Daloa',
        country: "Côte d'Ivoire",
      }),
    ).toBe(`6°53'04.4"N 6°26'50.9"W — Daloa, Côte d'Ivoire`);
  });

  it('ajoute la ville quand elle manque', () => {
    expect(formatStoreAddress({ addressLine: 'Rue du commerce', city: 'Daloa', country: "Côte d'Ivoire" })).toBe(
      "Rue du commerce, Daloa, Côte d'Ivoire",
    );
  });

  it('reste lisible quand l’adresse n’est pas renseignée', () => {
    expect(formatStoreAddress({ addressLine: '', city: 'Daloa', country: "Côte d'Ivoire" })).toBe("Daloa, Côte d'Ivoire");
  });
});

describe('Photos stockées en base', () => {
  beforeEach(async () => {
    await db.delete(storedImages);
  });

  it('la table accepte une image et la retrouve par son identifiant', async () => {
    const data = Buffer.from('image-de-test');
    await db.insert(storedImages).values({
      id: 'img_test_0001',
      filename: 'test.webp',
      width: 10,
      height: 10,
      bytes: data.byteLength,
      checksum: 'a'.repeat(64),
      data,
    });

    const rows = await db.select().from(storedImages);
    const row = rows.find((item) => item.id === 'img_test_0001');
    expect(row).toBeTruthy();
    expect(row?.mimeType).toBe('image/webp');
    expect(Buffer.from(row!.data).toString()).toBe('image-de-test');
  });

  it('refuse deux images identiques (empreinte unique)', async () => {
    const insert = (id: string) =>
      db.insert(storedImages).values({
        id,
        filename: `${id}.webp`,
        width: 10,
        height: 10,
        bytes: 4,
        checksum: 'b'.repeat(64),
        data: Buffer.from([1, 2, 3, 4]),
      });

    await insert('img_test_0002');
    await expect(insert('img_test_0003')).rejects.toThrow();
  });
});
