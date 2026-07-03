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
// The new SW will activate naturally the next time the user opens the app.
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

  // Navigation requests (root / index.html) → Cache-First (stale-while-
  // revalidate).  On a warm relaunch the cached index.html — which contains
  // the inline splash overlay — is served instantly from Cache Storage so the
  // WebView has an opaque surface before any network round-trip.  A background
  // fetch keeps the cache fresh for the next launch.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        // Revalidate in the background regardless
        const networkFetch = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => null);

        // Serve from cache immediately if available; otherwise wait for network
        if (cached) return cached;
        return networkFetch.then((r) =>
          r || caches.match('/index.html').then((f) => f || caches.match('/'))
        );
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
