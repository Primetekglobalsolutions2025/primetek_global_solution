const CACHE_NAME = 'primetek-app-31d5aa11-074e-43fd-9b3d-33e7a1756311';
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

// Push event handler - receive and display Web Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || 'Primetek Portal';
    const options = {
      body: payload.message,
      icon: payload.icon || '/icons/icon-192.png',
      badge: payload.badge || '/favicon.svg', // Monochrome badge for status bar
      image: payload.image || undefined,       // Support rich banner image
      vibrate: payload.vibrate || [100, 50, 100],
      data: {
        url: payload.clickActionUrl || '/employee/dashboard',
        actions: payload.actions || []
      },
      tag: payload.tag || 'primetek-notification',
      renotify: true,
      actions: payload.actions || [] // Action buttons inside notification drawer
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('Error handling service worker push event:', err);
  }
});

// Notification click event handler - open/navigate client standalone window
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const clickActionUrl = (notification.data && notification.data.url) ? notification.data.url : '/employee/dashboard';

  notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, navigate to the target URL and focus it
      for (const client of clientList) {
        const url = new URL(client.url);
        if (url.origin === self.location.origin) {
          return client.focus().then(() => client.navigate(clickActionUrl));
        }
      }
      // If no window is open, open a new client standalone window
      if (self.clients.openWindow) {
        return self.clients.openWindow(clickActionUrl);
      }
    })
  );
});
