import { formatDms, googleMapsDirectionsUrl, googleMapsPlaceUrl, osmPageUrl, type GeoPoint } from './geo';
import type { PublicSettings } from './settings';

/**
 * Emplacement exact de la boutique, communiqué par le propriétaire.
 *
 * Relevé Google Maps : 6°53'04.4"N 6°26'50.9"W, soit 6.884556 / -6.447472.
 * Ces valeurs servent de repli tant que les coordonnées ne sont pas encore
 * enregistrées en base : le visiteur voit toujours l'adresse exacte, jamais un
 * « à compléter » sur l'information la plus utile pour venir à la boutique.
 */
export const STORE_COORDINATES: GeoPoint = { latitude: 6.884556, longitude: -6.447472 };

/** Coordonnées écrites comme sur Google Maps (format demandé par le propriétaire). */
export const STORE_GPS_DMS = `6°53'04.4"N 6°26'50.9"W`;

/** Même position en notation francophone (degrés, minutes, secondes). */
export const STORE_GPS_DMS_FR = '6°53′04.4″ N · 6°26′50.9″ O';

export type StoreLocation = {
  point: GeoPoint;
  /** Coordonnées au format Google Maps, prêtes à être copiées. */
  dms: string;
  /** Coordonnées décimales, pour les GPS de voiture. */
  decimal: string;
  addressLine: string;
  city: string;
  country: string;
  mapsUrl: string;
  directionsUrl: string;
  osmUrl: string;
};

/**
 * Emplacement affichable : les coordonnées saisies dans l'administration ont
 * priorité ; à défaut, on utilise le relevé communiqué par le propriétaire.
 */
export function storeLocation(settings: PublicSettings): StoreLocation {
  const point = settings.geo ?? STORE_COORDINATES;
  const city = settings.city;
  const country = settings.country;
  return {
    point,
    // Toujours en degrés/minutes/secondes : c'est la forme demandée, et elle
    // reste juste même si les coordonnées sont mises à jour depuis l'admin.
    dms: formatDms(point),
    decimal: `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`,
    addressLine: settings.addressLine ?? `${STORE_GPS_DMS} — ${city}`,
    city,
    country,
    mapsUrl: googleMapsPlaceUrl(point),
    directionsUrl: googleMapsDirectionsUrl(point),
    osmUrl: osmPageUrl(point),
  };
}

/** Lien WhatsApp vers la boutique avec un message déjà écrit. */
export function whatsappWithMessage(settings: { whatsapp?: string | null; phone?: string | null }, message: string): string | null {
  const raw = settings.whatsapp ?? settings.phone;
  if (!raw) return null;
  const number = raw.replace(/\D/g, '');
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export type TransportQuoteItem = { name: string; quantity: number };

/**
 * Message pré-rempli pour négocier le transport hors Daloa.
 *
 * On y met tout ce qui permet au boutiquier de répondre du premier coup :
 * ville de destination, produits, montant des articles et numéro de commande.
 */
export function transportQuoteMessage(params: {
  city: string;
  items: TransportQuoteItem[];
  subtotal?: number;
  orderNumber?: string;
  customerName?: string;
  phone?: string;
}): string {
  const lines = [
    `Bonjour MeDi, je souhaite faire livrer une commande hors Daloa (${params.city}).`,
    'Pouvez-vous me donner le prix du transport et le délai ?',
  ];
  if (params.orderNumber) lines.push(`Commande : ${params.orderNumber}`);
  if (params.items.length > 0) {
    const detail = params.items
      .slice(0, 8)
      .map((item) => `• ${item.name} × ${item.quantity}`)
      .join('\n');
    lines.push('Produits :', detail);
    if (params.items.length > 8) lines.push(`… et ${params.items.length - 8} autre(s) article(s).`);
  }
  if (typeof params.subtotal === 'number') {
    lines.push(`Montant des articles : ${new Intl.NumberFormat('fr-FR').format(params.subtotal)} FCFA`);
  }
  if (params.customerName) lines.push(`Nom : ${params.customerName}`);
  if (params.phone) lines.push(`Téléphone : ${params.phone}`);
  return lines.join('\n');
}

/** Message pour demander un délai de retrait ou signaler un empêchement. */
export function pickupMessage(orderNumber?: string): string {
  return orderNumber
    ? `Bonjour MeDi, je viens au sujet de ma commande ${orderNumber} à retirer en boutique.`
    : 'Bonjour MeDi, je souhaite retirer un colis en boutique.';
}
