const CACHE = "aida-v5";
const ASSETS = ["/", "/index.html", "/app.js", "/questions.js", "/styles.css", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ネットワーク優先: 常に最新コードを取りに行き、オフライン時だけキャッシュにフォールバック。
// (キャッシュ優先だと古いapp.jsを掴み続け、修正が反映されない問題が起きるため)
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/") || url.hostname.includes("googleapis") || url.hostname.includes("gstatic")) {
    return; // APIとFirebase/フォントは常にネットワーク
  }
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
