import { describe, expect, it } from 'vitest';
import { readFileSync, globSync } from 'node:fs';
import {
  ADMIN_LOCALE,
  adminDir,
  localeLabel,
  translate,
  type AdminLocale,
} from '@/lib/i18n/admin';

/**
 * Fichiers du back-office : tout ce que l'équipe voit.
 * `admin-i18n.tsx` est exclu car il ne contient que le contexte React.
 */
const ADMIN_FILES: string[] = [
  ...globSync('src/app/admin/**/*.tsx'),
  ...globSync('src/components/admin/*.tsx'),
  ...globSync('src/lib/i18n/admin*.ts'),
  ...globSync('src/app/actions/admin-*.ts'),
].filter((file) => !file.endsWith('admin-i18n.tsx'));

/** Caractères arabes : ils ne doivent plus apparaître nulle part. */
const ARABIC = /[\u0600-\u06FF]/;

/**
 * L'administration est en français uniquement.
 *
 * Ces tests verrouillent la décision du propriétaire : plus d'arabe, plus de
 * sélecteur de langue, plus de sens de lecture RTL dans le back-office. Si
 * quelqu'un réintroduit un dictionnaire arabe ou un texte arabe en dur, le test
 * échoue avec le fichier fautif.
 */
describe('Langue de l’administration (français uniquement)', () => {
  it('n’expose qu’une seule langue', () => {
    const locales: AdminLocale[] = ['fr'];
    expect(locales).toEqual([ADMIN_LOCALE]);
    expect(localeLabel()).toBe('Français');
  });

  it('reste toujours de gauche à droite', () => {
    expect(adminDir()).toBe('ltr');
    expect(adminDir('fr')).toBe('ltr');
  });

  it('laisse le texte français inchangé et interpole les variables', () => {
    expect(translate('fr', 'Stock')).toBe('Stock');
    expect(translate('fr', 'Bonjour {name}.', { name: 'Awa' })).toBe('Bonjour Awa.');
    expect(translate('fr', 'Catégories ({count})', { count: 22 })).toBe('Catégories (22)');
  });

  it('laisse une variable inconnue visible plutôt que de la supprimer', () => {
    expect(translate('fr', 'Bonjour {name}.', {})).toBe('Bonjour {name}.');
  });

  it('n’affiche aucun caractère arabe dans le code du back-office', () => {
    const offenders = ADMIN_FILES.filter((file) => ARABIC.test(readFileSync(file, 'utf8')));
    expect(offenders, `Fichiers encore arabisés : ${offenders.join(' | ')}`).toEqual([]);
  });

  it('ne contient plus aucune variante de style RTL', () => {
    // Les attributs `dir="ltr"` restent utiles sur les numéros de téléphone et
    // les références (pour empêcher la mise en forme automatique) : on ne
    // contrôle donc que les variantes Tailwind `rtl:` et `dir="rtl"`.
    const offenders = ADMIN_FILES.filter((file) => /\bdir=["']rtl["']|rtl:/.test(readFileSync(file, 'utf8')));
    expect(offenders, `Fichiers encore en RTL : ${offenders.join(' | ')}`).toEqual([]);
  });

  it('n’emploie plus l’ancienne enseigne', () => {
    const offenders = ADMIN_FILES.filter((file) => /MeDi Shop|MeDi\b/.test(readFileSync(file, 'utf8')) && !file.includes('admin-guide'));
    expect(offenders, `Fichiers avec l’ancien nom : ${offenders.join(' | ')}`).toEqual([]);
  });
});
