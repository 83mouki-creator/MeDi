import { translate, type AdminTranslator } from './admin';

/**
 * Traductions du back-office.
 *
 * L'administration est en français uniquement : plus de cookie de langue, plus
 * de dictionnaire, plus d'affichage de droite à gauche. Les pages appellent
 * `getAdminI18n()` et utilisent `t()` pour les variables `{clé}`.
 */
export type AdminI18n = {
  locale: 'fr';
  dir: 'ltr';
  t: AdminTranslator;
};

export async function getAdminI18n(): Promise<AdminI18n> {
  return {
    locale: 'fr',
    dir: 'ltr',
    t: (text, vars) => translate('fr', text, vars),
  };
}
