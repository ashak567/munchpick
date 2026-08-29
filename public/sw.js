const CACHE_NAME = 'munchpick-cache-v2';
const STATIC_ASSETS = [
  '/favicon.ico',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // For all API requests (non-GET methods or /api/* paths), always go direct to network.
  // This prevents any possibility of a cached POST /api/chat response being returned.
  if (request.method !== 'GET' || new URL(request.url).pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // For navigation / HTML requests, always use Network-First to guarantee fresh application shells
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request).then((cached) => {
          return cached || new Response('Offline mode active. Connect to the internet to query Munch AI!', {
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
    );
    return;
  }

  // For static assets, use Cache-First with Network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      return cachedResponse || fetch(request);
    }).catch(() => {
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })
  );
});
