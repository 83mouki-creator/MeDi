import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  GUIDE_GESTURES,
  GUIDE_INTRO,
  GUIDE_JOURNEY,
  GUIDE_JOURNEY_ACTION,
  GUIDE_PROBLEMS,
  GUIDE_ROUTINE,
  GUIDE_SECTIONS,
  GUIDE_SUMMARY,
  GUIDE_WORDS,
  allGuideStrings,
} from '@/lib/admin-guide';
import { translate } from '@/lib/i18n/admin';
import { ORDER_STATUS_LABELS } from '@/lib/order-status';

/**
 * Le guide « Comment utiliser le site Perokado » vit dans `/admin/guide`.
 *
 * La page passe ses textes à `t()` de façon dynamique : un simple scan du code
 * ne verrait pas les phrases. Ces tests lisent donc directement les données du
 * guide et vérifient que chaque phrase est bien écrite en français.
 */

/** Variables `{nom}` présentes dans une chaîne. */
function variables(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

describe('Guide « Comment utiliser le site »', () => {
  it('couvre les six grandes parties attendues', () => {
    expect(GUIDE_SECTIONS.map((section) => section.id)).toEqual([
      'comprendre',
      'parcours',
      'routine',
      'gestes',
      'mots',
      'probleme',
    ]);
  });

  it('explique chaque étape de commande avec un libellé connu du site', () => {
    for (const status of GUIDE_JOURNEY) {
      expect(ORDER_STATUS_LABELS[status], status).toBeTruthy();
      expect(GUIDE_JOURNEY_ACTION[status]?.length ?? 0, status).toBeGreaterThan(20);
    }
  });

  it('donne au moins quatre gestes par partie et un texte par geste', () => {
    expect(GUIDE_INTRO.length).toBeGreaterThanOrEqual(4);
    expect(GUIDE_ROUTINE.length).toBeGreaterThanOrEqual(4);
    expect(GUIDE_GESTURES.length).toBeGreaterThanOrEqual(4);
    expect(GUIDE_WORDS.length).toBeGreaterThanOrEqual(4);
    expect(GUIDE_PROBLEMS.length).toBeGreaterThanOrEqual(3);
    for (const step of [...GUIDE_ROUTINE, ...GUIDE_GESTURES]) {
      expect(step.href.startsWith('/admin'), step.title).toBe(true);
      expect(step.text.length, step.title).toBeGreaterThan(20);
    }
  });

  it('chaque phrase du guide est écrite en français', () => {
    const arabic = allGuideStrings().filter((text) => /[\u0600-\u06FF]/.test(text));
    expect(arabic, `Phrases encore en arabe : ${arabic.join(' | ')}`).toEqual([]);
    const empty = allGuideStrings().filter((text) => text.trim().length < 3);
    expect(empty, `Phrases vides : ${empty.join(' | ')}`).toEqual([]);
  });

  it('les variables ({hours}, {phone}…) sont conservées telles quelles', () => {
    const broken = allGuideStrings().filter(
      (text) => variables(text).join() !== variables(translate('fr', text)).join(),
    );
    expect(broken, `Variables modifiées : ${broken.join(' | ')}`).toEqual([]);
  });

  it('nomme la boutique Perokado, jamais l’ancienne enseigne', () => {
    const wrong = allGuideStrings().filter((text) => /MeDi/.test(text));
    expect(wrong, `Ancienne enseigne dans le guide : ${wrong.join(' | ')}`).toEqual([]);
  });

  it('les phrases à retenir tiennent en une ligne chacune', () => {
    expect(GUIDE_SUMMARY.length).toBe(3);
    for (const line of GUIDE_SUMMARY) expect(line.length).toBeLessThan(120);
  });

  it('le guide est accessible depuis le menu et depuis l’accueil de l’administration', () => {
    const layout = readFileSync('src/app/admin/layout.tsx', 'utf8');
    const topBar = readFileSync('src/components/admin/admin-top-bar.tsx', 'utf8');
    const dashboard = readFileSync('src/app/admin/page.tsx', 'utf8');

    expect(layout).toContain("href: '/admin/guide'");
    expect(topBar).toContain('href="/admin/guide"');
    expect(dashboard).toContain('href="/admin/guide"');
  });

  it('le guide renvoie aux règles de la boutique au lieu de réécrire les chiffres', () => {
    const page = readFileSync('src/app/admin/guide/page.tsx', 'utf8');
    expect(page).toContain('OUTSIDE_DALOA_MAX_DAYS');
    expect(page).toContain('FINAL_SALE_NOTICE');
    // Aucun délai écrit à la main dans le guide.
    expect(page).not.toMatch(/7\s*jours/);
    // Le retrait en magasin n'existe plus : le guide ne doit plus le proposer.
    expect(page).not.toMatch(/retrait gardé/i);
  });
});
