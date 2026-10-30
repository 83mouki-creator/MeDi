import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { storeSettings } from '@/db/schema';
import { getStoreSettings } from '@/lib/settings';
import { resetDb } from './helpers';

beforeEach(async () => {
  await resetDb();
});

async function saveCoordinates(latitude: string | null, longitude: string | null) {
  const values = { id: 1, latitude, longitude, updatedAt: new Date() };
  await db.insert(storeSettings).values(values).onConflictDoUpdate({ target: storeSettings.id, set: values });
}

describe('Réglages — géolocalisation de la boutique', () => {
  it('ne publie aucune coordonnée tant qu’elles ne sont pas saisies', async () => {
    const settings = await getStoreSettings();
    expect(settings.geo).toBeNull();
    expect(settings.latitudeInput).toBeNull();
    expect(settings.longitudeInput).toBeNull();
  });

  it('expose les coordonnées enregistrées depuis l’administration', async () => {
    await saveCoordinates('6.877520', '-6.450220');

    const settings = await getStoreSettings();
    expect(settings.geo).toEqual({ latitude: 6.87752, longitude: -6.45022 });
    // Le formulaire d'administration réaffiche la valeur telle qu'enregistrée.
    expect(settings.latitudeInput).toBe('6.877520');
    expect(settings.longitudeInput).toBe('-6.450220');
  });

  it('ignore une géolocalisation partielle restée en base', async () => {
    await saveCoordinates('6.877520', null);

    const settings = await getStoreSettings();
    expect(settings.geo).toBeNull();
    const rows = await db.select({ lat: storeSettings.latitude }).from(storeSettings).where(eq(storeSettings.id, 1));
    expect(rows[0]?.lat).toBe('6.877520');
  });

  it('refuse une géolocalisation hors bornes saisie directement en base', async () => {
    await saveCoordinates('999', '-6.450220');
    const settings = await getStoreSettings();
    expect(settings.geo).toBeNull();
  });
});
