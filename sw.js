/* Cache simple del shell para que ande sin conexión. Subí VERSION al cambiar archivos. */
var VERSION = "econochanta-v10";
var SHELL = ["./", "index.html", "styles.css", "app.js", "api.js", "series.js", "charts.js", "glosario.js", "tablero.js", "data.js", "manifest.webmanifest", "assets/icon.svg"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(function (res) {
        var copia = res.clone();
        caches.open(VERSION).then(function (c) { c.put(e.request, copia); });
        return res;
      })
      .catch(function () { return caches.match(e.request); })
  );
});
