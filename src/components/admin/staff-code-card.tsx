'use client';

import { useState } from 'react';
import { useAdminI18n } from '@/components/admin/admin-i18n';
import type { StaffInvitation } from '@/app/actions/admin-staff';
import { Button } from '../ui/button';

/**
 * Affiche **une seule fois** le code d'accès généré, avec le lien WhatsApp
 * pré-rempli. L'API WhatsApp Cloud ne permet pas d'écrire à un numéro qui n'a
 * jamais contacté la boutique : on ne promet donc jamais un envoi automatique,
 * on fournit le message prêt à partir.
 */
export function StaffCodeCard({ invitation }: { invitation: StaffInvitation }) {
  const { t } = useAdminI18n();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  async function copy(value: string, kind: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="rounded-xl border border-accent-200 bg-accent-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-navy-900">
          {t('Code d’accès de {name}', { name: invitation.fullName })}
        </p>
        <span className="text-xs text-navy-600">
          {invitation.roleLabel} · {invitation.task}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="select-all rounded-lg bg-white px-3 py-2 font-mono text-lg font-bold tracking-wider text-navy-950 shadow-sm">
          {invitation.code}
        </code>
        <Button type="button" size="sm" variant="outline" onClick={() => copy(invitation.code, 'code')}>
          {copied === 'code' ? t('Copié') : t('Copier le code')}
        </Button>
      </div>

      <dl className="mt-3 grid gap-1 text-xs text-navy-700 sm:grid-cols-2">
        <div>
          <dt className="font-semibold">{t('Téléphone')}</dt>
          <dd>{invitation.phone}</dd>
        </div>
        <div>
          <dt className="font-semibold">{t('Page d’activation')}</dt>
          <dd className="break-all">{invitation.activationUrl}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {invitation.whatsappLink ? (
          <a
            href={invitation.whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {t('Envoyer le code par WhatsApp')}
          </a>
        ) : null}
        <span className="text-xs text-navy-600">
          {invitation.whatsappDelivered
            ? t('Message transmis par l’API WhatsApp.')
            : t('WhatsApp n’est pas configuré : le message est pré-rempli, appuyez sur « Envoyer ».')}
        </span>
      </div>

      {invitation.whatsappError && !invitation.whatsappDelivered ? (
        <p className="mt-2 text-xs text-navy-500">{invitation.whatsappError}</p>
      ) : null}

      <p className="mt-3 rounded-lg bg-white/70 p-2 text-xs text-navy-700">
        {t('L’agent ouvre la page d’activation, saisit ce code, son nom et ce numéro, puis choisit lui-même son mot de passe. Le code est à usage unique et expire au bout de 7 jours.')}
      </p>
    </div>
  );
}
