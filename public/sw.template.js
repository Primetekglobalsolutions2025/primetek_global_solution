const CACHE_NAME = 'primetek-app-%BUILD_ID%';
const SCOPES = ['/employee/', '/admin/'];

// Install event - pre-cache critical login and shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/employee/login',
        '/admin/login',
        '/favicon.svg',
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

  // Skip caching for:
  // 1. API endpoints (especially mutations and auth sessions)
  // 2. Non-GET requests
  // 3. Hot-reload WebSockets / webpack HMR
  if (
    event.request.method !== 'GET' ||
    url.pathname.includes('/api/') ||
    url.pathname.includes('/_next/') ||
    url.pathname.includes('webpack')
  ) {
    return;
  }

  if (isTargetScope) {
    // Navigation Requests (HTML pages) -> Network-First
    if (event.request.mode === 'navigate') {
      event.respondWith(
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline fallback: serve cached page or matching login portal
            return caches.match(event.request).then((cachedResponse) => {
              if (cachedResponse) return cachedResponse;
              if (url.pathname.startsWith('/admin/')) {
                return caches.match('/admin/login');
              }
              return caches.match('/employee/login');
            });
          })
      );
    } else {
      // Subresources (CSS, JS, Images, Fonts) -> Cache-First
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          });
        })
      );
    }
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

// Message event - skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
