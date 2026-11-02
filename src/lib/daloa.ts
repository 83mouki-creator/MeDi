/**
 * Quartiers de Daloa, tels qu'ils sont nommés par les habitants.
 *
 * À Daloa, le client ne dit pas « je suis dans la zone centre » : il donne son
 * quartier. La boutique a donc demandé que le tunnel de commande propose la
 * liste des quartiers, et que le tarif de livraison en découle.
 *
 * Le rattachement « quartier → bande tarifaire » ci-dessous n'est qu'une valeur
 * de départ : il est recopié dans `delivery_zones.neighbourhoods` par
 * `npm run config:store`, et le propriétaire peut déplacer un quartier d'une
 * zone à l'autre depuis l'administration sans toucher au code.
 */

export type DaloaBand = 'CENTRE' | 'PERIPHERIE';

export type DaloaNeighbourhood = {
  name: string;
  band: DaloaBand;
  /** Ancien nom ou graphie fréquente, pour la recherche. */
  aliases?: string[];
};

export const DALOA_NEIGHBOURHOODS: DaloaNeighbourhood[] = [
  // ── Quartiers centraux (livraison la moins chère) ──────────────────────────
  { name: 'Commerce', band: 'CENTRE' },
  { name: 'Dioulabougou', band: 'CENTRE', aliases: ['Dioulabougou Mossibougou'] },
  { name: 'Mossibougou', band: 'CENTRE' },
  { name: 'Sissoko', band: 'CENTRE' },
  { name: 'Wolof', band: 'CENTRE' },
  { name: 'Ségou', band: 'CENTRE' },
  { name: 'Baoulé', band: 'CENTRE' },
  { name: 'Labia', band: 'CENTRE', aliases: ['Dalolabia'] },
  { name: 'Lobia 1', band: 'CENTRE', aliases: ['Lobia'] },
  { name: 'Gbeuliville', band: 'CENTRE', aliases: ['Gbeuli'] },
  { name: 'Tazibouo 1', band: 'CENTRE', aliases: ['Tazibouo'] },
  { name: 'Tazibouo État-Major', band: 'CENTRE', aliases: ['Tazibouo Etat Major'] },
  { name: 'Évêché', band: 'CENTRE', aliases: ['Eveche'] },
  { name: 'Huberson', band: 'CENTRE' },
  { name: 'Georgia', band: 'CENTRE' },
  { name: 'Piscine', band: 'CENTRE' },
  { name: 'Cité verte', band: 'CENTRE', aliases: ['Cite verte'] },
  { name: 'Millionnaire', band: 'CENTRE' },
  { name: 'Résidentiel', band: 'CENTRE', aliases: ['Residentiel'] },
  { name: 'Gbokora', band: 'CENTRE' },
  { name: 'Balouzon', band: 'CENTRE' },
  { name: 'Kasséré', band: 'CENTRE', aliases: ['Kassere'] },
  { name: 'Soleil 1', band: 'CENTRE' },
  { name: 'Marais', band: 'CENTRE' },

  // ── Quartiers périphériques (livraison plus éloignée) ──────────────────────
  { name: 'Abattoir 1', band: 'PERIPHERIE', aliases: ['Abattoir'] },
  { name: 'Abattoir 2', band: 'PERIPHERIE' },
  { name: 'Bracodi', band: 'PERIPHERIE' },
  { name: 'Orly 1', band: 'PERIPHERIE', aliases: ['Orly'] },
  { name: 'Orly 2', band: 'PERIPHERIE' },
  { name: 'Orly 3', band: 'PERIPHERIE' },
  { name: 'Kennedy', band: 'PERIPHERIE' },
  { name: 'Kennedy 2', band: 'PERIPHERIE' },
  { name: 'Soleil 2', band: 'PERIPHERIE' },
  { name: 'Lobia 2', band: 'PERIPHERIE' },
  { name: 'Tazibouo 2', band: 'PERIPHERIE' },
  { name: 'Aviation', band: 'PERIPHERIE' },
  { name: 'Savonnerie', band: 'PERIPHERIE' },
  { name: 'Gbogbélé', band: 'PERIPHERIE', aliases: ['Gbogbele'] },
  { name: 'Belle-ville', band: 'PERIPHERIE', aliases: ['Belleville'] },
  { name: 'Garage', band: 'PERIPHERIE' },
  { name: 'Manioc', band: 'PERIPHERIE' },
  { name: 'CAFOP', band: 'PERIPHERIE' },
  { name: 'Sud B', band: 'PERIPHERIE' },
  { name: 'Sud D', band: 'PERIPHERIE' },
  { name: 'Daloa-sud', band: 'PERIPHERIE', aliases: ['Daloa sud'] },
];

export type NeighbourhoodZone = {
  id: string;
  name: string;
  fee: number;
  neighbourhoods?: string[];
};

/**
 * Zone de livraison qui dessert un quartier donné.
 *
 * Utilisé à la fois par le serveur (calcul du tarif réel) et par le navigateur
 * (affichage du prix avant validation) : les deux arrivent donc forcément au
 * même résultat.
 */
export function pickLocalZone<T extends NeighbourhoodZone>(zones: T[], neighbourhood: string): T | null {
  const local = zones.filter((zone) => (zone as { isPickup?: boolean }).isPickup !== true);
  if (local.length === 0) return null;

  const target = normalizePlace(neighbourhood);
  if (!target) return null;

  // 1. Le quartier connu de Daloa tranche : sa bande (centre / périphérie)
  //    désigne la zone, même si une liste enregistrée en base est trop large
  //    (ancien paramétrage qui recopiait tous les quartiers dans chaque zone).
  const band = findNeighbourhood(neighbourhood)?.band ?? null;
  if (band) {
    const needle = band === 'PERIPHERIE' ? 'periph' : 'centre';
    const byBand = local.find((zone) => normalizePlace(zone.name).includes(needle));
    if (byBand) return byBand;
  }

  // 2. Sinon, la liste de quartiers saisie dans l'administration fait foi.
  const exact = local.find((zone) => (zone.neighbourhoods ?? []).some((name) => normalizePlace(name) === target));
  if (exact) return exact;

  return [...local].sort((a, b) => a.fee - b.fee)[0] ?? null;
}

/** Nombre de quartiers proposés au client (diagnostic simple). */
export const DALOA_NEIGHBOURHOOD_COUNT = DALOA_NEIGHBOURHOODS.length;

/**
 * Bande desservie par une zone de livraison, d'après son nom
 * (« Daloa — livraison à domicile (centre) »). Sert à afficher la bonne liste de
 * quartiers sur la page livraison, sans dépendre d'un ancien paramétrage en base.
 */
export function bandFromZoneName(name: string): DaloaBand | null {
  const normalized = normalizePlace(name);
  if (normalized.includes('periph')) return 'PERIPHERIE';
  if (normalized.includes('centre')) return 'CENTRE';
  return null;
}

export function neighbourhoodsForBand(band: DaloaBand): string[] {
  return DALOA_NEIGHBOURHOODS.filter((entry) => entry.band === band).map((entry) => entry.name);
}

export const DALOA_BAND_LABELS: Record<DaloaBand, string> = {
  CENTRE: 'Daloa — centre',
  PERIPHERIE: 'Daloa — périphérie',
};

/** Compare deux noms de quartiers en ignorant accents, casse et tirets. */
export function normalizePlace(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function findNeighbourhood(value: string): DaloaNeighbourhood | null {
  const target = normalizePlace(value);
  if (!target) return null;
  return (
    DALOA_NEIGHBOURHOODS.find((entry) => normalizePlace(entry.name) === target) ??
    DALOA_NEIGHBOURHOODS.find((entry) => (entry.aliases ?? []).some((alias) => normalizePlace(alias) === target)) ??
    null
  );
}

/** Quartiers triés pour l'affichage (ordre alphabétique français). */
export function sortedNeighbourhoodNames(): string[] {
  return [...DALOA_NEIGHBOURHOODS]
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'fr'));
}
