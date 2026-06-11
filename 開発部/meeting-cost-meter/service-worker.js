const CACHE = 'mcm-v3';
const ASSETS = ['/', '/index.html', '/app.js?v=3', '/styles.css?v=3', '/manifest.json'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e =>
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', e =>
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
