/**
 * Géolocalisation de la boutique.
 *
 * Aucune coordonnée n'est inventée : tant que le propriétaire n'a pas saisi la
 * latitude et la longitude exactes, `parseCoordinates` renvoie `null` et
 * l'interface affiche une demande d'information au lieu d'une carte.
 *
 * Les fonctions de ce module sont pures (aucune dépendance à la base ni à
 * Next.js) : elles sont testées directement dans `tests/geo.test.ts`.
 */

export type GeoPoint = { latitude: number; longitude: number };

export type CoordinateInput = {
  latitude: string | number | null | undefined;
  longitude: string | number | null | undefined;
};

export type ParsedCoordinates =
  | { status: 'missing' }
  | { status: 'incomplete'; missing: ('latitude' | 'longitude')[] }
  | { status: 'invalid'; message: string }
  | { status: 'ok'; point: GeoPoint };

export const LATITUDE_RANGE = { min: -90, max: 90 } as const;
export const LONGITUDE_RANGE = { min: -180, max: 180 } as const;

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  // Une virgule décimale (saisie francophone) est acceptée en plus du point.
  const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value;
  if (normalized === '') return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : Number.NaN;
}

/**
 * Valide une paire de coordonnées.
 * - `missing` : les deux champs sont vides (état normal tant que la boutique
 *   n'a pas communiqué sa position) ;
 * - `incomplete` : un seul des deux champs est rempli ;
 * - `invalid` : valeur non numérique ou hors bornes ;
 * - `ok` : coordonnées exploitables.
 */
export function parseCoordinates({ latitude, longitude }: CoordinateInput): ParsedCoordinates {
  const lat = toNumber(latitude);
  const lon = toNumber(longitude);

  if (lat === null && lon === null) return { status: 'missing' };

  const missing: ('latitude' | 'longitude')[] = [];
  if (lat === null) missing.push('latitude');
  if (lon === null) missing.push('longitude');
  if (missing.length > 0) return { status: 'incomplete', missing };

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return { status: 'invalid', message: 'Les coordonnées doivent être des nombres décimaux (ex. 6.877520 et -6.450220).' };
  }
  if (lat! < LATITUDE_RANGE.min || lat! > LATITUDE_RANGE.max) {
    return { status: 'invalid', message: `La latitude doit être comprise entre ${LATITUDE_RANGE.min} et ${LATITUDE_RANGE.max}.` };
  }
  if (lon! < LONGITUDE_RANGE.min || lon! > LONGITUDE_RANGE.max) {
    return { status: 'invalid', message: `La longitude doit être comprise entre ${LONGITUDE_RANGE.min} et ${LONGITUDE_RANGE.max}.` };
  }

  // 6 décimales ≈ 11 cm : largement suffisant pour une boutique.
  return {
    status: 'ok',
    point: { latitude: Math.round(lat! * 1e6) / 1e6, longitude: Math.round(lon! * 1e6) / 1e6 },
  };
}

/** Coordonnées affichables (6 décimales, point décimal). */
export function formatCoordinates(point: GeoPoint) {
  return `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
}

/** Carte centrée sur la boutique (OpenStreetMap, sans clé d'API). */
export function osmEmbedUrl(point: GeoPoint, spanDegrees = 0.006) {
  const { latitude: lat, longitude: lon } = point;
  const bbox = [lon - spanDegrees, lat - spanDegrees, lon + spanDegrees, lat + spanDegrees]
    .map((value) => value.toFixed(6))
    .join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)}%2C${lon.toFixed(6)}`;
}

/** Fiche OpenStreetMap (permet d'ouvrir la carte en plein écran). */
export function osmPageUrl(point: GeoPoint) {
  return `https://www.openstreetmap.org/?mlat=${point.latitude.toFixed(6)}&mlon=${point.longitude.toFixed(6)}#map=18/${point.latitude.toFixed(6)}/${point.longitude.toFixed(6)}`;
}

/** Lien Google Maps « itinéraire vers la boutique ». */
export function googleMapsDirectionsUrl(point: GeoPoint) {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
}

/** Lien Google Maps « voir l'emplacement ». */
export function googleMapsPlaceUrl(point: GeoPoint) {
  return `https://www.google.com/maps/search/?api=1&query=${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
}

/**
 * Bloc `geo` des données structurées schema.org (LocalBusiness).
 * Retourne `null` si les coordonnées ne sont pas encore publiées : on préfère
 * omettre la propriété plutôt que d'annoncer une position approximative.
 */
export function geoJsonLd(point: GeoPoint | null) {
  if (!point) return null;
  return {
    '@type': 'GeoCoordinates',
    latitude: point.latitude,
    longitude: point.longitude,
  };
}
