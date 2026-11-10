/**
 * Écrit `public/.well-known/assetlinks.json` : le fichier qui autorise
 * l'application Android (Play Store) à ouvrir le site en plein écran, sans barre
 * d'adresse Chrome.
 *
 *   npm run assetlinks -- "AA:BB:CC:…" ["11:22:33:…"]
 *
 * Les empreintes sont les **SHA-256** des certificats de signature :
 *   1. celui de TA clé (`keytool -list -v -keystore android.keystore -alias perokado`) ;
 *   2. celui de **Play App Signing** (Play Console → Test et publication →
 *      Signature de l'application), indispensable une fois l'app publiée : sans
 *      lui, la barre d'adresse réapparaît en production.
 *
 * Le nom de paquet peut être changé avec `ANDROID_PACKAGE_NAME` (par défaut
 * `ci.perokado.app`, celui donné à `bubblewrap init`).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PACKAGE_NAME = process.env.ANDROID_PACKAGE_NAME?.trim() || 'ci.perokado.app';
const OUTPUT = path.join(process.cwd(), 'public', '.well-known', 'assetlinks.json');

/** Nettoie une empreinte : majuscules, deux-points tous les deux caractères. */
function normalize(raw: string): string {
  const hex = raw
    .replace(/sha-?256[:\s]*/i, '')
    .replace(/[^0-9a-f]/gi, '')
    .toUpperCase();
  if (hex.length !== 64) {
    throw new Error(
      `Empreinte invalide (${hex.length} caractères hexadécimaux au lieu de 64) : ${raw}\n` +
        'Attendu : le SHA-256 d’un certificat, par exemple depuis\n' +
        '  keytool -list -v -keystore android.keystore -alias perokado\n' +
        '(ou l’empreinte « certificat de signature d’application » de la Play Console).',
    );
  }
  return (hex.match(/../g) ?? []).join(':');
}

async function main() {
  const args = process.argv.slice(2).filter((value) => value.trim() !== '');
  const fromEnv = (process.env.ANDROID_SHA256 ?? '')
    .split(/[,;\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
  const raw = args.length > 0 ? args : fromEnv;

  if (raw.length === 0) {
    console.error(
      [
        'Aucune empreinte fournie.',
        '',
        '  npm run assetlinks -- "AA:BB:CC:…"',
        '',
        'Ou, pour deux certificats (ta clé + Play App Signing) :',
        '',
        '  npm run assetlinks -- "AA:BB:…" "11:22:…"',
      ].join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  const fingerprints = [...new Set(raw.map(normalize))];
  const statements = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(statements, null, 2)}\n`, 'utf8');

  console.log('✔ public/.well-known/assetlinks.json écrit');
  console.log(`  paquet      : ${PACKAGE_NAME}`);
  for (const fingerprint of fingerprints) console.log(`  empreinte   : ${fingerprint}`);
  console.log('');
  console.log('Vérification après déploiement :');
  console.log('  npx @bubblewrap/cli validate --url https://perokado.vercel.app');
  console.log(
    '  https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://perokado.vercel.app&relation=delegate_permission/common.handle_all_urls',
  );
}

main().catch((error) => {
  console.error('❌', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
