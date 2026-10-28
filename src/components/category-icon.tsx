import {
  Wrench,
  Hammer,
  HardHat,
  PaintRoller,
  Plug,
  BrickWall,
  Sofa,
  Refrigerator,
  DoorOpen,
  Sprout,
  Layers,
  Boxes,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icône d'un rayon, choisie à partir du slug de la catégorie.
 * Aucune image externe : les rayons restent lisibles même sans photo.
 */
const ICONS: Record<string, LucideIcon> = {
  'outillage-professionnel': Wrench,
  outillage: Wrench,
  'materiaux-construction': BrickWall,
  construction: BrickWall,
  quincaillerie: Hammer,
  'peinture-finition': PaintRoller,
  peinture: PaintRoller,
  electricite: Plug,
  plomberie: Layers,
  'maison-interieur': Sofa,
  'maison-exterieur': Sprout,
  electromenager: Refrigerator,
  'menuiserie-portes': DoorOpen,
  securite: HardHat,
  jardin: Sprout,
  'equipement-chantier': HardHat,
};

const FALLBACK: LucideIcon = Boxes;

export function categoryIcon(slug: string | null | undefined): LucideIcon {
  if (!slug) return FALLBACK;
  return ICONS[slug] ?? FALLBACK;
}

export const CATEGORY_ICONS = ICONS;
