/**
 * Langue de la boutique.
 *
 * La vitrine est **entièrement en français** : c'est la langue de la clientèle
 * ivoirienne visée, et le propriétaire a demandé une interface sans arabe.
 *
 * Ce module ne contient donc plus de dictionnaire de traduction. Il conserve
 * l'API `t()` utilisée par toutes les pages publiques, pour deux raisons :
 *
 *  • les textes restent écrits en clair dans les pages (aucune indirection) ;
 *  • `t()` interpole les variables (`{count}`, `{city}`…), ce qui évite de
 *    recoller des morceaux de phrases dans les composants.
 *
 * Aucun cookie de langue n'est plus lu : la boutique ne change pas de langue,
 * et l'affichage reste toujours de gauche à droite.
 */

export type SiteLocale = 'fr';

export const SITE_LOCALES: SiteLocale[] = ['fr'];
export const DEFAULT_SITE_LOCALE: SiteLocale = 'fr';

/** Sens de lecture : toujours de gauche à droite. */
export function siteDir(_locale: SiteLocale = 'fr'): 'ltr' {
  return 'ltr';
}

/** Langue déclarée dans `<html lang>` (français de Côte d'Ivoire). */
export function siteHtmlLang(_locale: SiteLocale = 'fr'): string {
  return 'fr-CI';
}

export function isSiteLocale(value: unknown): value is SiteLocale {
  return value === 'fr';
}

export type TranslationVars = Record<string, string | number>;

/** Remplace `{clé}` par sa valeur ; laisse le texte intact si la clé manque. */
export function interpolate(text: string, vars?: TranslationVars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  );
}

/** Traduction : le français est la langue source, le texte est rendu tel quel. */
export function translate(_locale: SiteLocale, text: string, vars?: TranslationVars): string {
  return interpolate(text, vars);
}

/** Traducteur lié à la langue, pratique à passer aux composants. */
export type SiteTranslator = (text: string, vars?: TranslationVars) => string;

export function siteTranslator(_locale: SiteLocale = 'fr'): SiteTranslator {
  return (text, vars) => interpolate(text, vars);
}

/** Diagnostic : la boutique n'a plus qu'une langue. */
export function siteStringCounts() {
  return { fr: 'source' } as const;
}
