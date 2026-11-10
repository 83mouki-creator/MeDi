import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BookOpen,
  Boxes,
  Calculator,
  CircleHelp,
  ClipboardList,
  CreditCard,
  Languages,
  MessageSquare,
  Package,
  Printer,
  ScrollText,
  ShieldCheck,
  Tags,
  Truck,
  Users,
} from 'lucide-react';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { can, getCurrentUser } from '@/lib/auth';
import { ORDER_STATUS_LABELS } from '@/lib/order-status';
import { OUTSIDE_DALOA_MAX_DAYS, FINAL_SALE_NOTICE } from '@/lib/store-policy';
import { getStoreSettings } from '@/lib/settings';
import {
  GUIDE_GESTURES,
  GUIDE_INTRO,
  GUIDE_JOURNEY,
  GUIDE_JOURNEY_ACTION,
  GUIDE_PROBLEMS,
  GUIDE_ROUTINE,
  GUIDE_SECTIONS,
  GUIDE_SUMMARY,
  GUIDE_WORDS,
  type GuideIcon,
} from '@/lib/admin-guide';
import { Badge, Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Comment utiliser le site — guide de l’équipe',
};

/** Icône de chaque geste du guide, choisie ici pour garder le contenu sans JSX. */
const ICONS: Record<GuideIcon, typeof Calculator> = {
  cash: Calculator,
  payment: CreditCard,
  package: Package,
  message: MessageSquare,
  stock: Boxes,
  promo: Tags,
  print: Printer,
  users: Users,
  journal: ScrollText,
  truck: Truck,
};

export default async function AdminGuidePage() {
  const [{ t }, user, settings] = await Promise.all([getAdminI18n(), getCurrentUser(), getStoreSettings()]);
  const phone = settings.phone || '—';

  const routine = GUIDE_ROUTINE.filter((step) => !step.permission || can(user?.role, step.permission));
  const gestures = GUIDE_GESTURES.filter((gesture) => !gesture.permission || can(user?.role, gesture.permission));

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl bg-navy-950 p-5 text-white sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -end-24 -top-28 size-72 rounded-full bg-accent-500/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 end-0 w-1.5 bg-accent-500" />
        <div className="relative">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-accent-300">
            <BookOpen className="size-3.5" aria-hidden /> {t('Guide de l’équipe')}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{t('Comment utiliser le site Perokado')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-navy-200">
            {t('Ce guide tient en cinq minutes. Il explique le chemin d’une commande, ce que vous faites chaque jour, et quoi faire quand quelque chose bloque. Aucun mot compliqué.')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/admin/commandes"
              className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-3.5 py-2 text-sm font-bold text-navy-950 hover:bg-accent-400"
            >
              <ClipboardList className="size-4" aria-hidden /> {t('Voir les commandes')}
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/20"
            >
              {t('Voir la boutique')} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      {/* Sommaire */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-sm font-bold text-navy-900">{t('Dans ce guide')}</h2>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDE_SECTIONS.map((section, index) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="flex items-start gap-2.5 rounded-lg border border-navy-100 p-2.5 text-sm font-medium text-navy-800 hover:border-accent-300 hover:bg-accent-50/50"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-navy-950 text-[11px] font-bold text-accent-400">
                  {index + 1}
                </span>
                {t(section.label)}
              </a>
            </li>
          ))}
        </ol>
      </Card>

      {/* 1. Comprendre */}
      <Card className="p-4 sm:p-5" id="comprendre">
        <div className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-950 text-sm font-bold text-accent-400">1</span>
          <h2 className="text-lg font-extrabold text-navy-950">{t('Comprendre le site en une minute')}</h2>
        </div>
        <p className="mt-2 text-sm text-navy-600">
          {t('Le site Perokado sert à deux choses : montrer vos produits aux clients, et vous dire exactement ce qu’il faut préparer. Voici le trajet complet, du clic du client jusqu’au colis remis.')}
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {GUIDE_INTRO.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-navy-100 bg-navy-50/40 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-500 text-[11px] font-bold text-navy-950">
                  {index + 1}
                </span>
                {t(step.title)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-navy-600">{t(step.text)}</p>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-navy-600">
          <Badge tone="accent">{t('Livraison à domicile uniquement')}</Badge>
          <Badge tone="neutral">{t('Hors Daloa : {days} jours maximum', { days: OUTSIDE_DALOA_MAX_DAYS })}</Badge>
          <Badge tone="success">{t('Transport hors Daloa convenu sur WhatsApp')}</Badge>
        </div>
      </Card>

      {/* 2. Parcours */}
      <Card className="p-4 sm:p-5" id="parcours">
        <div className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-950 text-sm font-bold text-accent-400">2</span>
          <h2 className="text-lg font-extrabold text-navy-950">{t('Le voyage d’une commande')}</h2>
        </div>
        <p className="mt-2 text-sm text-navy-600">
          {t('Une commande passe par neuf étapes. À chacune correspond une seule action de votre part : c’est écrit à droite.')}
        </p>
        <ol className="mt-4 space-y-0">
          {GUIDE_JOURNEY.map((status, index) => (
            <li key={status} className="relative flex gap-3 pb-3 last:pb-0">
              <div className="flex flex-col items-center">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-500 text-xs font-bold text-navy-950">
                  {index + 1}
                </span>
                {index < GUIDE_JOURNEY.length - 1 ? <span className="mt-1 w-px flex-1 bg-navy-100" aria-hidden /> : null}
              </div>
              <div className="min-w-0 flex-1 rounded-lg border border-navy-100 bg-white p-2.5">
                <p className="text-sm font-semibold text-navy-900">{t(ORDER_STATUS_LABELS[status])}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-navy-600">{t(GUIDE_JOURNEY_ACTION[status])}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 rounded-lg bg-navy-50 p-3 text-xs text-navy-600">
          {t('Dit autrement : « {example} » signifie « {meaning} ». Le site emploie les mots de la boutique, pas des codes.', {
            example: t('J’ai donné le colis au transporteur'),
            meaning: t('Expédiée'),
          })}
        </p>
      </Card>

      {/* 3. Routine */}
      <Card className="p-4 sm:p-5" id="routine">
        <div className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-950 text-sm font-bold text-accent-400">3</span>
          <h2 className="text-lg font-extrabold text-navy-950">{t('Votre routine du jour')}</h2>
        </div>
        <p className="mt-2 text-sm text-navy-600">
          {t('Cinq gestes, dans cet ordre. Si vous ne faites que cela, la boutique tourne.')}
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {routine.map((step) => {
            const Icon = ICONS[step.icon];
            return (
              <li key={step.title}>
                <Link href={step.href} className="flex h-full items-start gap-3 rounded-xl border border-navy-100 p-3 hover:border-accent-300 hover:bg-accent-50/40">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-700">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-navy-900">{t(step.title)}</span>
                    <span className="mt-0.5 block text-xs text-navy-600">{t(step.text)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* 4. Gestes utiles */}
      <Card className="p-4 sm:p-5" id="gestes">
        <div className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-950 text-sm font-bold text-accent-400">4</span>
          <h2 className="text-lg font-extrabold text-navy-950">{t('Les gestes utiles')}</h2>
        </div>
        <p className="mt-2 text-sm text-navy-600">{t('Six outils, chacun avec un seul but. Appuyez sur la carte pour y aller.')}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {gestures.map((gesture) => {
            const Icon = ICONS[gesture.icon];
            return (
              <Link
                key={gesture.title}
                href={gesture.href}
                className="group flex h-full flex-col rounded-xl border border-navy-100 p-3 transition hover:-translate-y-0.5 hover:border-accent-300 hover:shadow-sm"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-accent-100 text-accent-800">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="mt-2 text-sm font-semibold text-navy-900">{t(gesture.title)}</span>
                <span className="mt-0.5 text-xs leading-relaxed text-navy-600">{t(gesture.text)}</span>
              </Link>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-navy-100 bg-navy-50/50 p-3 text-xs text-navy-700">
          <Languages className="size-4 shrink-0 text-accent-700" aria-hidden />
          <p className="min-w-0 flex-1">
            {t('Langue : le site et l’administration sont entièrement en français. Il n’y a plus de sélecteur de langue à régler : tout le monde voit les mêmes textes.')}
          </p>
        </div>
      </Card>

      {/* 5. Lexique */}
      <Card className="p-4 sm:p-5" id="mots">
        <div className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-950 text-sm font-bold text-accent-400">5</span>
          <h2 className="text-lg font-extrabold text-navy-950">{t('Les mots de l’écran')}</h2>
        </div>
        <dl className="mt-3 divide-y divide-navy-100">
          {GUIDE_WORDS.map((entry) => (
            <div key={entry.word} className="grid gap-1 py-2.5 sm:grid-cols-[13rem_1fr] sm:gap-3">
              <dt className="text-sm font-semibold text-navy-900">{t(entry.word)}</dt>
              <dd className="text-xs leading-relaxed text-navy-600">{t(entry.text)}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* 6. Problèmes */}
      <Card className="p-4 sm:p-5" id="probleme">
        <div className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-950 text-sm font-bold text-accent-400">6</span>
          <h2 className="text-lg font-extrabold text-navy-950">{t('En cas de problème')}</h2>
        </div>
        <div className="mt-3 space-y-2">
          {GUIDE_PROBLEMS.map((item) => (
            <details key={item.q} className="group rounded-xl border border-navy-100 p-3 open:bg-navy-50/40">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-navy-900">
                <CircleHelp className="size-4 shrink-0 text-accent-600" aria-hidden />
                <span className="min-w-0 flex-1">{t(item.q)}</span>
                <ArrowRight className="size-4 shrink-0 text-navy-300 transition-transform group-open:rotate-90" aria-hidden />
              </summary>
              <p className="mt-2 ps-6 text-xs leading-relaxed text-navy-600">
                {t(item.a)}
              </p>
            </details>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 text-xs leading-relaxed">
            {t(FINAL_SALE_NOTICE)} <span className="font-semibold">{t('Service client : {phone}', { phone })}</span>
          </p>
        </div>
      </Card>

      {/* Aide-mémoire */}
      <Card className="border-accent-200 bg-accent-50/60 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-navy-950">
          <BadgeCheck className="size-4 text-accent-700" aria-hidden />
          {t('À retenir en trois lignes')}
        </h2>
        <ul className="mt-2 space-y-1.5 text-sm text-navy-800">
          {GUIDE_SUMMARY.map((line, index) => {
            const Icon = index === 0 ? Truck : index === 1 ? Package : MessageSquare;
            return (
              <li key={line} className="flex gap-2">
                <Icon className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden /> {t(line, { phone })}
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/admin/commandes" className="inline-flex items-center gap-2 rounded-lg bg-navy-950 px-3 py-2 text-xs font-bold text-white hover:bg-navy-800">
            <ClipboardList className="size-4" aria-hidden /> {t('Voir les commandes')}
          </Link>
          <Link href="/admin/paiements" className="inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-2 text-xs font-semibold text-navy-800 hover:border-accent-300">
            <CreditCard className="size-4" aria-hidden /> {t('Vérifier un paiement')}
          </Link>
          <Link href="#comprendre" className="inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-2 text-xs font-semibold text-navy-800 hover:border-accent-300">
            <BookOpen className="size-4" aria-hidden /> {t('Revenir en haut du guide')}
          </Link>
        </div>
      </Card>
    </div>
  );
}
