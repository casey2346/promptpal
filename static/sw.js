/* static/sw.js */

// 🔖 Timestamp-based version for better control
const CACHE_VERSION = 'v1::' + new Date().toISOString();
const CACHE_NAME = `promptpal-${CACHE_VERSION}`;
const MAX_CACHE_ITEMS = 100;

// 🧩 Multilingual preload
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index.html?lang=zh',
  '/index.html?lang=en',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/styles/main.css',
  '/scripts/main.js',
  '/fallback.png'
];

// 🚀 Install: Cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing and caching static assets...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 🔁 Activate: Clear old caches and enable navigation preload
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log(`[SW] Deleting old cache: ${key}`);
            return caches.delete(key);
          }
        })
      );

      if ('navigationPreload' in self.registration) {
        await self.registration.navigationPreload.enable();
        console.log('[SW] Navigation preload enabled');
      }

      self.clients.claim();
    })()
  );
});

// 🧹 Limit cache size
async function limitCacheSize(name, maxItems) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
  }
}

// 🎛 Dynamic fetch strategy (stale-while-revalidate, with fallback)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const isPerformanceMode = true; // 🔧 Change to false for "data priority" strategy

  if (isPerformanceMode) {
    // 🚀 Stale-While-Revalidate strategy
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              cache.put(event.request, networkResponse.clone());
              limitCacheSize(CACHE_NAME, MAX_CACHE_ITEMS);
              return networkResponse;
            })
            .catch(() => getFallback(event.request));

          return cachedResponse || fetchPromise;
        });
      })
    );
  } else {
    // 📡 Network-first strategy
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() =>
          caches.match(event.request).then((res) => res || getFallback(event.request))
        )
    );
  }
});

// 🔄 Get fallback response by type
function getFallback(request) {
  if (request.destination === 'image') {
    return caches.match('/fallback.png');
  } else if (request.destination === 'document') {
    return caches.match('/index.html');
  } else if (
    request.destination === 'script' ||
    request.destination === 'style'
  ) {
    return new Response('', { status: 200 });
  }
  return Promise.resolve(undefined);
}

// 🔧 Listen to skipWaiting message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
