// network-first(記憶庫2026-07-02: 新規PWAは最初からこの型で始める)
const CACHE = 'jiyukenkyu-v2';
const ASSETS = ['./', './index.html', './app.js', './styles.css', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // APIはキャッシュしない(配置パスに依存しない判定/QA 2026-07-11)
  if (e.request.method !== 'GET' || new URL(e.request.url).pathname.includes('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then(r => {
          if (r) return r;
          if (e.request.mode === 'navigate') {
            // index.htmlも未キャッシュならundefinedを返さず明示エラー(QA 2026-07-11)
            return caches.match('./index.html').then(idx => idx || Response.error());
          }
          return Response.error();
        })
      )
  );
});
