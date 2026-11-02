'use client';

import { Phone, ShieldAlert } from 'lucide-react';
import { useSiteI18n } from './site-i18n';
import { FINAL_SALE_NOTICE, FINAL_SALE_NOTICE_SHORT } from '@/lib/store-policy';
import { cn } from '@/lib/utils';

/**
 * Mention imposée par le propriétaire, affichée sur tout le parcours d'achat.
 *
 * `variant="short"` : bandeau compact (fiche produit, panier).
 * `variant="full"` : encadré complet avec le renvoi vers le service client.
 */
export function PurchaseNotice({
  variant = 'full',
  className,
  phone,
}: {
  variant?: 'full' | 'short';
  className?: string;
  phone?: string | null;
}) {
  const { t } = useSiteI18n();
  const tel = phone?.replace(/\s/g, '');

  if (variant === 'short') {
    return (
      <p
        className={cn(
          'flex items-start gap-2 rounded-lg bg-accent-50 px-3 py-2 text-[12px] font-medium leading-relaxed text-navy-800 ring-1 ring-accent-200',
          className,
        )}
      >
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-accent-700" aria-hidden />
        <span>{t(FINAL_SALE_NOTICE_SHORT)}</span>
      </p>
    );
  }

  return (
    <div className={cn('rounded-lg border border-accent-300 bg-accent-50 p-3 text-sm text-navy-900', className)}>
      <p className="flex items-start gap-2 font-semibold">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden />
        <span>{t(FINAL_SALE_NOTICE)}</span>
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-navy-700">
        <Phone className="size-3.5 text-accent-700" aria-hidden />
        <span>{t('Service client :')}</span>
        {tel ? (
          <a href={`tel:${tel}`} className="font-bold text-navy-950 underline decoration-accent-500 underline-offset-2">
            {phone}
          </a>
        ) : (
          <a href="/contact" className="font-bold text-navy-950 underline decoration-accent-500 underline-offset-2">
            {t('nous contacter')}
          </a>
        )}
      </p>
    </div>
  );
}
