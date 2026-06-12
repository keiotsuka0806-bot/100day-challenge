// SWキャッシュ更新の4点セット: キャッシュ名インクリメント + skipWaiting + 旧キャッシュ削除 + clients.claim
const CACHE = 'shorts-studio-v2';
const ASSETS = ['./', './index.html', './app.js', './styles.css', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // FFmpeg.wasm等のCDNはキャッシュ対象外(ネットワーク直)
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
