const CACHE = 'isabi-mfg-v2.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './css/app.css?v=2.0',
  './js/endpoints.js?v=2.0',
  './js/seed_data.js?v=2.0',
  './js/app.js?v=2.0'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(ASSETS.map(u => cache.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.endsWith('/reset.html')) return;
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).catch(() => caches.match('./index.html')))
  );
});
