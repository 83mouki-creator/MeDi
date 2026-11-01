'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ADMIN_LOCALE_COOKIE, ADMIN_LOCALE_MAX_AGE, isAdminLocale } from '@/lib/i18n/admin';

/**
 * Bascule FR / AR du back-office.
 *
 * Le choix est mémorisé dans un cookie : il survit à la déconnexion et ne
 * concerne jamais la boutique publique, qui reste en français.
 */
export async function setAdminLocaleAction(formData: FormData): Promise<void> {
  const value = String(formData.get('locale') ?? '');
  if (!isAdminLocale(value)) return;

  const store = await cookies();
  store.set(ADMIN_LOCALE_COOKIE, value, {
    path: '/',
    maxAge: ADMIN_LOCALE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });

  const next = String(formData.get('next') ?? '');
  revalidatePath(next.startsWith('/admin') ? next : '/admin');
  revalidatePath('/admin');
}
