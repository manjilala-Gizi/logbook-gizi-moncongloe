/* Service worker: agar aplikasi bisa dibuka tanpa internet.
 * Naikkan VERSI setiap kali file aplikasi diperbarui. */
var VERSI = 'logbook-gizi-v1.1.0';
var FILE = ['./', 'index.html', 'app.js', 'sync.js', 'cetak.js', 'capaian.js', 'exceljs.min.js',
  'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSI).then(function (c) { return c.addAll(FILE); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSI; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (e) { if (e.data === 'lewati') self.skipWaiting(); });
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      if (res && res.ok) { var salin = res.clone(); caches.open(VERSI).then(function (c) { c.put(req, salin); }); }
      return res;
    }).catch(function () { return req.mode === 'navigate' ? caches.match('index.html') : Response.error(); });
  }));
});
