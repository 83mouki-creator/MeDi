/**
 * Version des URLs d'images locales.
 *
 * Le serveur d'images de Next met chaque vignette optimisée en cache **sous la
 * clé de l'URL source** : remplacer un fichier au même chemin ne suffit pas, les
 * visiteurs continuent de recevoir l'ancienne version pendant des jours (cas
 * rencontré en changeant les bandeaux des photos produit).
 *
 * On ajoute donc `?v=<version>` à l'affichage, à partir d'une information qui
 * change quand le fichier change :
 *   – l'empreinte (`checksum`) enregistrée avec la photo, quand elle existe ;
 *   – sinon la date de dernière modification de l'import (repli).
 *
 * Le calcul est fait ici, et non dans les données importées : les sites déjà en
 * production retrouvent ainsi des URL neuves sans réimport ni migration.
 */

/** Version déjà présente dans l'URL (`?v=…`), ou chaîne vide. */
function existingVersion(query: string) {
  const match = /(?:^|&)v=([A-Za-z0-9_-]{4,64})/.exec(query);
  return match?.[1] ?? '';
}

/**
 * Ajoute `?v=…` à une URL de vignette locale (`/catalogue/…`). Les URL absolues
 * (Cloudinary, Unsplash) et les autres chemins statiques sont laissés tels quels :
 * ils changent de nom quand leur contenu change, ou ne sont pas concernés.
 */
export function versionedImageUrl(url: string | null, version?: string | null): string | null {
  if (!url) return null;
  if (!url.startsWith('/catalogue/')) return url;

  const [path, query = ''] = url.split('?');
  const known = existingVersion(query) || (version ?? '');
  if (!known) return path!;
  return `${path}?v=${known.slice(0, 12)}`;
}
