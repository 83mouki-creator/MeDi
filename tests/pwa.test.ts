import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../src/app/manifest';

const ROOT = process.cwd();
const publicFile = (url: string) => path.join(ROOT, 'public', url.replace(/^\//, ''));

/**
 * Garde-fous de l'application Android : si le manifeste, les icônes ou le service
 * worker disparaissent, `bubblewrap init` et l'installation sur téléphone cassent
 * silencieusement. Ces tests le signalent tout de suite.
 */
describe('manifeste de l’application (PWA / Android)', () => {
  const data = manifest();

  it('porte le nom de la boutique et s’ouvre en plein écran', () => {
    expect(data.name).toContain('MeDi Shop');
    expect(data.short_name).toBe('MeDi Shop');
    expect(data.display).toBe('standalone');
    expect(data.start_url).toBe('/');
    expect(data.scope).toBe('/');
    expect(data.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('déclare une icône 192, une icône 512 et une icône « maskable »', () => {
    const icons = data.icons ?? [];
    expect(icons.some((icon) => icon.sizes === '192x192')).toBe(true);
    expect(icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'any')).toBe(true);
    expect(icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  });

  it('référence uniquement des fichiers réellement présents dans public/', () => {
    for (const icon of data.icons ?? []) {
      expect(existsSync(publicFile(icon.src)), `icône absente : ${icon.src}`).toBe(true);
    }
    for (const shortcut of data.shortcuts ?? []) {
      for (const icon of shortcut.icons ?? []) {
        expect(existsSync(publicFile(icon.src)), `icône absente : ${icon.src}`).toBe(true);
      }
    }
  });

  it('garde les raccourcis dans le périmètre de l’application', () => {
    for (const shortcut of data.shortcuts ?? []) {
      expect(shortcut.url.startsWith('/')).toBe(true);
    }
  });
});

describe('service worker et page hors connexion', () => {
  const sw = readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');

  it('existe et met la page hors connexion en cache à l’installation', () => {
    expect(sw).toContain("const OFFLINE_URL = '/offline'");
    expect(sw).toContain("addEventListener('install'");
  });

  it('ne met jamais en cache les requêtes d’action (POST)', () => {
    expect(sw).toContain("request.method !== 'GET'");
  });

  it('sert une page hors connexion à l’adresse /offline', () => {
    expect(existsSync(path.join(ROOT, 'src', 'app', 'offline', 'page.tsx'))).toBe(true);
  });
});

describe('vérification du domaine par Android', () => {
  const assetlinks = path.join(ROOT, 'public', '.well-known', 'assetlinks.json');

  it('un script écrit le fichier assetlinks', () => {
    const script = readFileSync(path.join(ROOT, 'scripts', 'make-assetlinks.ts'), 'utf8');
    expect(script).toContain('delegate_permission/common.handle_all_urls');
    expect(script).toContain('sha256_cert_fingerprints');
  });

  it('le fichier assetlinks, quand il existe, est bien formé', () => {
    // Il n'existe qu'après `npm run assetlinks -- "…"` : il dépend des certificats
    // réels de la boutique (voir docs/ANDROID.md).
    if (!existsSync(assetlinks)) return;
    const statements = JSON.parse(readFileSync(assetlinks, 'utf8')) as {
      relation: string[];
      target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] };
    }[];
    expect(Array.isArray(statements)).toBe(true);
    expect(statements.length).toBeGreaterThan(0);
    const [first] = statements;
    expect(first!.relation).toContain('delegate_permission/common.handle_all_urls');
    expect(first!.target.namespace).toBe('android_app');
    expect(first!.target.package_name).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
    expect(first!.target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
    for (const fingerprint of first!.target.sha256_cert_fingerprints) {
      expect(fingerprint).toMatch(/^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/);
    }
  });
});
