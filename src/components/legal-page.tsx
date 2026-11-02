import type { ReactNode } from 'react';
import { getSiteI18n } from '@/lib/i18n/site-server';

/**
 * Mise en page commune aux pages légales (texte long, lisible, sobre).
 *
 * Les textes juridiques restent rédigés en français : c'est la langue
 * officielle de la Côte d'Ivoire et la seule version qui fait foi. Quand la
 * boutique est consultée en anglais ou en arabe, un bandeau traduit prévient
 * le lecteur, plutôt que de lui laisser croire à une traduction officielle.
 */
export async function LegalPage({
  title,
  updatedAt,
  intro,
  children,
}: {
  title: string;
  updatedAt?: string;
  intro?: string;
  children: ReactNode;
}) {
  const { locale, dir, t } = await getSiteI18n();

  return (
    <article className="container-page max-w-3xl py-8" dir={dir}>
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      {updatedAt ? (
        <p className="mt-1 text-xs text-navy-500">{t('Dernière mise à jour : {date}', { date: updatedAt })}</p>
      ) : null}
      {intro ? <p className="mt-3 text-sm leading-relaxed text-navy-700">{intro}</p> : null}
      {locale !== 'fr' ? (
        <p className="mt-4 rounded-lg border border-accent-200 bg-accent-50 p-3 text-xs leading-relaxed text-accent-900">
          {t(
            'Ce document juridique est établi en français, langue officielle de la Côte d’Ivoire : seule la version française fait foi. Une question ? Écrivez-nous sur WhatsApp, nous vous répondons dans votre langue.',
          )}
        </p>
      ) : null}
      <div className="mt-6 space-y-5 text-sm leading-relaxed text-navy-700">{children}</div>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 text-base font-bold text-navy-950">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
