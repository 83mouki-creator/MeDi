import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { getActiveBanner } from '@/lib/promos';
import { getSiteI18n } from '@/lib/i18n/site-server';

/**
 * Bandeau d'annonce d'une promotion en cours.
 *
 * Le texte vient de l'administration (création d'une opération) : il s'affiche
 * tel que le propriétaire l'a écrit. Rien ne s'affiche si aucune opération
 * n'est en cours — pas de bandeau vide, pas de faux compte à rebours.
 */
export async function PromoBanner() {
  const [banner, { t }] = await Promise.all([getActiveBanner().catch(() => null), getSiteI18n()]);
  if (!banner) return null;

  const endsOn = banner.endsAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' });

  return (
    <div className="bg-accent-500 text-navy-950">
      <Link href="/catalogue?promo=1" className="container-page flex flex-wrap items-center justify-center gap-x-2 gap-y-1 py-2 text-center text-[13px] font-bold hover:underline">
        <Sparkles className="size-4 shrink-0" aria-hidden />
        <span>{banner.text}</span>
        <span className="text-[11px] font-semibold text-navy-800">
          {t('Jusqu’au {date}', { date: endsOn })}
        </span>
      </Link>
    </div>
  );
}
