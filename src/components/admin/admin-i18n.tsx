'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { adminDir, translate, type AdminLocale, type AdminTranslator } from '@/lib/i18n/admin';

type AdminI18nValue = {
  locale: AdminLocale;
  dir: 'ltr' | 'rtl';
  t: AdminTranslator;
};

const AdminI18nContext = createContext<AdminI18nValue>({
  locale: 'fr',
  dir: 'ltr',
  t: (text) => text,
});

/**
 * Contexte de langue des composants clients de l'administration.
 * Les pages serveur appellent `getAdminI18n()` directement ; ce fournisseur
 * sert aux formulaires interactifs (fiche produit, réglages, filtres…).
 */
export function AdminI18nProvider({ locale, children }: { locale: AdminLocale; children: ReactNode }) {
  const value = useMemo<AdminI18nValue>(
    () => ({
      locale,
      dir: adminDir(locale),
      t: (text, vars) => translate(locale, text, vars),
    }),
    [locale],
  );
  return <AdminI18nContext.Provider value={value}>{children}</AdminI18nContext.Provider>;
}

export function useAdminI18n(): AdminI18nValue {
  return useContext(AdminI18nContext);
}
