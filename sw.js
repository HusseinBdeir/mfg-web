const CACHE = 'isabi-mfg-v3.0';
const SHELL = [
  './',
  './index.html',
  './css/app.css?v=3.0',
  './js/endpoints.js?v=3.0',
  './js/seed_data.js?v=3.0',
  './js/app.js?v=3.0',
  './manifest.json',
  './icon.svg'
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
  if (url.pathname.endsWith('/reset.html') || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res && res.status === 200 && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
