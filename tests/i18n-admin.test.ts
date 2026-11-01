import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { adminDir, isAdminLocale, translate, arabicStringCount } from '@/lib/i18n/admin';

const ADMIN_FILES: string[] = [
  ...globSync('src/app/admin/**/*.tsx'),
  ...globSync('src/components/admin/*.tsx'),
].filter((file) => !file.endsWith('admin-i18n.tsx'));

/** Toutes les clés réellement passées à `t(…)` dans le back-office. */
function usedKeys(): string[] {
  const keys = new Set<string>();
  const pattern = /\bt\(\s*(['"])((?:\\.|(?!\1).)*?)\1/g;
  for (const file of ADMIN_FILES) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(pattern)) keys.add(match[2]!);
  }
  return [...keys];
}

describe('Traduction du back-office', () => {
  it('reconnaît uniquement les langues prises en charge', () => {
    expect(isAdminLocale('fr')).toBe(true);
    expect(isAdminLocale('ar')).toBe(true);
    expect(isAdminLocale('en')).toBe(false);
    expect(isAdminLocale(undefined)).toBe(false);
  });

  it('passe en RTL uniquement en arabe', () => {
    expect(adminDir('fr')).toBe('ltr');
    expect(adminDir('ar')).toBe('rtl');
  });

  it('laisse le français inchangé', () => {
    expect(translate('fr', 'Stock')).toBe('Stock');
    expect(translate('fr', 'Bonjour {name}.', { name: 'Awa' })).toBe('Bonjour Awa.');
  });

  it('traduit en arabe et remplace les variables', () => {
    expect(translate('ar', 'Stock')).toBe('المخزون');
    expect(translate('ar', 'Bonjour {name}.', { name: 'كريم' })).toBe('مرحباً كريم.');
    expect(translate('ar', 'Catégories ({count})', { count: 22 })).toBe('الفئات (22)');
  });

  it('retombe sur le français pour une chaîne inconnue (jamais de trou)', () => {
    expect(translate('ar', 'Chaîne non traduite')).toBe('Chaîne non traduite');
    expect(translate('ar', 'Bonjour {name}.', {})).toBe('مرحباً {name}.');
  });

  it('le dictionnaire arabe ne contient que de l’arabe', () => {
    expect(arabicStringCount()).toBeGreaterThan(250);
  });

  it('chaque libellé affiché dans l’administration a sa traduction', () => {
    // Les noms propres et références techniques restent volontairement en latin.
    const intentionallyLatin = new Set(['MeDi', 'MED-0001', 'TDH5TEWTLFE']);
    const missing = usedKeys()
      .filter((key) => !intentionallyLatin.has(key))
      .filter((key) => /\p{Script=Latin}{2}/u.test(key))
      .filter((key) => translate('ar', key) === key);

    expect(missing, `Clés sans traduction arabe : ${missing.join(' | ')}`).toEqual([]);
  });
});
