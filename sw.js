/* ── Work Order Dashboard — Service Worker ─────────────────────────────── */

var CACHE_NAME = 'wo-dashboard-v1.7.0';

var APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './config.js',
  './manifest.json'
];

/* Install: pre-cache app shell */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // addAll fails entirely if any request fails, so add individually
      return Promise.all(
        APP_SHELL.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn('[SW] Failed to cache ' + url + ':', err);
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* Activate: remove old caches */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* Fetch: network-first for Sheets API, cache-first for app shell */
self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);

  // Network-first for Google Sheets published CSV
  if (url.hostname === 'docs.google.com') {
    event.respondWith(
      fetch(event.request).catch(function () {
        return new Response(
          JSON.stringify({
            error: {
              message: 'You are offline. Please reconnect to load your work orders.'
            }
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Cache-first for everything else (app shell)
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        if (response && response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});
