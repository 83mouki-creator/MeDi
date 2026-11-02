'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { SITE_LOCALE_COOKIE, SITE_LOCALE_MAX_AGE, isSiteLocale, type SiteLocale } from '@/lib/i18n/site';

/**
 * Change la langue de la boutique. Le cookie est posé côté serveur, puis toutes
 * les pages sont réactualisées : le changement est visible immédiatement, sans
 * rechargement manuel ni perte du panier.
 */
export async function setSiteLocaleAction(locale: string): Promise<{ locale: SiteLocale }> {
  const next: SiteLocale = isSiteLocale(locale) ? locale : 'fr';
  const store = await cookies();
  store.set(SITE_LOCALE_COOKIE, next, {
    path: '/',
    maxAge: SITE_LOCALE_MAX_AGE,
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
  return { locale: next };
}
