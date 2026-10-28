/**
 * Résolution des URLs de base de données.
 *
 * Deux connexions sont nécessaires :
 *  - **poolée** (`DATABASE_URL`) : utilisée par l'application (serverless = beaucoup
 *    de connexions courtes) ;
 *  - **directe** (`DIRECT_URL`) : utilisée par les migrations et les scripts, car
 *    le pooler (PgBouncer) ne garantit pas les verrous DDL.
 *
 * Selon la façon dont la base a été créée, le nom de la variable diffère :
 *
 *  | Origine                              | Poolée                  | Directe                     |
 *  | ------------------------------------ | ----------------------- | --------------------------- |
 *  | Création manuelle (ce projet)        | `DATABASE_URL`          | `DIRECT_URL`                |
 *  | Intégration Neon sur Vercel          | `DATABASE_URL`          | `DATABASE_URL_UNPOOLED`     |
 *  | Ancien Vercel Postgres (migré Neon)  | `POSTGRES_URL`          | `POSTGRES_URL_NON_POOLING`  |
 *
 * L'URL directe est donc cherchée dans cet ordre, avec en dernier recours la
 * dérivation depuis l'URL poolée : l'hôte `ep-xxx-pooler.region.aws.neon.tech`
 * devient `ep-xxx.region.aws.neon.tech` (le endpoint direct existe toujours).
 *
 * Ce module ne lit que `process.env` : il est utilisable aussi bien par
 * l'application que par les scripts CLI et drizzle-kit.
 */

const trim = (value: string | undefined): string => (value ?? '').trim();

/** Retire le suffixe `-pooler` de l'hôte Neon pour obtenir le endpoint direct. */
export function stripPoolerSuffix(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('-pooler.')) {
      parsed.hostname = parsed.hostname.replace('-pooler.', '.');
      return parsed.toString();
    }
    return url;
  } catch {
    // URL non standard : on ne tente pas de transformation hasardeuse.
    return url;
  }
}

/** Connexion applicative (poolée). */
export function resolveDatabaseUrl(): string {
  return trim(process.env.DATABASE_URL) || trim(process.env.POSTGRES_URL);
}

export type DirectUrlSource = 'DIRECT_URL' | 'DATABASE_URL_UNPOOLED' | 'POSTGRES_URL_NON_POOLING' | 'derivee' | 'absente';

/**
 * Connexion directe (migrations, imports, sauvegardes).
 * Renvoie la chaîne vide si rien n'est configuré.
 */
export function resolveDirectUrl(): string {
  const resolved = resolveDirectUrlWithSource();
  return resolved.url;
}

export function resolveDirectUrlWithSource(): { url: string; source: DirectUrlSource } {
  const explicit = trim(process.env.DIRECT_URL);
  if (explicit) return { url: explicit, source: 'DIRECT_URL' };

  const neonUnpooled = trim(process.env.DATABASE_URL_UNPOOLED);
  if (neonUnpooled) return { url: neonUnpooled, source: 'DATABASE_URL_UNPOOLED' };

  const vercelUnpooled = trim(process.env.POSTGRES_URL_NON_POOLING);
  if (vercelUnpooled) return { url: vercelUnpooled, source: 'POSTGRES_URL_NON_POOLING' };

  const pooled = resolveDatabaseUrl();
  if (pooled) return { url: stripPoolerSuffix(pooled), source: 'derivee' };

  return { url: '', source: 'absente' };
}

/** Nom d'hôte masqué, pour les journaux (jamais de mot de passe affiché). */
export function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '(URL invalide)';
  }
}
