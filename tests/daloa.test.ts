import { describe, expect, it } from 'vitest';
import { DALOA_NEIGHBOURHOODS, bandFromZoneName, neighbourhoodsForBand, pickLocalZone } from '@/lib/daloa';

/** Deux zones, comme dans l'administration : centre 1 000 F, périphérie 2 000 F. */
const ZONES = [
  { id: 'centre', name: 'Daloa — livraison à domicile (centre)', fee: 1000, neighbourhoods: neighbourhoodsForBand('CENTRE') },
  { id: 'peripherie', name: 'Daloa — livraison à domicile (périphérie)', fee: 2000, neighbourhoods: neighbourhoodsForBand('PERIPHERIE') },
];

/** Ancien paramétrage fautif : chaque zone recopiait la liste entière. */
const STALE = ZONES.map((zone) => ({ ...zone, neighbourhoods: DALOA_NEIGHBOURHOODS.map((entry) => entry.name) }));

describe('Quartiers de Daloa', () => {
  it('liste les quartiers connus, sans doublon', () => {
    const names = DALOA_NEIGHBOURHOODS.map((entry) => entry.name);
    expect(names.length).toBeGreaterThan(40);
    expect(new Set(names).size).toBe(names.length);
  });

  it('rattache un quartier à la bonne zone, et donc au bon tarif', () => {
    expect(pickLocalZone(ZONES, 'Commerce')?.fee).toBe(1000);
    expect(pickLocalZone(ZONES, 'Orly 2')?.fee).toBe(2000);
    expect(pickLocalZone(ZONES, 'Kennedy')?.fee).toBe(2000);
  });

  it('ignore une liste enregistrée qui recopie tous les quartiers dans chaque zone', () => {
    // Le quartier tranche sur la liste : sans cela, la périphérie serait
    // facturée au tarif du centre.
    expect(pickLocalZone(STALE, 'Abattoir 1')?.id).toBe('peripherie');
    expect(pickLocalZone(STALE, 'Dioulabougou')?.id).toBe('centre');
  });

  it('accepte les variantes d’écriture', () => {
    expect(pickLocalZone(ZONES, 'gbogbele')?.id).toBe('peripherie');
    expect(pickLocalZone(ZONES, '  daloa sud ')?.id).toBe('peripherie');
  });

  it('reconnaît la bande d’une zone d’après son nom', () => {
    expect(bandFromZoneName('Daloa — livraison à domicile (centre)')).toBe('CENTRE');
    expect(bandFromZoneName('Daloa — livraison à domicile (périphérie)')).toBe('PERIPHERIE');
    expect(bandFromZoneName('Retrait en boutique — Daloa')).toBeNull();
  });

  it('donne deux listes de quartiers distinctes et complètes', () => {
    const centre = neighbourhoodsForBand('CENTRE');
    const peripherie = neighbourhoodsForBand('PERIPHERIE');
    expect(centre.some((name) => peripherie.includes(name))).toBe(false);
    expect(centre.length + peripherie.length).toBe(DALOA_NEIGHBOURHOODS.length);
  });
});
