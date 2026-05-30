const CACHE_NAME = 'primetek-app-%BUILD_ID%';
const SCOPES = ['/employee', '/admin'];

// Utility to bound dynamic caches to prevent storage exhaustion
function limitCacheSize(cacheName, maxItems) {
  caches.open(cacheName).then((cache) => {
    cache.keys().then((keys) => {
      if (keys.length > maxItems) {
        const deleteCount = keys.length - maxItems;
        for (let i = 0; i < deleteCount; i++) {
          cache.delete(keys[i]);
        }
      }
    });
  });
}

// Install event - pre-cache critical login and shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/employee/login',
        '/admin/login',
        '/favicon.svg',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
        '/splash/apple-splash-640-1136.png',
        '/splash/apple-splash-750-1334.png',
        '/splash/apple-splash-1170-2532.png',
        '/splash/apple-splash-1290-2796.png'
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
  // 3. Hot-reload WebSockets / webpack HMR / hot updates
  if (
    event.request.method !== 'GET' ||
    url.pathname.includes('/api/') ||
    url.pathname.includes('webpack') ||
    url.pathname.includes('hot-update')
  ) {
    return;
  }

  // 1. Next.js Immutable Static Assets -> Cache-First
  if (url.pathname.includes('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open('static-assets').then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 2. Next.js Dynamic Page Data fetches -> Network-First (fallback to cache)
  if (url.pathname.includes('/_next/data/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).then(() => {
                limitCacheSize(CACHE_NAME, 50);
              });
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
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
                cache.put(event.request, responseToCache).then(() => {
                  limitCacheSize(CACHE_NAME, 50);
                });
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline fallback: serve cached page or matching login portal shell
            return caches.match(event.request).then((cachedResponse) => {
              if (cachedResponse) return cachedResponse;
              if (url.pathname.startsWith('/admin')) {
                return caches.match('/admin/login');
              }
              return caches.match('/employee/login');
            });
          })
      );
    } else {
      // Subresources (Images, Fonts, global dynamic files) -> Cache-First
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache).then(() => {
                  limitCacheSize(CACHE_NAME, 50);
                });
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
          if (cacheName !== CACHE_NAME && cacheName !== 'static-assets') {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Background Sync event handler
self.addEventListener('sync', (event) => {
  if (event.tag === 'attendance-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGERED' });
        });
      })
    );
  }
});

// Message event - skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
