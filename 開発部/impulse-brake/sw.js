/* 衝動ブレーキ Service Worker
   方針: ネットワーク優先（常に最新を取得・オフライン時のみキャッシュ）。
   これで「古いキャッシュ版が居座って画面が出ない」問題を防ぐ。 */
const CACHE = 'impulse-brake-v7';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon.svg',
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
  // APIは常にネットワーク（キャッシュしない）
  if (request.url.includes('/api/')) return;
  if (request.method !== 'GET') return;
  // ネットワーク優先: 取れたら最新を返しつつキャッシュ更新、失敗時のみキャッシュ、最後はindex.html
  e.respondWith(
    fetch(request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then(hit => hit || caches.match('./index.html')))
  );
});
