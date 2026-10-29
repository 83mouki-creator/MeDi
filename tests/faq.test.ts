import { describe, expect, it } from 'vitest';
import { faqHref, faqJsonLd, type FaqEntry } from '@/lib/faq';
import { DELIVERY_FAQ, DELIVERY_FAQ_FALLBACK_MESSAGE } from '@/lib/delivery-faq';
import { RETURNS_FAQ, RETURNS_FAQ_FALLBACK_MESSAGE } from '@/lib/returns-faq';
import { whatsappLink, type PublicSettings } from '@/lib/settings';

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

const BLOCKS: { name: string; entries: readonly FaqEntry[]; fallback: string }[] = [
  { name: 'livraisons et expéditions', entries: DELIVERY_FAQ, fallback: DELIVERY_FAQ_FALLBACK_MESSAGE },
  { name: 'retours et remboursements', entries: RETURNS_FAQ, fallback: RETURNS_FAQ_FALLBACK_MESSAGE },
];

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

  it('n’invente aucun numéro ni délai garanti', () => {
    const text = DELIVERY_FAQ.map((entry) => `${entry.question} ${entry.answer}`).join(' ');
    expect(text).not.toMatch(/24h|48h|jours ouvrés|garanti en \d/i);
  });
});

describe('FAQ retours et remboursements', () => {
  it('comporte cinq questions distinctes sur la politique de retour', () => {
    expect(RETURNS_FAQ).toHaveLength(5);
    expect(new Set(RETURNS_FAQ.map((entry) => entry.id)).size).toBe(5);
    expect(new Set(RETURNS_FAQ.map((entry) => entry.question)).size).toBe(5);
    for (const entry of RETURNS_FAQ) {
      expect(entry.question.length).toBeGreaterThan(10);
      expect(entry.answer.length).toBeGreaterThan(120);
    }
  });

  it('couvre la demande, l’éligibilité, le produit abîmé, le remboursement et les frais', () => {
    const ids = RETURNS_FAQ.map((entry) => entry.id);
    expect(ids).toEqual(['demande-retour', 'produits-eligibles', 'produit-abime', 'remboursement', 'frais-retour']);
  });

  it('n’invente ni durée de retour, ni barème de frais', () => {
    const text = RETURNS_FAQ.map((entry) => `${entry.question} ${entry.answer}`).join(' ');
    // Aucune fenêtre de rétractation chiffrée, aucun montant de frais de retour.
    expect(text).not.toMatch(/\b(7|14|15|30)\s*(jours|j)\b/i);
    expect(text).not.toMatch(/\d[\s\u202f]?\d{3}\s*FCFA/i);
  });
});

describe('FAQ — routage WhatsApp et données structurées', () => {
  it('route chaque réponse des deux blocs vers le WhatsApp de la boutique', () => {
    for (const block of BLOCKS) {
      for (const entry of block.entries) {
        const href = faqHref(settings, entry);
        expect(href).toBeTruthy();
        expect(href!.startsWith('https://wa.me/2250708904891?text=')).toBe(true);
        expect(decodeURIComponent(href!)).toContain(entry.whatsappMessage);
      }
      expect(whatsappLink(settings, block.fallback)!.startsWith('https://wa.me/2250708904891?text=')).toBe(true);
    }
  });

  it('expose chaque bloc en données structurées FAQPage', () => {
    for (const block of BLOCKS) {
      const jsonLd = faqJsonLd(block.entries, settings);
      expect(jsonLd['@type']).toBe('FAQPage');
      expect(jsonLd.mainEntity).toHaveLength(block.entries.length);
      for (const question of jsonLd.mainEntity) {
        expect(question.name).toBeTruthy();
        expect(question.acceptedAnswer.text).toContain(settings.whatsapp!);
      }
    }
  });

  it('retombe sur le formulaire de contact quand le WhatsApp n’est pas configuré', () => {
    const withoutWhatsapp = { ...settings, whatsapp: null } as PublicSettings;
    for (const block of BLOCKS) {
      for (const entry of block.entries) {
        expect(faqHref(withoutWhatsapp, entry)).toBeNull();
      }
      expect(whatsappLink(withoutWhatsapp, block.fallback)).toBeNull();
    }
  });
});
