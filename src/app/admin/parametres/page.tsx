import { getStoreSettings } from '@/lib/settings';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { waveStatus } from '@/lib/wave';
import { storageInfo } from '@/lib/storage';
import { providerInfo } from '@/lib/visual';
import { env } from '@/lib/env';
import { SettingsForm } from '@/components/admin/settings-form';
import { Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { t } = await getAdminI18n();
  const settings = await getStoreSettings();
  const wave = waveStatus();
  const storage = storageInfo();
  const vision = providerInfo();

  const rows = [
    { label: 'Base de données', value: env.databaseUrl.includes('neon.tech') ? 'Neon (PostgreSQL)' : 'PostgreSQL configurée', ok: true },
    { label: 'Paiement Wave — mode', value: `${wave.mode}`, ok: wave.apiConfigured || wave.mode === 'MANUAL' },
    { label: 'Paiement Wave — clé API', value: wave.apiConfigured ? 'présente' : 'absente (mode manuel)', ok: wave.apiConfigured },
    { label: 'Webhook Wave', value: wave.webhookConfigured ? 'secret configuré' : 'non configuré', ok: wave.webhookConfigured },
    { label: 'Stockage images', value: `${storage.driver}${storage.configured ? '' : ' (non configuré)'}`, ok: storage.configured },
    { label: 'Recherche visuelle', value: `${vision.id}${vision.available ? '' : ' (indisponible)'}`, ok: vision.available },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">{t('Paramètres de la boutique')}</h1>
        <p className="text-sm text-navy-600">
          {t('Les coordonnées, horaires et informations Wave sont affichés aux clients. Aucune valeur n’est inventée : laissez vide si l’information n’est pas confirmée par le propriétaire.')}
        </p>
      </header>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-bold">{t('État de la configuration technique')}</h2>
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-2 rounded border border-navy-100 px-2.5 py-1.5">
              <span className="text-navy-600">{row.label}</span>
              <span className={row.ok ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>{row.value}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-navy-500">
          {t('Les secrets (clés API, secrets webhook, chaînes de connexion) ne sont jamais affichés ni modifiables depuis cette page : ils vivent exclusivement dans les variables d’environnement du serveur.')}
        </p>
      </Card>

      <SettingsForm settings={settings} />
    </div>
  );
}
