import { whatsappLink, type PublicSettings } from './settings';

/**
 * Socle commun des FAQ de la boutique.
 *
 * Chaque réponse se termine par un renvoi vers le WhatsApp de la boutique :
 * aucun délai, tarif ni cas d'éligibilité n'est inventé dans le texte.
 */
export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  /** Message pré-rempli du WhatsApp ouvert depuis cette réponse. */
  whatsappMessage: string;
};

export function faqHref(settings: PublicSettings, entry: FaqEntry) {
  return whatsappLink(settings, entry.whatsappMessage);
}

/** Fonction de rendu : traduit et remplit les variables d'une chaîne. */
export type FaqRender = (text: string) => string;

/**
 * Données structurées FAQPage (SEO) construites depuis la même liste.
 * `render` permet de publier la version traduite, dans la langue du visiteur.
 */
export function faqJsonLd(entries: readonly FaqEntry[], settings: PublicSettings, render: FaqRender = (text) => text) {
  const phone = settings.whatsapp
    ? ` Pour toute question, contactez la boutique sur WhatsApp au ${settings.whatsapp}.`
    : '';
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: render(entry.question),
      acceptedAnswer: {
        '@type': 'Answer',
        text: `${render(entry.answer)}${phone}`,
      },
    })),
  };
}
