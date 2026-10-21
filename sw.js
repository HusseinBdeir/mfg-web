const CACHE = 'isabi-mfg-v5.6';
const SHELL = [
  './',
  './index.html',
  './css/app.css?v=5.6',
  './vendor/face-api.js?v=5.6',
  './js/face.js?v=5.6',
  './js/endpoints.js?v=5.6',
  './js/seed_data.js?v=5.6',
  './js/forms_engine.js?v=5.6',
  './js/pbi_pages.js?v=5.6',
  './js/app.js?v=5.6',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(
        SHELL.map(url =>
          fetch(new Request(url, { cache: 'reload' }))
            .then(res => (res.ok ? cache.put(url, res) : null))
            .catch(() => null)
        )
      )
    )
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
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Never serve the recovery page or the local SQLite API from cache; never touch cross-origin (fonts, relay)
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/reset.html') || url.pathname.includes('/api/')) return;

  const isNav = event.request.mode === 'navigate';
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then(hit => hit || (isNav ? caches.match('./index.html') : undefined))
      )
  );
});
