import 'server-only';
import { cookies } from 'next/headers';
import {
  DEFAULT_SITE_LOCALE,
  SITE_LOCALE_COOKIE,
  isSiteLocale,
  siteDir,
  siteHtmlLang,
  siteTranslator,
  type SiteLocale,
  type SiteTranslator,
} from './site';

/**
 * Langue choisie par le visiteur, lue dans le cookie.
 *
 * Aucune détection automatique : un visiteur qui n'a jamais choisi de langue
 * voit le site en français, quelle que soit la langue de son navigateur.
 */
export async function getSiteLocale(): Promise<SiteLocale> {
  try {
    const store = await cookies();
    const value = store.get(SITE_LOCALE_COOKIE)?.value;
    return isSiteLocale(value) ? value : DEFAULT_SITE_LOCALE;
  } catch {
    return DEFAULT_SITE_LOCALE;
  }
}

export type SiteI18n = {
  locale: SiteLocale;
  dir: 'ltr' | 'rtl';
  htmlLang: string;
  t: SiteTranslator;
};

export async function getSiteI18n(): Promise<SiteI18n> {
  const locale = await getSiteLocale();
  return {
    locale,
    dir: siteDir(locale),
    htmlLang: siteHtmlLang(locale),
    t: siteTranslator(locale),
  };
}
