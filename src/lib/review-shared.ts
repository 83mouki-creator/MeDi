/**
 * Avis clients — partie partagée entre le serveur et le navigateur.
 *
 * Ce fichier ne touche **pas** à la base : il est importé par un composant
 * client (`src/components/reviews.tsx`), et une seule importation de `pg` côté
 * navigateur casse la compilation (« Can't resolve 'util/types' »). Tout ce qui
 * se calcule sans requête — libellés, moyennes, validation, nom publié — vit
 * donc ici ; les lectures et écritures restent dans `src/lib/reviews.ts`.
 */

export type ReviewStatus = 'PENDING' | 'PUBLISHED' | 'HIDDEN';

/** Miroir de l'énumération PostgreSQL `review_status`. */
export const REVIEW_STATUSES: readonly ReviewStatus[] = ['PENDING', 'PUBLISHED', 'HIDDEN'];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: 'À relire',
  PUBLISHED: 'Publié',
  HIDDEN: 'Masqué',
};

export type RatingSummary = {
  count: number;
  average: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

export type PublicProductReview = {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: Date;
  reply: string | null;
  repliedAt: Date | null;
};

export type ReviewableItem = {
  productId: string;
  name: string;
  imageUrl: string | null;
  slug: string | null;
  review: {
    id: string;
    rating: number;
    comment: string | null;
    status: ReviewStatus;
    createdAt: Date;
  } | null;
};

export type OrderReviewContext = {
  orderId: string;
  orderNumber: string;
  delivered: boolean;
  deliveredAt: Date | null;
  items: ReviewableItem[];
  deliveryReview: {
    id: string;
    rating: number;
    comment: string | null;
    onTime: boolean | null;
    status: ReviewStatus;
  } | null;
  /** Reste-t-il quelque chose à noter ? */
  pending: boolean;
};

/**
 * Note 1 → 5 étoiles, entière.
 *
 * Une note absente (0, vide, texte) renvoie 0 — « pas encore noté » — et non 1 :
 * une étoile par défaut ferait baisser la moyenne de tous les articles avec un
 * avis muet.
 */
export function clampRating(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 0;
  return Math.min(5, Math.round(parsed));
}

/**
 * Nom publié : prénom + initiale (`Awa K.`).
 *
 * Publier « Awa Koné, Daloa » sur une fiche produit, c'est donner le nom complet
 * d'une cliente à tous les visiteurs. Le prénom et l'initiale suffisent à
 * crédibiliser l'avis sans l'exposer.
 */
export function publicAuthorName(firstName?: string | null, lastName?: string | null): string {
  const first = (firstName ?? '').trim().split(/\s+/)[0] ?? '';
  const initial = (lastName ?? '').trim().charAt(0).toUpperCase();
  if (!first && !initial) return 'Client Perokado';
  if (!first) return `Client ${initial}.`;
  return initial ? `${first} ${initial}.` : first;
}

export function emptyRatingSummary(): RatingSummary {
  return { count: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
}

/**
 * Calcule le résumé à partir d'une liste de notes.
 *
 * Fonction pure : les tests n'ont pas besoin d'une base, et la fiche produit
 * peut afficher la note d'un article sans requête supplémentaire dès lors
 * qu'elle a déjà lu les avis.
 */
export function summarizeRatings(ratings: readonly number[]): RatingSummary {
  const summary = emptyRatingSummary();
  for (const rating of ratings) {
    const star = clampRating(rating) as 1 | 2 | 3 | 4 | 5;
    if (!star) continue;
    summary.distribution[star] += 1;
    summary.count += 1;
  }
  if (summary.count > 0) {
    const total = ([1, 2, 3, 4, 5] as const).reduce((sum, star) => sum + star * summary.distribution[star], 0);
    summary.average = Math.round((total / summary.count) * 10) / 10;
  }
  return summary;
}

/** Un avis est-il exploitable ? (note valide + minimum de mots si note basse) */
export function validateReviewInput(params: { rating: number; comment?: string | null }):
  | { ok: true; rating: number; comment: string | null }
  | { ok: false; message: string } {
  const rating = clampRating(params.rating);
  if (!rating) return { ok: false, message: 'Choisissez une note de 1 à 5 étoiles.' };

  const comment = (params.comment ?? '').trim();
  if (comment.length > 2000) return { ok: false, message: 'Votre commentaire est trop long (2 000 caractères maximum).' };

  // Une note sévère sans une ligne d'explication n'aide personne : elle
  // n'apprend rien à l'équipe et ne se corrige pas. On demande donc un mot
  // sous 3 étoiles (et seulement là : une bonne note peut rester muette).
  if (rating <= 2 && comment.length < 10) {
    return {
      ok: false,
      message: 'Pour une note de 1 ou 2 étoiles, écrivez quelques mots : qu’est-ce qui n’a pas été ?',
    };
  }

  return { ok: true, rating, comment: comment || null };
}

/** Libellé de note court, ex. « 4,5 sur 5 ». */
export function ratingLabel(summary: RatingSummary): string {
  return `${summary.average.toFixed(1).replace('.', ',')} sur 5`;
}
