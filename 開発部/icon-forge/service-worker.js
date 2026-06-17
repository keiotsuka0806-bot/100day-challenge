const CACHE  = 'icon-forge-v1';
const ASSETS = ['/', '/index.html', '/app.js', '/styles.css', '/manifest.json'];

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

self.addEventListener('fetch', e => {
  // CDN(JSZip)はキャッシュ対象外
  if (e.request.url.includes('cdnjs')) return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
