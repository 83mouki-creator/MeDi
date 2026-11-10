/**
 * Langue du back-office.
 *
 * L'administration est **entièrement en français** : c'est la langue de travail
 * de la boutique et de son équipe. Ce module ne contient donc plus de dictionnaire
 * de traduction ; il conserve l'API `t()` utilisée par les pages et les
 * formulaires pour deux raisons :
 *
 *  • les libellés restent écrits en clair dans le code (aucune indirection
 *    inutile), et `t()` ne fait qu'y remplacer les variables `{clé}` ;
 *  • si une seconde langue devenait nécessaire un jour, il suffirait de
 *    remplacer l'implémentation de `translate` sans toucher aux pages.
 *
 * Aucun texte arabe n'est plus présent dans l'espace d'administration, et
 * l'affichage n'est jamais en écriture de droite à gauche.
 */

export type AdminLocale = 'fr';

export const ADMIN_LOCALE: AdminLocale = 'fr';

/** Sens de lecture : toujours de gauche à droite. */
export function adminDir(_locale: AdminLocale = 'fr'): 'ltr' {
  return 'ltr';
}

/** Libellé de la langue de l'administration (affiché dans les réglages). */
export function localeLabel(_locale: AdminLocale = 'fr'): string {
  return 'Français';
}

export type TranslationVars = Record<string, string | number>;

/**
 * Remplace `{clé}` par sa valeur dans un texte français.
 * Une clé absente est laissée telle quelle : un libellé incomplet se voit
 * immédiatement, sans casser l'affichage.
 */
export function translate(_locale: AdminLocale, text: string, vars?: TranslationVars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  );
}

export type AdminTranslator = (text: string, vars?: TranslationVars) => string;
