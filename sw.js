const CACHE = 'isabi-mfg-v12.8';
const SHELL = [
  './',
  './index.html',
  './css/app.css?v=12.8',
  './vendor/face-api.js?v=12.8',
  './vendor/models/tiny_face_detector_model-weights_manifest.json',
  './vendor/models/tiny_face_detector_model.bin',
  './vendor/models/ssd_mobilenetv1_model-weights_manifest.json',
  './vendor/models/ssd_mobilenetv1_model.bin',
  './vendor/models/face_landmark_68_model-weights_manifest.json',
  './vendor/models/face_landmark_68_model.bin',
  './vendor/models/face_landmark_68_tiny_model-weights_manifest.json',
  './vendor/models/face_landmark_68_tiny_model.bin',
  './vendor/models/face_recognition_model-weights_manifest.json',
  './vendor/models/face_recognition_model.bin',
  './js/face.js?v=12.8',
  './js/endpoints.js?v=12.8',
  './js/seed_data.js?v=12.8',
  './js/forms_engine.js?v=12.8',
  './js/pbi_pages.js?v=12.8',
  './js/rdl_reports.js?v=12.8',
  './js/kiosk_print.js?v=12.8',
  './js/table_columns.js?v=12.8',
  './js/app.js?v=12.8',
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
        SHELL.map(url => {
          const isImmutableOrVersioned = url.includes('/vendor/') || url.includes('?v=');
          if (isImmutableOrVersioned) {
            return caches.match(url).then(cached => {
              if (cached) return cache.put(url, cached.clone());
              return fetch(new Request(url, { cache: 'no-cache' }))
                .then(res => (res.ok ? cache.put(url, res) : null))
                .catch(() => null);
            });
          }
          return fetch(new Request(url, { cache: 'reload' }))
            .then(res => (res.ok ? cache.put(url, res) : null))
            .catch(() => null);
        })
      )
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith('isabi-mfg-') && k !== CACHE).map(k => caches.delete(k)))
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
  // Cache-first for immutable neural network weights (/vendor/) and cache-busted (?v=...) assets so
  // 12.4 MB of Face ID models + 10.4 MB of seed data load in <30ms instead of re-downloading
  const isCacheFirst = !isNav && (url.pathname.includes('/vendor/') || url.searchParams.has('v'));
  if (isCacheFirst) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(event.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

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
