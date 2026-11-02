'use client';

import { useActionState } from 'react';
import { useAdminI18n } from '@/components/admin/admin-i18n';
import {
  issuePasswordResetLinkAction,
  regenerateStaffCodeAction,
  revokeStaffCodeAction,
  setStaffActiveAction,
  type StaffState,
} from '@/app/actions/admin-staff';
import { Button } from '../ui/button';
import { Badge } from '../ui/primitives';
import { Alert } from '../ui/primitives';
import { StaffCodeCard } from './staff-code-card';

export type StaffRowData = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  roleLabel: string;
  task: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  createdBy: string | null;
  codePending: boolean;
  codeExpiresAt: string | null;
  manageable: boolean;
  isMe: boolean;
};

const initial: StaffState = {};

/** Liste des comptes internes : état, dernier accès, code en attente, actions. */
export function StaffTable({ rows, emailConfigured }: { rows: StaffRowData[]; emailConfigured: boolean }) {
  const { t } = useAdminI18n();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-navy-600">
        <span className="font-semibold">{t('Réinitialisation des mots de passe')} :</span>
        {emailConfigured ? (
          <Badge tone="success">{t('E-mail transactionnel configuré : envoi automatique du lien')}</Badge>
        ) : (
          <Badge tone="warning">{t('E-mail non configuré : lien à transmettre par WhatsApp')}</Badge>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-500">
            <tr>
              <th className="px-3 py-2">{t('Agent')}</th>
              <th className="px-3 py-2">{t('Tâche assignée')}</th>
              <th className="px-3 py-2">{t('Rôle')}</th>
              <th className="px-3 py-2">{t('Dernière connexion')}</th>
              <th className="px-3 py-2">{t('État')}</th>
              <th className="px-3 py-2">{t('Créé par')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {rows.map((row) => (
              <StaffRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="px-3 py-4 text-sm text-navy-500">{t('Aucun agent pour le moment.')}</p> : null}
    </div>
  );
}

function StaffRow({ row }: { row: StaffRowData }) {
  const { t } = useAdminI18n();
  const [codeState, regenerate, regenerating] = useActionState(regenerateStaffCodeAction, initial);
  const [resetState, reset, resetting] = useActionState(issuePasswordResetLinkAction, initial);

  return (
    <>
      <tr className="align-top">
        <td className="px-3 py-2">
          <div className="font-semibold text-navy-900">{row.fullName || '—'}</div>
          <div className="text-xs text-navy-500">{row.phone ?? row.email}</div>
        </td>
        <td className="px-3 py-2 text-navy-700">{row.task ?? '—'}</td>
        <td className="px-3 py-2">
          <Badge tone="navy">{t(row.roleLabel)}</Badge>
        </td>
        <td className="px-3 py-2 text-xs text-navy-500">{row.lastLoginAt ?? t('jamais')}</td>
        <td className="px-3 py-2">
          <div className="flex flex-col gap-1">
            <Badge tone={row.isActive ? 'success' : 'danger'}>{row.isActive ? t('Actif') : t('Désactivé')}</Badge>
            {row.codePending ? (
              <span className="text-[11px] text-amber-700">
                {t('Code non utilisé')}
                {row.codeExpiresAt ? ` · ${row.codeExpiresAt}` : ''}
              </span>
            ) : null}
          </div>
        </td>
        <td className="px-3 py-2 text-xs text-navy-500">{row.createdBy ?? '—'}</td>
        <td className="px-3 py-2">
          {row.isMe ? (
            <span className="text-xs text-navy-400">{t('vous')}</span>
          ) : row.manageable ? (
            <div className="flex flex-wrap items-start gap-2">
              <form action={regenerate}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" size="sm" variant="ghost" loading={regenerating}>
                  {t('Nouveau code')}
                </Button>
              </form>
              <form action={reset}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" size="sm" variant="ghost" loading={resetting}>
                  {t('Lien de réinitialisation')}
                </Button>
              </form>
              <form action={setStaffActiveAction}>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="active" value={row.isActive ? '0' : '1'} />
                <Button type="submit" size="sm" variant="ghost">
                  {row.isActive ? t('Désactiver') : t('Réactiver')}
                </Button>
              </form>
              {row.codePending ? (
                <form action={revokeStaffCodeAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    {t('Annuler le code')}
                  </Button>
                </form>
              ) : null}
            </div>
          ) : (
            <span className="text-xs text-navy-400">{t('hors de votre périmètre')}</span>
          )}
        </td>
      </tr>

      {codeState.error || resetState.error ? (
        <tr>
          <td colSpan={7} className="px-3 pb-2">
            {codeState.error ? <Alert tone="danger">{codeState.error}</Alert> : null}
            {resetState.error ? <Alert tone="danger">{resetState.error}</Alert> : null}
          </td>
        </tr>
      ) : null}

      {codeState.invitation ? (
        <tr>
          <td colSpan={7} className="px-3 pb-3">
            {codeState.success ? <Alert tone="success">{codeState.success}</Alert> : null}
            <div className="mt-2">
              <StaffCodeCard invitation={codeState.invitation} />
            </div>
          </td>
        </tr>
      ) : null}

      {resetState.resetLink ? (
        <tr>
          <td colSpan={7} className="px-3 pb-3">
            <div className="rounded-lg border border-navy-200 bg-navy-50/60 p-3 text-sm">
              <p className="font-semibold text-navy-900">
                {t('Lien de réinitialisation pour {name}', { name: resetState.resetLink.fullName })}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-navy-700">{resetState.resetLink.url}</p>
              <p className="mt-1 text-xs text-navy-600">
                {resetState.resetLink.emailDelivered
                  ? t('Lien envoyé par e-mail.')
                  : t('E-mail non envoyé : transmettez ce lien par WhatsApp (valable 1 heure, usage unique).')}
              </p>
              {resetState.resetLink.whatsappLink ? (
                <a
                  href={resetState.resetLink.whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  {t('Envoyer par WhatsApp')}
                </a>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
