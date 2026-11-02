import { revalidatePath } from 'next/cache';

/**
 * Rend immédiatement visibles sur la vitrine les changements faits dans
 * l'administration (prix, promotions, stock, réglages).
 *
 * `revalidatePath('/', 'layout')` rafraîchit tout l'arbre du site : c'est
 * volontairement large, car une promotion touche l'accueil, les rayons, la
 * recherche et chaque fiche produit à la fois.
 */
export function refreshStorefront() {
  try {
    revalidatePath('/', 'layout');
  } catch {
    // Appelé hors d'une requête Next (script, test) : rien à rafraîchir.
  }
}
