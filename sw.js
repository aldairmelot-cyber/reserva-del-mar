/* Service worker mínimo (v2): permite instalar la app en el celular.
   Siempre busca primero la versión en línea (los datos y la app quedan al día);
   solo usa la copia guardada si no hay conexión. No toca Firebase ni Google. */
const CACHE = "reserva-del-mar-v2";
const BASE = ["./", "./index.html", "./caso-824-1124.html", "./config.js", "./plataforma.js", "./manifest.webmanifest", "./iconos/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  /* cache "no-cache": siempre pregunta al servidor si hay versión nueva (evita mostrar una copia vieja). */
  e.respondWith(fetch(req, { cache: "no-cache" }).then((res) => {
    if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {}); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./index.html"))));
});
