import { interpolate, type SiteTranslator } from './site';

/**
 * Traductions de la vitrine.
 *
 * La boutique est en français uniquement : plus de cookie de langue, plus de
 * dictionnaire, plus d'affichage de droite à gauche. Les pages appellent
 * `getSiteI18n()` et utilisent `t()` pour interpoler les variables `{clé}`.
 */
export type SiteI18n = {
  locale: 'fr';
  dir: 'ltr';
  t: SiteTranslator;
};

export async function getSiteI18n(): Promise<SiteI18n> {
  return {
    locale: 'fr',
    dir: 'ltr',
    t: (text, vars) => interpolate(text, vars),
  };
}

/** Compatibilité : certaines pages lisent directement la langue courante. */
export async function getSiteLocale(): Promise<'fr'> {
  return 'fr';
}
