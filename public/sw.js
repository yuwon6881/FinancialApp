const CACHE_NAME = 'financial-app-v5';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

// Install Event - cache only the minimal app shell.
// Do NOT call skipWaiting() here. Forcing an immediate takeover while the
// WebAPK standalone activity is still bootstrapping causes Android to kill
// and restart the activity (the "flash-quit-reopen" behaviour).
// Instead the *client* asks us to activate (SKIP_WAITING message below) only
// after the page has finished loading, then reloads once — safe, and it makes
// new deploys actually reach installed PWAs instead of waiting forever.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    })
  );
});

// Activate Event - clear old caches.
// Do NOT call clients.claim() — same reason as above.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip caching for API calls, ping endpoints, cross-origin requests, or non-GET requests
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('/ping') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Navigation requests (root / index.html) → Cache-First (stale-while-revalidate).
  // Painting the cached shell immediately avoids the blank/home-screen flash on
  // launch that a network-first wait produces. Freshness is handled separately:
  // the new SW re-caches index.html on install and the client reloads once when
  // it activates (see registerServiceWorker.ts), so a new deploy still lands.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        const network = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
            }
            return networkResponse;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Sub-resources → Cache-First with background revalidation
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Revalidate in background
        fetch(event.request)
          .then((fresh) => {
            if (fresh && fresh.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, fresh));
            }
          })
          .catch(() => {});
        return cached;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return networkResponse;
      });
    })
  );
});
