/* Offline shell. Cache-first: the app never changes at runtime. */
const CACHE = 'smallstep-v2';
const ASSETS = [
  './', './index.html', './style.css', './fonts.css', './app.js', './settings.js',
  './srs.js', './exercises.js',
  './content/lessons.js', './content/contrastive.js',
  './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './fonts/plex-sans-var-latin.woff2', './fonts/plex-sans-var-cyrillic.woff2',
  './fonts/plex-mono-400-latin.woff2', './fonts/plex-mono-400-cyrillic.woff2',
  './fonts/plex-mono-600-latin.woff2', './fonts/plex-mono-600-cyrillic.woff2',
  './fonts/plex-serif-600-latin.woff2', './fonts/plex-serif-600-cyrillic.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
