/* 引き継ぎ職人 Service Worker
   方針: ネットワーク優先（常に最新を取得・オフライン時のみキャッシュ）。
   古いキャッシュが居座って画面が更新されない問題を防ぐ（記憶庫 2026-07-02 の既定）。 */
const CACHE = 'hikitsugi-shokunin-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.url.includes('/api/')) return;
  if (request.method !== 'GET') return;
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(request).then(hit =>
        hit || (request.mode === 'navigate' ? caches.match('./index.html') : Response.error())
      ))
  );
});
