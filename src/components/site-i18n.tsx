'use client';

import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_SITE_LOCALE, siteTranslator, type SiteLocale, type SiteTranslator } from '@/lib/i18n/site';

type SiteI18nValue = {
  locale: SiteLocale;
  dir: 'ltr';
  t: SiteTranslator;
};

const SiteI18nContext = createContext<SiteI18nValue>({
  locale: DEFAULT_SITE_LOCALE,
  dir: 'ltr',
  t: siteTranslator(DEFAULT_SITE_LOCALE),
});

/**
 * Met les textes de la boutique à disposition des composants clients.
 *
 * La vitrine est en français uniquement : le contexte existe pour que les
 * composants continuent d'appeler `t('…', { variables })` sans se soucier de la
 * langue.
 */
export function SiteI18nProvider({ children }: { locale?: SiteLocale; children: React.ReactNode }) {
  const value = useMemo<SiteI18nValue>(
    () => ({ locale: 'fr', dir: 'ltr', t: siteTranslator('fr') }),
    [],
  );
  return <SiteI18nContext.Provider value={value}>{children}</SiteI18nContext.Provider>;
}

export function useSiteI18n(): SiteI18nValue {
  return useContext(SiteI18nContext);
}

/** Raccourci pour les composants qui n'ont besoin que du traducteur. */
export function useSiteT(): SiteTranslator {
  return useContext(SiteI18nContext).t;
}
