/* sw.js — service worker: cache the app shell so Electric Trailer
 * opens instantly and works fully offline (#16 Offline-First).
 * Backend API calls (AppSheet, Google Sheet bridge) are never cached —
 * they always go to the network, and edits made offline are queued
 * by the app instead.
 */
var CACHE = 'electric-trailer-v32';
var SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'appsheet.js',
  'sheets.js',
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
  // Never intercept backend API traffic (AppSheet API, Sheet bridge).
  if (url.hostname.indexOf('appsheet.com') !== -1) return;
  if (url.hostname.indexOf('script.google.com') !== -1) return;
  if (url.hostname.indexOf('script.googleusercontent.com') !== -1) return;
  if (event.request.method !== 'GET') return;
  // Cross-origin requests (item photos from supplier sites, fonts, etc.)
  // are the browser's business — intercepting them here adds failure
  // modes without adding caching (we never store them).
  if (url.origin !== self.location.origin) return;
  // Cache-first for the app shell (same origin), network fallback,
  // and refresh the cache in the background for next time. The promise
  // given to respondWith must ALWAYS settle to a real Response: if the
  // network fails and nothing is cached, serve the app shell for page
  // loads and a plain 503 for anything else — never undefined/null,
  // which is what produced "FetchEvent.respondWith … Returned response
  // is null" in the console.
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function (cached) {
      var network = fetch(event.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        }
        return res;
      }).catch(function () {
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return caches.match('index.html', { ignoreSearch: true }).then(function (shell) {
            return shell || new Response('Offline', { status: 503, statusText: 'Offline' });
          });
        }
        return new Response('', { status: 503, statusText: 'Offline' });
      });
      return cached || network;
    })
  );
});
