import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import {
  DEFAULT_SITE_LOCALE,
  SITE_LOCALES,
  SITE_EN,
  SITE_AR,
  isSiteLocale,
  siteDir,
  siteHtmlLang,
  translate,
} from '@/lib/i18n/site';

/**
 * Fichiers de la vitrine : tout ce que le client voit. L'administration a son
 * propre dictionnaire (`lib/i18n/admin.ts`) et son propre test : les deux
 * vocabulaires ne doivent pas se mélanger.
 */
const SITE_FILES: string[] = [
  ...globSync('src/app/(site)/**/*.tsx'),
  'src/app/(site)/layout.tsx',
  ...globSync('src/components/*.tsx'),
].filter((file) => !file.includes('/admin'));

/** Toutes les clés réellement passées à `t('…')` côté vitrine. */
function usedKeys(): string[] {
  const keys = new Set<string>();
  const pattern = /\bt\(\s*'((?:\\.|[^'\\])*)'/g;
  for (const file of SITE_FILES) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(pattern)) keys.add(match[1]!.replace(/\\'/g, "'"));
  }
  return [...keys];
}

/** Variables `{nom}` présentes dans une chaîne. */
function variables(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

describe('Traduction de la vitrine', () => {
  it('propose le français par défaut et trois langues', () => {
    expect(DEFAULT_SITE_LOCALE).toBe('fr');
    expect(SITE_LOCALES).toEqual(['fr', 'en', 'ar']);
    expect(isSiteLocale('en')).toBe(true);
    expect(isSiteLocale('de')).toBe(false);
  });

  it('passe en RTL uniquement en arabe', () => {
    expect(siteDir('fr')).toBe('ltr');
    expect(siteDir('en')).toBe('ltr');
    expect(siteDir('ar')).toBe('rtl');
    expect(siteHtmlLang('ar')).toBe('ar');
  });

  it('laisse le français intact et remplace les variables', () => {
    expect(translate('fr', 'Panier')).toBe('Panier');
    expect(translate('fr', 'Panier, {count} article(s)', { count: 3 })).toBe('Panier, 3 article(s)');
  });

  it('retombe sur le français plutôt que sur un trou', () => {
    expect(translate('en', 'Chaîne inconnue de la vitrine')).toBe('Chaîne inconnue de la vitrine');
  });

  it('chaque texte affiché au client existe en anglais et en arabe', () => {
    // « Total », « Contact » ou « E-mail » s'écrivent pareil en anglais : pour
    // ces mots, l'identité n'est pas un oubli. L'arabe, lui, ne peut pas être
    // confondu avec le français.
    const ignored = new Set(['MeDi', 'Wave', 'MED-2026-01000', 'MED-2026-01024', 'TDH5TEWTLFE']);
    const keys = usedKeys()
      .filter((key) => !ignored.has(key))
      .filter((key) => /[A-Za-zÀ-ÿ]{2}/.test(key));

    const missingEnglish = keys.filter((key) => !(key in SITE_EN));
    const missingArabic = keys.filter((key) => translate('ar', key) === key);

    expect(missingEnglish, `Textes sans traduction anglaise : ${missingEnglish.join(' | ')}`).toEqual([]);
    expect(missingArabic, `Textes sans traduction arabe : ${missingArabic.join(' | ')}`).toEqual([]);
  });

  it('les traductions conservent les variables attendues', () => {
    const broken: string[] = [];
    for (const [key, value] of [...Object.entries(SITE_EN), ...Object.entries(SITE_AR)]) {
      if (variables(key).join() !== variables(value).join()) broken.push(key);
    }
    expect(broken, `Variables modifiées : ${broken.join(' | ')}`).toEqual([]);
  });

  it('le dictionnaire arabe est bien écrit en arabe', () => {
    // Chaque valeur doit contenir au moins une lettre arabe : une traduction
    // oubliée, laissée en français, est ainsi repérée immédiatement.
    // Les noms propres et références gardent volontairement leur écriture latine.
    const keptInLatin = new Set(['Wave', 'MED-2026-01024', '+225 …']);
    const notArabic = Object.entries(SITE_AR)
      .filter(([key]) => !keptInLatin.has(key))
      .filter(([, value]) => !/[\u0600-\u06FF]/.test(value))
      .map(([key]) => key);
    expect(notArabic, `Valeurs arabes encore en latin : ${notArabic.join(' | ')}`).toEqual([]);
    expect(Object.keys(SITE_AR).length).toBeGreaterThan(400);
  });
});
