/*
 * Service worker: hace que la app ande sin conexión y que nunca mezcle versiones.
 * Al publicar cambios: subí VERSION acá y el mismo número en los ?v= de index.html
 * (CSS y scripts). Así el HTML nuevo siempre pide los archivos nuevos, aunque el
 * navegador tenga guardados los viejos (GitHub Pages los deja 10 minutos en caché).
 */
var V = "31";
var VERSION = "econochanta-v" + V;
var ARCHIVOS = ["styles.css", "data.js", "api.js", "series.js", "charts.js", "glosario.js", "analisis.js", "lectura.js", "mandatos.js", "tablero.js", "secciones.js", "cinta.js", "app.js"];
var SHELL = ["./", "index.html", "manifest.webmanifest", "assets/icon.svg", "assets/icon-192.png", "assets/icon-512.png"]
  .concat(ARCHIVOS.map(function (f) { return f + "?v=" + V; }));

self.addEventListener("install", function (e) {
  // cache: "reload" baja cada archivo del servidor, sin pasar por la caché del navegador
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: "reload" }); }));
  }));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  // solo los archivos propios: los pedidos a las APIs van directo (la app ya guarda sus datos)
  if (new URL(req.url).origin !== self.location.origin) return;
  var esPagina = req.mode === "navigate";
  e.respondWith(
    // primero la red, revalidando con el servidor (no-cache): siempre la versión publicada
    fetch(req.url, { cache: "no-cache", credentials: "same-origin" })
      .then(function (res) {
        if (res && res.ok) {
          var copia = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copia); });
        }
        return res;
      })
      .catch(function () {
        // sin conexión: la copia guardada; para la página, el index de esta versión
        return caches.match(req).then(function (r) {
          return r || (esPagina ? caches.match("index.html") : undefined);
        });
      })
  );
});
