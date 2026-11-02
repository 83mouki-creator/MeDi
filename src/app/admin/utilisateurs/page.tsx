import { desc } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { db } from '@/db';
import { users } from '@/db/schema';
import {
  assignableRoles,
  canManageUser,
  getCurrentUser,
  requirePagePermission,
} from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';
import { Badge, Card } from '@/components/ui/primitives';
import { StaffForm } from '@/components/admin/staff-form';
import { StaffTable, type StaffRowData } from '@/components/admin/staff-table';
import { ROLES, assignableRoleDefinitions, permissionLabel, rolePermissions } from '@/lib/roles';
import { roleLevel } from '@/lib/auth';
import { emailStatus } from '@/lib/email';
import { whatsappStatus } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

/**
 * Comptes internes : création par un administrateur, codes d'accès WhatsApp,
 * matrice des rôles et suivi de chaque agent (qui l'a créé, dernière connexion,
 * code encore valable, état).
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission('users.manage');
  const { t } = await getAdminI18n();
  const me = await getCurrentUser();
  const params = await searchParams;
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));

  const staffRoles = new Set(ROLES.map((role) => role.value as string));
  const staff = rows.filter((user) => staffRoles.has(user.role));
  const customers = rows.filter((user) => user.role === 'CUSTOMER');
  const byId = new Map(rows.map((user) => [user.id, user]));

  const staffRows: StaffRowData[] = staff.map((user) => ({
    id: user.id,
    fullName: [user.firstName, user.lastName].filter(Boolean).join(' '),
    email: user.email,
    phone: user.phone,
    role: user.role,
    roleLabel: ROLES.find((role) => role.value === user.role)?.label ?? user.role,
    task: user.staffTask,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : null,
    createdAt: formatDateTime(user.createdAt),
    createdBy: user.createdByUserId
      ? (() => {
          const creator = byId.get(user.createdByUserId!);
          return creator ? [creator.firstName, creator.lastName].filter(Boolean).join(' ') || creator.email : null;
        })()
      : null,
    codePending: Boolean(user.staffCodeHash) && !user.staffCodeUsedAt,
    codeExpiresAt: user.staffCodeExpiresAt ? formatDateTime(user.staffCodeExpiresAt) : null,
    manageable: Boolean(me && canManageUser(me.role, user.role)),
    isMe: me?.id === user.id,
  }));

  const roleOptions = assignableRoleDefinitions(assignableRoles(me?.role)).map((role) => ({
    value: role.value,
    label: role.label,
    description: role.description,
    home: role.home,
  }));

  const refusal =
    params.refus === 'hierarchie'
      ? t('Action refusée : ce compte est de niveau égal ou supérieur au vôtre.')
      : params.refus === 'dernier-proprietaire'
        ? t('Impossible : la boutique doit conserver au moins un propriétaire actif.')
        : null;

  const mail = emailStatus();
  const whatsapp = whatsappStatus();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">{t('Qui travaille ici ?')}</h1>
        <p className="text-sm text-navy-600">
          {t('Vous créez le compte d’un agent, il reçoit un code par WhatsApp, et il ne voit que ce qui concerne son travail.')}
        </p>
      </header>

      <Card className="p-4">
        <h2 className="text-sm font-bold">{t('Comment ça marche ?')}</h2>
        <ol className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
          <li className="rounded-lg bg-navy-50 p-3">
            <span className="text-xs font-bold text-accent-700">{t('1. Vous créez')}</span>
            <p className="mt-0.5 text-navy-700">{t('Prénom, nom, téléphone et tâche. C’est tout.')}</p>
          </li>
          <li className="rounded-lg bg-navy-50 p-3">
            <span className="text-xs font-bold text-accent-700">{t('2. Le code part')}</span>
            <p className="mt-0.5 text-navy-700">{t('Un code personnel est affiché : envoyez-le sur WhatsApp.')}</p>
          </li>
          <li className="rounded-lg bg-navy-50 p-3">
            <span className="text-xs font-bold text-accent-700">{t('3. L’agent commence')}</span>
            <p className="mt-0.5 text-navy-700">{t('Il choisit son mot de passe et arrive sur son écran de travail.')}</p>
          </li>
        </ol>
      </Card>

      {refusal ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          {refusal}
        </div>
      ) : null}

      <Card className="p-4">
        <h2 className="text-sm font-bold">{t('Créer un agent et générer son code')}</h2>
        <p className="mb-3 mt-1 text-xs text-navy-600">
          {t('Remplissez les cases, puis appuyez sur le bouton. Un code apparaîtra : ne le perdez pas, il ne s’affiche qu’une fois.')}
        </p>
        <StaffForm roles={roleOptions} />
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">{t('Agents et suivi des accès')}</h2>
          <span className="text-xs text-navy-500">
            {t('{count} compte(s) interne(s)', { count: staffRows.length })}
          </span>
        </div>
        <StaffTable rows={staffRows} emailConfigured={mail.configured} />
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-bold">{t('Ce que chacun peut faire')}</h2>
        <p className="mb-3 mt-1 text-xs text-navy-600">
          {t('Chaque métier a sa liste de choses autorisées. Ce qui n’est pas dans la liste est vraiment interdit, même en tapant l’adresse de la page.')}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {ROLES.map((role) => {
            const permissions = rolePermissions(role.value);
            return (
              <div key={role.value} className="rounded-lg border border-navy-100 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-navy-900">{t(role.label)}</p>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={role.management ? 'navy' : 'neutral'}>
                      {t('niveau {level}', { level: roleLevel(role.value) })}
                    </Badge>
                    <Badge tone="neutral">{t(role.home)}</Badge>
                  </div>
                </div>
                <p className="mt-1 text-xs text-navy-600">{t(role.description)}</p>
                <ul className="mt-2 flex flex-wrap gap-1">
                  {permissions.map((permission) => (
                    <li key={permission} className="rounded bg-navy-50 px-1.5 py-0.5 text-[11px] text-navy-700">
                      {t(permissionLabel(permission))}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-bold">{t('Envoi des liens et des codes')}</h2>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-navy-100 p-2.5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-navy-500">{t('WhatsApp')}</dt>
            <dd className="mt-0.5">
              {whatsapp.apiConfigured ? (
                <Badge tone="success">{t('API WhatsApp configurée : envoi direct possible')}</Badge>
              ) : (
                <Badge tone="warning">{t('Non configurée : message pré-rempli à envoyer manuellement')}</Badge>
              )}
            </dd>
          </div>
          <div className="rounded-lg border border-navy-100 p-2.5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-navy-500">{t('E-mail transactionnel')}</dt>
            <dd className="mt-0.5">
              {mail.configured ? (
                <Badge tone="success">{`${t('Configuré')} · ${mail.provider}`}</Badge>
              ) : (
                <Badge tone="warning">{t('Non configuré : réinitialisation transmise par WhatsApp')}</Badge>
              )}
            </dd>
          </div>
        </dl>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-navy-500 hover:text-navy-700">
            {t('Réglage technique (pour l’informaticien)')}
          </summary>
          <p className="mt-1 text-xs text-navy-500">
            {t('Pour activer l’envoi automatique des e-mails, renseignez RESEND_API_KEY (ou BREVO_API_KEY) et EMAIL_FROM dans les variables d’environnement. Sans cela, les liens restent disponibles ici et partent par WhatsApp.')}
          </p>
        </details>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-bold">{t('Clients de la boutique')}</h2>
        <p className="mb-2 mt-1 text-xs text-navy-600">
          {t('Les clients s’inscrivent seuls sur la boutique. Ils ne peuvent jamais entrer dans cet outil.')}
        </p>
        {customers.length === 0 ? (
          <p className="text-sm text-navy-500">{t('Aucun client inscrit pour le moment.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-500">
                <tr>
                  <th className="px-3 py-2">{t('Nom')}</th>
                  <th className="px-3 py-2">{t('Téléphone')}</th>
                  <th className="px-3 py-2">{t('Dernière connexion')}</th>
                  <th className="px-3 py-2">{t('État')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {customers.slice(0, 30).map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-navy-900">
                        {[customer.firstName, customer.lastName].filter(Boolean).join(' ') || '—'}
                      </div>
                      <div className="text-xs text-navy-500">{customer.email}</div>
                    </td>
                    <td className="px-3 py-2 text-navy-600">{customer.phone ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-navy-500">
                      {customer.lastLoginAt ? formatDateTime(customer.lastLoginAt) : t('jamais')}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={customer.isActive ? 'success' : 'danger'}>{customer.isActive ? t('Actif') : t('Désactivé')}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
