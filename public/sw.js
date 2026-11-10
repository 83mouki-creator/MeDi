/*
 * Service worker de Perokado.
 *
 * Rôle volontairement limité : le site vient du serveur à chaque visite (prix,
 * stock et commandes ne doivent jamais être servis depuis un cache périmé). Le
 * service worker apporte seulement :
 *   – une page « pas de connexion » lisible quand le réseau tombe ;
 *   – un cache des images et des fichiers statiques (catalogue plus rapide).
 *
 * Aucune requête d'action (POST), aucune page de commande ou d'administration
 * n'est mise en cache.
 */
const CACHE = 'perokado-v1';
const OFFLINE_URL = '/offline';

// Secours minimal si la page /offline n'a pas pu être enregistrée.
const FALLBACK_HTML =
  '<!doctype html><html lang="fr"><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Pas de connexion | Perokado</title>' +
  '<body style="margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui;background:#0e2340;color:#fff;text-align:center;padding:24px">' +
  '<div><h1 style="font-size:20px;margin:0 0 8px">Pas de connexion</h1>' +
  '<p style="margin:0 0 16px;opacity:.8">Vérifiez votre connexion internet, puis réessayez.</p>' +
  '<a href="/" style="display:inline-block;background:#f2b705;color:#0e2340;font-weight:700;' +
  'text-decoration:none;padding:10px 18px;border-radius:10px">Réessayer</a></div></body></html>';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // `reload` : on ne récupère pas une vieille copie du cache HTTP.
      await cache.add(new Request(OFFLINE_URL, { cache: 'reload' })).catch(() => undefined);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Ressources d'un autre domaine (Wave, WhatsApp, Google Maps) : jamais touchées.
  if (url.origin !== self.location.origin) return;

  // Les pages viennent toujours du réseau ; la page hors-ligne prend le relais.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cached = await caches.match(OFFLINE_URL);
          return (
            cached ??
            new Response(FALLBACK_HTML, {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
          );
        }
      })(),
    );
    return;
  }

  // Images et fichiers statiques : cache d'abord, réseau ensuite.
  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.startsWith('/brand/') ||
    url.pathname.startsWith('/catalogue/');
  if (!isStatic) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});
