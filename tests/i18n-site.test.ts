import { describe, expect, it } from 'vitest';
import { readFileSync, globSync } from 'node:fs';
import {
  DEFAULT_SITE_LOCALE,
  SITE_LOCALES,
  interpolate,
  isSiteLocale,
  siteDir,
  siteHtmlLang,
  siteTranslator,
  translate,
} from '@/lib/i18n/site';

/**
 * Fichiers de la vitrine : tout ce que le client voit. L'administration a ses
 * propres tests (`i18n-admin`) : les deux vocabulaires ne doivent pas se
 * mélanger.
 */
const SITE_FILES: string[] = [
  ...globSync('src/app/(site)/**/*.tsx'),
  'src/app/layout.tsx',
  ...globSync('src/components/*.tsx'),
  ...globSync('src/lib/i18n/site*.ts'),
].filter((file) => !file.includes('/admin'));

/** Caractères arabes : la vitrine a été demandée en français uniquement. */
const ARABIC = /[\u0600-\u06FF]/;

describe('Langue de la vitrine (français uniquement)', () => {
  it('ne propose qu’une langue, le français', () => {
    expect(DEFAULT_SITE_LOCALE).toBe('fr');
    expect(SITE_LOCALES).toEqual(['fr']);
    expect(isSiteLocale('fr')).toBe(true);
    expect(isSiteLocale('ar')).toBe(false);
    expect(isSiteLocale('en')).toBe(false);
  });

  it('reste toujours de gauche à droite', () => {
    expect(siteDir()).toBe('ltr');
    expect(siteHtmlLang()).toBe('fr-CI');
  });

  it('laisse le français intact et remplace les variables', () => {
    expect(translate('fr', 'Panier')).toBe('Panier');
    expect(translate('fr', 'Panier, {count} article(s)', { count: 3 })).toBe('Panier, 3 article(s)');
    expect(interpolate('Livraison à {city}', { city: 'Daloa' })).toBe('Livraison à Daloa');
  });

  it('laisse une variable inconnue visible plutôt que de la supprimer', () => {
    expect(interpolate('Bonjour {name}.', {})).toBe('Bonjour {name}.');
  });

  it('fournit un traducteur lié à la langue', () => {
    const t = siteTranslator();
    expect(t('Stock vérifié')).toBe('Stock vérifié');
    expect(t('Livraison à {city}', { city: 'Daloa' })).toBe('Livraison à Daloa');
  });

  it('n’affiche aucun caractère arabe dans la vitrine', () => {
    const offenders = SITE_FILES.filter((file) => ARABIC.test(readFileSync(file, 'utf8')));
    expect(offenders, `Fichiers encore arabisés : ${offenders.join(' | ')}`).toEqual([]);
  });

  it('n’affiche plus de sélecteur de langue ni de sens RTL', () => {
    const offenders = SITE_FILES.filter((file) =>
      /site-locale-selector|LocaleSwitcher|\bdir=["']rtl["']|rtl:/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders, `Fichiers avec sélecteur/RTL : ${offenders.join(' | ')}`).toEqual([]);
  });

  it('n’emploie plus l’ancienne enseigne sur la vitrine', () => {
    const offenders = SITE_FILES.filter((file) => /MeDi Shop|MeDi\b/.test(readFileSync(file, 'utf8')));
    expect(offenders, `Fichiers avec l’ancien nom : ${offenders.join(' | ')}`).toEqual([]);
  });
});
