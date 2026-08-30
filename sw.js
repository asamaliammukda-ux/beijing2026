const CACHE_NAME = 'beijing-trip-v1';
const PRECACHE_URLS = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/vendor/papaparse.min.js',
  'data/hero.json',
  'data/itinerary.csv',
  'data/restaurants.csv',
  'data/budget.csv',
  'data/checklist.json',
  'images/hero-bg.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Network-first: try the network, cache a copy of successful GET responses,
// fall back to the cache (or the shell page for navigations) when offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('index.html'))
      )
  );
});
