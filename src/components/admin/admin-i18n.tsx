'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { translate, type AdminTranslator } from '@/lib/i18n/admin';

/**
 * Contexte de langue des composants clients de l'administration.
 *
 * L'administration est en français seulement : le contexte existe pour que les
 * formulaires interactifs continuent d'appeler `t()` (interpolation des
 * variables `{clé}`), sans jamais changer de langue ni de sens de lecture.
 */
type AdminI18nValue = {
  locale: 'fr';
  dir: 'ltr';
  t: AdminTranslator;
};

const AdminI18nContext = createContext<AdminI18nValue>({
  locale: 'fr',
  dir: 'ltr',
  t: (text) => text,
});

export function AdminI18nProvider({ children }: { locale?: 'fr'; children: ReactNode }) {
  const value = useMemo<AdminI18nValue>(
    () => ({
      locale: 'fr',
      dir: 'ltr',
      t: (text, vars) => translate('fr', text, vars),
    }),
    [],
  );
  return <AdminI18nContext.Provider value={value}>{children}</AdminI18nContext.Provider>;
}

export function useAdminI18n(): AdminI18nValue {
  return useContext(AdminI18nContext);
}
