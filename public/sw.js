const CACHE_NAME = 'primetek-app-v2';
const SCOPES = ['/employee/', '/admin/'];

// Install event - pre-cache critical login and shell assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/employee/login',
        '/admin/login',
        '/favicon.ico',
        '/icons/icon-192.png',
        '/icons/icon-512.png'
      ]);
    })
  );
});

// Fetch event - handle routing, dynamic cache storage, and offline fallbacks
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isTargetScope = SCOPES.some(scope => url.pathname.startsWith(scope));

  // Only intercept page and asset requests within target scopes
  if (isTargetScope) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Return cached asset if present, else fetch from network
        return cachedResponse || fetch(event.request).then((networkResponse) => {
          // Dynamic runtime caching criteria:
          // 1. Must be GET request
          // 2. Must return successful HTTP 200
          // 3. Skip API endpoints and hot-reload WebSockets to prevent session/state issues
          if (
            event.request.method === 'GET' &&
            networkResponse.status === 200 &&
            !url.pathname.includes('/api/') &&
            !url.pathname.includes('/_next/')
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      }).catch(() => {
        // Offline Fallback Handler
        // Serve specific login routes depending on directory scope if network fails completely
        if (url.pathname.startsWith('/admin/')) {
          return caches.match('/admin/login');
        }
        return caches.match('/employee/login');
      })
    );
  }
});

// Activate event - flush old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
