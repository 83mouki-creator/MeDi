import { describe, expect, it } from 'vitest';
import {
  formatCoordinates,
  geoJsonLd,
  googleMapsDirectionsUrl,
  googleMapsPlaceUrl,
  osmEmbedUrl,
  osmPageUrl,
  parseCoordinates,
} from '@/lib/geo';

describe('Géolocalisation — validation des coordonnées', () => {
  it('considère deux champs vides comme « non renseigné »', () => {
    expect(parseCoordinates({ latitude: null, longitude: null })).toEqual({ status: 'missing' });
    expect(parseCoordinates({ latitude: '', longitude: '   ' })).toEqual({ status: 'missing' });
  });

  it('refuse une coordonnée isolée plutôt que de publier une position approximative', () => {
    const onlyLat = parseCoordinates({ latitude: '6.87752', longitude: null });
    expect(onlyLat).toEqual({ status: 'incomplete', missing: ['longitude'] });

    const onlyLon = parseCoordinates({ latitude: '', longitude: '-6.45022' });
    expect(onlyLon).toEqual({ status: 'incomplete', missing: ['latitude'] });
  });

  it('refuse les valeurs non numériques et hors bornes', () => {
    expect(parseCoordinates({ latitude: 'abc', longitude: '12' }).status).toBe('invalid');
    expect(parseCoordinates({ latitude: '91', longitude: '0' }).status).toBe('invalid');
    expect(parseCoordinates({ latitude: '-91', longitude: '0' }).status).toBe('invalid');
    expect(parseCoordinates({ latitude: '0', longitude: '181' }).status).toBe('invalid');
    expect(parseCoordinates({ latitude: '0', longitude: '-181' }).status).toBe('invalid');
  });

  it('accepte les bornes exactes et la virgule décimale', () => {
    const bounds = parseCoordinates({ latitude: '90', longitude: '-180' });
    expect(bounds).toEqual({ status: 'ok', point: { latitude: 90, longitude: -180 } });

    const comma = parseCoordinates({ latitude: '6,87752', longitude: '-6,45022' });
    expect(comma).toEqual({ status: 'ok', point: { latitude: 6.87752, longitude: -6.45022 } });
  });

  it('accepte aussi des nombres (colonnes numeric renvoyées par la base)', () => {
    const parsed = parseCoordinates({ latitude: 6.87752 as unknown as number, longitude: -6.45022 });
    expect(parsed.status).toBe('ok');
    if (parsed.status === 'ok') {
      expect(parsed.point.latitude).toBeCloseTo(6.87752, 6);
      expect(parsed.point.longitude).toBeCloseTo(-6.45022, 6);
    }
  });

  it('arrondit à six décimales (~11 cm) sans perdre le signe', () => {
    const parsed = parseCoordinates({ latitude: '-6.4502201234', longitude: '5.9999999' });
    expect(parsed).toEqual({ status: 'ok', point: { latitude: -6.45022, longitude: 6 } });
  });
});

describe('Géolocalisation — liens et affichage', () => {
  const point = { latitude: 6.87752, longitude: -6.45022 };

  it('formate les coordonnées en degrés décimaux', () => {
    expect(formatCoordinates(point)).toBe('6.877520, -6.450220');
  });

  it('construit une carte OpenStreetMap centrée sur la boutique', () => {
    const url = osmEmbedUrl(point);
    expect(url.startsWith('https://www.openstreetmap.org/export/embed.html?bbox=')).toBe(true);
    expect(url).toContain('marker=6.877520%2C-6.450220');
    // La bbox OpenStreetMap suit l'ordre minLon,minLat,maxLon,maxLat et encadre le point.
    expect(url).toContain('bbox=-6.456220%2C6.871520%2C-6.444220%2C6.883520');
  });

  it('génère des liens Google Maps d’itinéraire et de consultation', () => {
    expect(googleMapsDirectionsUrl(point)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=6.877520,-6.450220',
    );
    expect(googleMapsPlaceUrl(point)).toBe('https://www.google.com/maps/search/?api=1&query=6.877520,-6.450220');
  });

  it('pointe OpenStreetMap sur le point exact en niveau de zoom 18', () => {
    expect(osmPageUrl(point)).toBe(
      'https://www.openstreetmap.org/?mlat=6.877520&mlon=-6.450220#map=18/6.877520/-6.450220',
    );
  });

  it('n’émet aucune donnée structurée sans coordonnées', () => {
    expect(geoJsonLd(null)).toBeNull();
    expect(geoJsonLd(point)).toEqual({
      '@type': 'GeoCoordinates',
      latitude: 6.87752,
      longitude: -6.45022,
    });
  });
});
