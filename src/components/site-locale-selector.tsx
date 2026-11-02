'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Loader2 } from 'lucide-react';
import { setSiteLocaleAction } from '@/app/actions/site-locale';
import {
  SITE_LOCALES,
  SITE_LOCALE_LABELS,
  SITE_LOCALE_SHORT,
  SITE_LOCALE_SWITCH_LABEL,
  type SiteLocale,
} from '@/lib/i18n/site';
import { useSiteI18n } from './site-i18n';
import { cn } from '@/lib/utils';

/**
 * Sélecteur FR / EN / ع.
 *
 * Le choix est enregistré dans un cookie côté serveur puis l'arbre est
 * rafraîchi : le changement s'applique immédiatement, sans perdre le panier ni
 * la page en cours. Utilisable en clair comme sur fond bleu nuit.
 */
export function SiteLocaleSelector({ tone = 'dark', className }: { tone?: 'dark' | 'light'; className?: string }) {
  const { locale, t } = useSiteI18n();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const change = (next: SiteLocale) => {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setSiteLocaleAction(next);
      router.refresh();
    });
  };

  return (
    <div
      role="group"
      aria-label={t(SITE_LOCALE_SWITCH_LABEL[locale])}
      className={cn(
        'inline-flex items-center gap-1 rounded-full p-0.5',
        tone === 'dark' ? 'bg-navy-900/80 ring-1 ring-navy-700' : 'bg-white ring-1 ring-navy-200',
        className,
      )}
    >
      <Globe
        className={cn('ms-1.5 size-3.5', tone === 'dark' ? 'text-accent-300' : 'text-navy-500')}
        aria-hidden
      />
      {SITE_LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => change(code)}
            aria-pressed={active}
            aria-label={SITE_LOCALE_LABELS[code]}
            title={SITE_LOCALE_LABELS[code]}
            disabled={pending}
            className={cn(
              'rounded-full px-2 py-1 text-[11px] font-bold leading-none transition-colors',
              active
                ? 'bg-accent-500 text-navy-950'
                : tone === 'dark'
                  ? 'text-navy-200 hover:bg-navy-800 hover:text-white'
                  : 'text-navy-600 hover:bg-navy-50 hover:text-navy-900',
            )}
          >
            {SITE_LOCALE_SHORT[code]}
          </button>
        );
      })}
      {pending ? <Loader2 className="me-1.5 size-3.5 animate-spin text-accent-400" aria-hidden /> : null}
    </div>
  );
}
