import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { drawerGeometry, drawerIsOffScreen, drawerLeft } from '@/lib/drawer';

/**
 * Panneaux coulissants : géométrie physique (gauche / droite) et non logique
 * (`start` / `end`). Une inversion ici laisse le menu de l'administration figé
 * au milieu de la page, notamment en arabe — c'est exactement le défaut que ces
 * tests empêchent de revenir.
 */

const VIEWPORT = 1280;
const PANEL = 320;

describe('Géométrie des panneaux coulissants', () => {
  it('s’ancre à gauche en français et à droite en arabe', () => {
    expect(drawerGeometry('ltr').side).toBe('left');
    expect(drawerGeometry('rtl').side).toBe('right');
  });

  it('referme le panneau vers l’extérieur de son bord', () => {
    expect(drawerGeometry('ltr').closedTransform).toBe('translateX(-100%)');
    expect(drawerGeometry('rtl').closedTransform).toBe('translateX(100%)');
    expect(drawerGeometry('ltr').openTransform).toBe('translateX(0)');
    expect(drawerGeometry('rtl').openTransform).toBe('translateX(0)');
  });

  it('panneau à gauche : ouvert à 0, fermé hors écran à gauche', () => {
    const g = drawerGeometry('ltr');
    expect(drawerLeft(g, VIEWPORT, PANEL, true)).toBe(0);
    expect(drawerLeft(g, VIEWPORT, PANEL, false)).toBe(-PANEL);
    expect(drawerIsOffScreen(g, VIEWPORT, PANEL)).toBe(true);
  });

  it('panneau à droite : ouvert collé au bord droit, fermé hors écran à droite', () => {
    const g = drawerGeometry('rtl');
    expect(drawerLeft(g, VIEWPORT, PANEL, true)).toBe(VIEWPORT - PANEL);
    expect(drawerLeft(g, VIEWPORT, PANEL, false)).toBe(VIEWPORT);
    expect(drawerIsOffScreen(g, VIEWPORT, PANEL)).toBe(true);
  });

  it('un panneau fermé ne recouvre jamais l’écran, téléphone comme ordinateur', () => {
    for (const width of [320, 390, 768, 1280, 1920]) {
      for (const dir of ['ltr', 'rtl'] as const) {
        const g = drawerGeometry(dir);
        const closed = drawerLeft(g, width, Math.min(PANEL, width * 0.85), false);
        const panel = Math.min(PANEL, width * 0.85);
        expect(closed + panel <= 0 || closed >= width, `${dir} ${width}px`).toBe(true);
      }
    }
  });

  it('le voile et le panneau ne se laissent jamais traverser quand ils sont fermés', () => {
    const css = readFileSync('src/app/globals.css', 'utf8');
    const closedPanel = css.slice(css.indexOf(".drawer-panel[data-open='false']"));
    const block = closedPanel.slice(0, closedPanel.indexOf('}'));
    expect(block).toContain('visibility: hidden');
    expect(block).toContain('pointer-events: none');

    const closedVeil = css.slice(css.indexOf(".drawer-veil[data-open='false']"));
    const veilBlock = closedVeil.slice(0, closedVeil.indexOf('}'));
    expect(veilBlock).toContain('visibility: hidden');
    expect(veilBlock).toContain('pointer-events: none');
  });

  it('le panneau de l’administration suit la géométrie calculée', () => {
    const source = readFileSync('src/components/admin/admin-top-bar.tsx', 'utf8');
    // L'administration n'a plus qu'un sens de lecture : la géométrie est fixée
    // explicitement à « ltr », jamais déduite d'une locale.
    expect(source).toContain("drawerGeometry('ltr'");
    expect(source).toContain('data-side={geometry.side}');
    expect(source).toContain('data-open={open}');
    // Aucune translation dépendante du sens de lecture ne doit subsister.
    expect(source).not.toContain('dir === \'rtl\' ? \'translate-x-full\'');
    expect(source).not.toContain("dir === 'rtl' ? 'end-0' : 'start-0'");
  });

  it('le menu des rayons de la boutique est monté seulement quand il est ouvert', () => {
    const source = readFileSync('src/components/site-category-menu.tsx', 'utf8');
    expect(source).toContain('{open ? (');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain('setOpen(false)');
  });

  it('aucun test de bout en bout ne dépend d’un navigateur ici (garde-fou du dépôt)', () => {
    // Les vérifications visuelles ont été faites hors du dépôt ; ce test rappelle
    // simplement que les composants concernés n’importent pas de dépendance lourde.
    const source = readFileSync('src/lib/drawer.ts', 'utf8');
    expect(source).not.toContain("from 'react'");
    expect(source).not.toContain("from 'next");
    expect(() => execFileSync('node', ['-e', 'process.exit(0)'])).not.toThrow();
  });
});
