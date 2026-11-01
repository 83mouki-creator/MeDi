import { cookies } from 'next/headers';
import {
  ADMIN_LOCALE_COOKIE,
  adminDir,
  isAdminLocale,
  translate,
  type AdminLocale,
  type AdminTranslator,
} from './admin';

export type AdminI18n = {
  locale: AdminLocale;
  dir: 'ltr' | 'rtl';
  t: AdminTranslator;
};

/**
 * Langue du back-office, lue dans le cookie et valable pour la seule
 * administration : la boutique n'est jamais traduite.
 */
export async function getAdminI18n(): Promise<AdminI18n> {
  const store = await cookies();
  const raw = store.get(ADMIN_LOCALE_COOKIE)?.value;
  const locale: AdminLocale = isAdminLocale(raw) ? raw : 'fr';
  return {
    locale,
    dir: adminDir(locale),
    t: (text, vars) => translate(locale, text, vars),
  };
}
