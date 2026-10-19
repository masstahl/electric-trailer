/* sw.js — service worker: cache the app shell so Electric Trailer
 * opens instantly and works fully offline (#16 Offline-First).
 * AppSheet API calls are never cached — they always go to the network,
 * and edits made offline are queued by the app instead.
 */
var CACHE = 'electric-trailer-v1';
var SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'appsheet.js',
  'manifest.webmanifest'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  // Never intercept AppSheet API traffic.
  if (url.hostname.indexOf('appsheet.com') !== -1) return;
  if (event.request.method !== 'GET') return;
  // Cache-first for the app shell (same origin), network fallback,
  // and refresh the cache in the background for next time.
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function (cached) {
      var network = fetch(event.request).then(function (res) {
        if (res && res.ok && url.origin === self.location.origin) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
