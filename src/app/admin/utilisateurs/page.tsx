import { desc } from 'drizzle-orm';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { users, passwordResetTokens } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { toggleUserActiveAction } from '@/app/actions/auth';
import { formatDateTime } from '@/lib/utils';
import { Badge, Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ManagedUserForm } from '@/components/admin/user-form';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const { t } = await getAdminI18n();
  const me = await getCurrentUser();
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));

  const activeResetTokens = await db
    .select({ id: passwordResetTokens.id, userId: passwordResetTokens.userId, expiresAt: passwordResetTokens.expiresAt })
    .from(passwordResetTokens)
    .where(and(isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date())));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">{t('Utilisateurs et rôles')}</h1>
        <p className="text-sm text-navy-600">
          {t('Seul le propriétaire peut créer des comptes internes. Les rôles limitent les actions sensibles (confirmation de paiement, paramètres, journal).')}
        </p>
      </header>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-bold">{t('Créer un compte interne')}</h2>
        <ManagedUserForm />
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-500">
            <tr>
              <th className="px-3 py-2">{t('E-mail')}</th>
              <th className="px-3 py-2">{t('Nom')}</th>
              <th className="px-3 py-2">{t('Rôle')}</th>
              <th className="px-3 py-2">{t('Dernière connexion')}</th>
              <th className="px-3 py-2">{t('État')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {rows.map((user) => (
              <tr key={user.id}>
                <td className="px-3 py-2 font-medium">{user.email}</td>
                <td className="px-3 py-2 text-navy-600">{[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}</td>
                <td className="px-3 py-2"><Badge tone={user.role === 'CUSTOMER' ? 'neutral' : 'navy'}>{user.role}</Badge></td>
                <td className="px-3 py-2 text-xs text-navy-500">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'jamais'}</td>
                <td className="px-3 py-2">
                  <Badge tone={user.isActive ? 'success' : 'danger'}>{user.isActive ? 'Actif' : 'Désactivé'}</Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  {user.id !== me?.id ? (
                    <form action={toggleUserActiveAction}>
                      <input type="hidden" name="id" value={user.id} />
                      <Button type="submit" size="sm" variant="ghost">{user.isActive ? 'Désactiver' : 'Réactiver'}</Button>
                    </form>
                  ) : (
                    <span className="text-xs text-navy-400">{t('vous')}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-bold">{t('Réinitialisations de mot de passe en cours')}</h2>
        {activeResetTokens.length === 0 ? (
          <p className="text-sm text-navy-500">{t('Aucune demande active.')}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {activeResetTokens.map((token) => {
              const user = rows.find((u) => u.id === token.userId);
              return (
                <li key={token.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-navy-100 px-2.5 py-1.5">
                  <span>{user?.email ?? token.userId}</span>
                  <span className="text-xs text-navy-500">expire le {formatDateTime(token.expiresAt)}</span>
                  <span className="text-xs text-navy-500">
                    {t('Jeton haché en base : transmettez le lien généré côté serveur via un canal sûr (téléphone, en boutique).')}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-navy-500">
          {t('Aucun service d’e-mail n’est configuré dans cette version : les liens de réinitialisation ne peuvent pas être envoyés automatiquement. Voir docs/SECURITE.md.')}
        </p>
      </Card>
    </div>
  );
}
