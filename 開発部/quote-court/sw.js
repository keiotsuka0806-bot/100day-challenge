// キャッシュなし — 常に最新ファイルを配信
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request));
});
