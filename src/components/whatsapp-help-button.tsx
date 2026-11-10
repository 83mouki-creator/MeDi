import { MessageCircle } from 'lucide-react';
import { WHATSAPP_MESSAGES } from '@/lib/brand';
import { getStoreSettings, whatsappLink } from '@/lib/settings';
import { getSiteI18n } from '@/lib/i18n/site-server';

/**
 * Bouton d'aide flottant, présent sur toutes les pages de la vitrine.
 *
 * Un client qui a une question ne cherche pas la page contact : le bouton est
 * toujours à portée de pouce, y compris en bas d'une fiche produit. Il ouvre le
 * WhatsApp Business de la boutique avec le message **déjà écrit** — le client
 * n'a plus qu'à envoyer, et la boutique reçoit une demande formulée.
 *
 * Composant serveur : le numéro vient des réglages (`/admin/parametres`) et le
 * lien `wa.me` est calculé ici, jamais dans le navigateur.
 *
 * Sur mobile, il remonte au-dessus de la barre d'achat de la fiche produit
 * (`MobileBuyBar`) : deux boutons superposés se gêneraient.
 */
export async function WhatsAppHelpButton() {
  const [settings, { t }] = await Promise.all([getStoreSettings(), getSiteI18n()]);
  const href = whatsappLink(settings, WHATSAPP_MESSAGES.help);
  if (!href) return null;

  return (
    <div className="fixed bottom-20 end-3 z-30 print:hidden lg:bottom-4 lg:end-4">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-2 rounded-full bg-[#25D366] py-2.5 pe-4 ps-3 text-sm font-bold text-[#0b3d2c] shadow-lg shadow-navy-950/25 ring-1 ring-black/10 transition hover:bg-[#1ebe5b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366] sm:py-3 sm:ps-4"
        aria-label={t('Contacter le service client sur WhatsApp (message déjà rédigé)')}
      >
        <span className="grid size-7 place-items-center rounded-full bg-white/85 sm:size-8">
          <MessageCircle className="size-4 text-[#128C7E] sm:size-[18px]" aria-hidden />
        </span>
        <span className="hidden sm:inline">{t('Besoin d’aide ?')}</span>
        <span className="sm:hidden">{t('Aide')}</span>
      </a>
    </div>
  );
}
