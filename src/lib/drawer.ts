/**
 * Géométrie des panneaux coulissants (menu de l'administration, panneaux de la
 * boutique sur mobile).
 *
 * Règle unique, valable dans toutes les langues : un panneau est ancré à un
 * bord **physique** de l'écran et se referme en glissant **vers l'extérieur**
 * de ce bord. On ne s'appuie jamais sur `dir` hérité d'un ancêtre pour deviner
 * le sens de la glissade : c'est exactement ce qui laissait le menu de
 * l'administration à moitié visible au milieu de la page en arabe (ancrage à
 * gauche, glissade vers la droite).
 *
 * Ce module est volontairement pur (aucune dépendance à React ni à Next.js) :
 * il est testable directement, et le composant comme les tests lisent la même
 * source de vérité.
 */

export type DrawerSide = 'left' | 'right';

export type DrawerGeometry = {
  /** Bord de l'écran sur lequel le panneau est ancré. */
  side: DrawerSide;
  /** Translation appliquée quand le panneau est fermé (hors écran). */
  closedTransform: string;
  /** Translation appliquée quand le panneau est ouvert. */
  openTransform: string;
};

/** Panneau fermé à gauche : il glisse vers la gauche (valeur négative). */
const CLOSED_LEFT = 'translateX(-100%)';
/** Panneau fermé à droite : il glisse vers la droite (valeur positive). */
const CLOSED_RIGHT = 'translateX(100%)';
const OPEN = 'translateX(0)';

/**
 * Géométrie à utiliser selon le sens de lecture du bloc qui contient le
 * panneau : à droite en arabe (le contenu commence à droite), à gauche sinon.
 */
export function drawerGeometry(dir: 'ltr' | 'rtl'): DrawerGeometry {
  return dir === 'rtl'
    ? { side: 'right', closedTransform: CLOSED_RIGHT, openTransform: OPEN }
    : { side: 'left', closedTransform: CLOSED_LEFT, openTransform: OPEN };
}

/**
 * Position horizontale du panneau, en pixels, pour une largeur d'écran et une
 * largeur de panneau données. Sert de garde-fou : un panneau fermé doit être
 * entièrement hors de l'écran (x + largeur ≤ 0, ou x ≥ largeur d'écran).
 */
export function drawerLeft(geometry: DrawerGeometry, viewportWidth: number, panelWidth: number, open: boolean): number {
  const anchored = geometry.side === 'left' ? 0 : viewportWidth - panelWidth;
  if (open) return anchored;
  return geometry.side === 'left' ? anchored - panelWidth : anchored + panelWidth;
}

/** Vrai si le panneau est totalement invisible à l'écran. */
export function drawerIsOffScreen(
  geometry: DrawerGeometry,
  viewportWidth: number,
  panelWidth: number,
): boolean {
  const left = drawerLeft(geometry, viewportWidth, panelWidth, false);
  return left + panelWidth <= 0 || left >= viewportWidth;
}
