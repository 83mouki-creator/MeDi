import { describe, expect, it } from 'vitest';
import {
  COLIS_EXPRESS_CARRIER,
  COLIS_EXPRESS_STEPS,
  isValidTrackingCode,
  normaliseTrackingCode,
  shipmentStatusFromProvider,
  SHIPMENT_STATUS_LABELS,
  stepIndexForStatus,
  trackingUrl,
} from '@/lib/colis-express';

describe('Colis Express — codes de suivi', () => {
  it('accepte le format remis au guichet', () => {
    expect(isValidTrackingCode('CLI-AB12CD')).toBe(true);
    expect(isValidTrackingCode('CLI-123456')).toBe(true);
    // Le code est souvent dicté au téléphone : casse et espaces ne comptent pas.
    expect(normaliseTrackingCode('cli-ab12cd')).toBe('CLI-AB12CD');
    expect(normaliseTrackingCode(' CLI AB12CD ')).toBe('CLI-AB12CD');
    // Sans tiret, on le remet : c'est la forme attendue par le prestataire.
    expect(normaliseTrackingCode('CLIAB12CD')).toBe('CLI-AB12CD');
  });

  it('refuse un code qui ne mène à aucun colis', () => {
    expect(normaliseTrackingCode('')).toBeNull();
    expect(normaliseTrackingCode('CLI-')).toBeNull();
    expect(normaliseTrackingCode('CLI-AB12C')).toBeNull();
    expect(normaliseTrackingCode('CLI-AB12CDE')).toBeNull();
    expect(normaliseTrackingCode('MEDI-123456')).toBeNull();
  });

  it('construit un lien de suivi qui pointe sur la page publique', () => {
    const url = trackingUrl('CLI-AB12CD');
    expect(url).toContain('/suivi.html?code=CLI-AB12CD');
  });
});

describe('Colis Express — statuts', () => {
  it('traduit les libellés du transporteur dans notre vocabulaire', () => {
    expect(shipmentStatusFromProvider('Expédié')).toBe('DISPATCHED');
    expect(shipmentStatusFromProvider('En transit')).toBe('IN_TRANSIT');
    expect(shipmentStatusFromProvider('En cours de livraison')).toBe('IN_TRANSIT');
    expect(shipmentStatusFromProvider('Arrivé à l’agence de Daloa')).toBe('ARRIVED');
    expect(shipmentStatusFromProvider('Retiré par le client')).toBe('DELIVERED');
    expect(shipmentStatusFromProvider('Livré')).toBe('DELIVERED');
    expect(shipmentStatusFromProvider('Retourné à l’expéditeur')).toBe('RETURNED');
  });

  it('ne casse pas quand le transporteur ne dit rien d’exploitable', () => {
    expect(shipmentStatusFromProvider(null)).toBe('DISPATCHED');
    expect(shipmentStatusFromProvider('')).toBe('DISPATCHED');
    expect(shipmentStatusFromProvider('étape inconnue')).toBe('IN_TRANSIT');
  });

  it('situe chaque statut sur les quatre étapes montrées au client', () => {
    expect(COLIS_EXPRESS_STEPS).toEqual(['Expédié', 'En transit', 'Arrivé', 'Retiré']);
    expect(stepIndexForStatus('PENDING')).toBe(0);
    expect(stepIndexForStatus('DISPATCHED')).toBe(0);
    expect(stepIndexForStatus('IN_TRANSIT')).toBe(1);
    expect(stepIndexForStatus('ARRIVED')).toBe(2);
    expect(stepIndexForStatus('DELIVERED')).toBe(3);
    // Un retour n'est pas une étape du parcours : la frise est remplacée par un message.
    expect(stepIndexForStatus('RETURNED')).toBe(-1);
    // Chaque statut interne a un libellé lisible par l'équipe.
    for (const status of ['PENDING', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'RETURNED'] as const) {
      expect(SHIPMENT_STATUS_LABELS[status].length).toBeGreaterThan(3);
    }
  });

  it('l’identifiant du transporteur est stable (il est stocké en base)', () => {
    expect(COLIS_EXPRESS_CARRIER).toBe('COLIS_EXPRESS');
  });
});
