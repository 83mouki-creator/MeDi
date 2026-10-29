import { describe, expect, it } from 'vitest';
import {
  DELIVERY_FAQ,
  deliveryFaqFallbackHref,
  deliveryFaqHref,
  deliveryFaqJsonLd,
} from '@/lib/delivery-faq';
import type { PublicSettings } from '@/lib/settings';

const settings = {
  storeName: 'MeDi',
  tagline: null,
  phone: '+225 07 08 90 48 91',
  whatsapp: '+225 07 08 90 48 91',
  email: null,
  addressLine: null,
  city: 'Daloa',
  country: 'Côte d’Ivoire',
  openingHours: 'Lundi – samedi : 7h30 – 18h00 · Dimanche : fermé',
  whatsappDefaultMessage: null,
} as unknown as PublicSettings;

describe('FAQ livraisons et expéditions', () => {
  it('comporte exactement cinq questions distinctes', () => {
    expect(DELIVERY_FAQ).toHaveLength(5);
    expect(new Set(DELIVERY_FAQ.map((entry) => entry.id)).size).toBe(5);
    expect(new Set(DELIVERY_FAQ.map((entry) => entry.question)).size).toBe(5);
    for (const entry of DELIVERY_FAQ) {
      expect(entry.question.length).toBeGreaterThan(10);
      expect(entry.answer.length).toBeGreaterThan(120);
    }
  });

  it('route chaque réponse vers le WhatsApp de la boutique', () => {
    for (const entry of DELIVERY_FAQ) {
      const href = deliveryFaqHref(settings, entry);
      expect(href).toBeTruthy();
      expect(href!.startsWith('https://wa.me/2250708904891?text=')).toBe(true);
      expect(decodeURIComponent(href!)).toContain(entry.whatsappMessage);
    }
    expect(deliveryFaqFallbackHref(settings)!.startsWith('https://wa.me/2250708904891?text=')).toBe(true);
  });

  it('n’invente aucun numéro ni délai garanti', () => {
    const text = DELIVERY_FAQ.map((entry) => `${entry.question} ${entry.answer}`).join(' ');
    expect(text).not.toMatch(/24h|48h|jours ouvrés|garanti en \d/i);
  });

  it('expose les cinq questions en données structurées FAQPage', () => {
    const jsonLd = deliveryFaqJsonLd(settings);
    expect(jsonLd['@type']).toBe('FAQPage');
    expect(jsonLd.mainEntity).toHaveLength(5);
    for (const question of jsonLd.mainEntity) {
      expect(question.name).toBeTruthy();
      expect(question.acceptedAnswer.text).toContain(settings.whatsapp!);
    }
  });

  it('retombe sur le formulaire de contact quand le WhatsApp n’est pas configuré', () => {
    const withoutWhatsapp = { ...settings, whatsapp: null } as PublicSettings;
    for (const entry of DELIVERY_FAQ) {
      expect(deliveryFaqHref(withoutWhatsapp, entry)).toBeNull();
    }
    expect(deliveryFaqFallbackHref(withoutWhatsapp)).toBeNull();
  });
});
