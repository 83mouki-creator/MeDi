import Link from 'next/link';
import Image from 'next/image';
import { Clock, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Truck, Undo2 } from 'lucide-react';
import { getStoreSettings, whatsappLink } from '@/lib/settings';
import { getCategoryTree } from '@/lib/catalog';

export async function SiteFooter() {
  const settings = await getStoreSettings();
  const tree = await getCategoryTree().catch(() => ({ roots: [], childrenOf: () => [], all: [] }));
  const whatsapp = whatsappLink(settings);

  return (
    <footer className="mt-16 bg-navy-950 text-navy-200">
      {/* Réassurance */}
      <div className="border-b border-navy-800">
        <div className="container-page grid grid-cols-1 gap-4 py-6 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <Truck className="mt-0.5 size-5 shrink-0 text-accent-400" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-white">Retrait à Daloa & expédition</p>
              <p className="text-xs text-navy-300">Retrait en boutique ou livraison locale. Hors Daloa : paiement confirmé avant expédition.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent-400" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-white">Paiement Wave</p>
              <p className="text-xs text-navy-300">Chaque paiement est vérifié avant préparation de la commande.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Undo2 className="mt-0.5 size-5 shrink-0 text-accent-400" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-white">Politique de retour</p>
              <p className="text-xs text-navy-300">
                <Link href="/retours" className="underline decoration-navy-600 underline-offset-2 hover:text-white">
                  Consulter les conditions de retour
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Image src="/brand/medi-logo-horizontal-blanc.png" alt="MeDi" width={703} height={200} className="h-12 w-auto" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            {settings.tagline ??
              'Quincaillerie, outillage industriel, matériel de construction et équipement de la maison à Daloa.'}
          </p>
          <address className="mt-4 space-y-2 not-italic text-sm">
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-accent-400" aria-hidden />
              <span>
                {settings.addressLine ? `${settings.addressLine}, ${settings.city}` : `${settings.city}, ${settings.country}`}
              </span>
            </p>
            {settings.phone ? (
              <p className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-accent-400" aria-hidden />
                <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="hover:text-white">
                  {settings.phone}
                </a>
              </p>
            ) : null}
            {settings.email ? (
              <p className="flex items-center gap-2">
                <Mail className="size-4 shrink-0 text-accent-400" aria-hidden />
                <a href={`mailto:${settings.email}`} className="hover:text-white">
                  {settings.email}
                </a>
              </p>
            ) : null}
            {settings.openingHours ? (
              <p className="flex items-start gap-2">
                <Clock className="mt-0.5 size-4 shrink-0 text-accent-400" aria-hidden />
                <span>{settings.openingHours}</span>
              </p>
            ) : null}
          </address>
        </div>

        <nav aria-label="Catégories">
          <h2 className="text-sm font-semibold text-white">Catégories</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {tree.roots.slice(0, 7).map((category) => (
              <li key={category.id}>
                <Link href={`/categorie/${category.slug}`} className="hover:text-white">
                  {category.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/catalogue" className="font-semibold text-accent-300 hover:text-accent-200">
                Tout le catalogue
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Informations">
          <h2 className="text-sm font-semibold text-white">Informations</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/nous-trouver" className="hover:text-white">Nous trouver (plan et GPS)</Link></li>
            <li><Link href="/livraison" className="hover:text-white">Livraison et retrait</Link></li>
            <li><Link href="/livraison#faq-livraison" className="hover:text-white">FAQ livraisons et expéditions</Link></li>
            <li><Link href="/paiement" className="hover:text-white">Paiement Wave</Link></li>
            <li><Link href="/suivi" className="hover:text-white">Suivre ma commande</Link></li>
            <li><Link href="/retours" className="hover:text-white">Retours et remboursements</Link></li>
            <li><Link href="/retours#faq-retours" className="hover:text-white">FAQ retours et remboursements</Link></li>
            <li><Link href="/cgv" className="hover:text-white">Conditions générales de vente</Link></li>
            <li><Link href="/confidentialite" className="hover:text-white">Confidentialité</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold text-white">Un besoin précis ?</h2>
          <p className="mt-3 text-sm leading-relaxed">
            Un devis, une quantité importante, un produit non listé ? Écrivez-nous : nous vous répondons pendant les heures d&apos;ouverture.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <MessageCircle className="size-4" aria-hidden /> Discuter sur WhatsApp
              </a>
            ) : (
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-900"
              >
                <MessageCircle className="size-4" aria-hidden /> Formulaire de contact
              </Link>
            )}
            <Link
              href="/catalogue"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-900"
            >
              Parcourir le catalogue
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-navy-800">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-navy-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} MeDi — Daloa, Côte d&apos;Ivoire. Tous droits réservés.</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/cgv" className="hover:text-white">CGV</Link>
            <Link href="/confidentialite" className="hover:text-white">Confidentialité</Link>
            <Link href="/retours" className="hover:text-white">Retours</Link>
            <Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
