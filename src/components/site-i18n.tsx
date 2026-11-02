'use client';

import { createContext, useContext, useMemo } from 'react';
import {
  DEFAULT_SITE_LOCALE,
  siteDir,
  siteTranslator,
  type SiteLocale,
  type SiteTranslator,
} from '@/lib/i18n/site';

type SiteI18nValue = {
  locale: SiteLocale;
  dir: 'ltr' | 'rtl';
  t: SiteTranslator;
};

const SiteI18nContext = createContext<SiteI18nValue>({
  locale: DEFAULT_SITE_LOCALE,
  dir: 'ltr',
  t: siteTranslator(DEFAULT_SITE_LOCALE),
});

/**
 * Met la langue de la boutique à disposition des composants clients.
 * La valeur vient du layout serveur (cookie), donc un changement de langue
 * rafraîchit l'ensemble de l'arbre en une seule fois.
 */
export function SiteI18nProvider({ locale, children }: { locale: SiteLocale; children: React.ReactNode }) {
  const value = useMemo<SiteI18nValue>(
    () => ({ locale, dir: siteDir(locale), t: siteTranslator(locale) }),
    [locale],
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
