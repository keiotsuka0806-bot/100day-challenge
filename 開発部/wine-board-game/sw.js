const CACHE = 'vinroute-v1';
const FILES = ['./', './index.html', './styles.css', './app.js', './map.js', './quiz.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
