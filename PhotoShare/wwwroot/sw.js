/* PhotoShare service worker.
 * Strategy:
 *   - app shell (/, /Account, /Gallery routes) -> stale-while-revalidate
 *   - hashed static assets (/_content/Memtly.Core/dist/*) -> cache-first
 *   - gallery upload + admin POSTs -> network-only (no caching)
 *   - uploaded media (/uploads/*, /thumbnails/*) -> NEVER pre-cache;
 *     these can be huge and event-bound. Browser http cache handles them.
 * Bump SW_VERSION below to invalidate caches on deploy.
 */

const SW_VERSION = '2.0.0';
const STATIC_CACHE = `photoshare-static-${SW_VERSION}`;
const SHELL_CACHE = `photoshare-shell-${SW_VERSION}`;

self.addEventListener('install', (event) => {
  // Activate immediately so the new worker controls clients on next navigation.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, SHELL_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache uploaded media or thumbnails.
  if (/^\/(uploads|thumbnails|temp|custom_resources)\//.test(url.pathname)) {
    return;
  }

  // Hashed bundle output: cache-first.
  if (url.pathname.startsWith('/_content/Memtly.Core/dist/')) {
    event.respondWith(cacheFirst(STATIC_CACHE, req));
    return;
  }

  // App shell HTML: stale-while-revalidate.
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(staleWhileRevalidate(SHELL_CACHE, req));
    return;
  }
});

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    return new Response('', { status: 504, statusText: 'Gateway Timeout' });
  }
}

async function staleWhileRevalidate(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || network;
}
