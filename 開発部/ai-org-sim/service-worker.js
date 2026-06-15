// network-first SW(記憶庫lesson 2026-06-14: cache-firstだとデプロイしても旧コードを掴み続ける)。
// まず新しい版を取りに行き、取れたらキャッシュ更新。オフライン時のみキャッシュへフォールバック。
const CACHE = "aiorgsim-v1";
const ASSETS = ["/", "/index.html", "/app.js", "/styles.css", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  // APIは常にネットワーク(キャッシュしない)
  if (request.method !== "GET" || new URL(request.url).pathname.startsWith("/api/")) {
    return;
  }
  e.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request))
  );
});
