const CACHE = 'nani-taberu-v3';
const ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/pfc-table.js', '/fallback-recipes.js', '/rakuten-api.js', '/recommender.js', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('rakuten.co.jp') || e.request.url.includes('firestore') || e.request.url.includes('googleapis')) return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
