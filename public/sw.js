const CACHE_NAME = 'kyorugi-referee-v2';
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  if (
    e.request.url.includes('firebaseio.com') ||
    e.request.url.includes('googleapis.com') ||
    e.request.url.includes('gstatic.com')
  ) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((resp) => resp || fetch(e.request))
  );
});
