/* Service worker de ScalpSignal Pro.
   Guarda la interfaz para que abra rápido y funcione como app, pero NUNCA guarda datos de mercado:
   las peticiones a Bybit y Telegram van siempre directo a la red. */
const VERSION = "8e328e5c8b";
const CACHE = `scalpsignal-${VERSION}`;
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png",
  "https://unpkg.com/lightweight-charts@5.2.1/dist/lightweight-charts.standalone.production.js"];
const NEVER = ["api.bybit.com", "stream.bybit.com", "api.telegram.org"];

self.addEventListener("install", (e) => {
  // "reload": no usar la caché HTTP del navegador (GitHub Pages la guarda 10 min) para no instalar una versión vieja
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("scalpsignal-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || NEVER.some((h) => url.hostname.endsWith(h))) return;      // datos de mercado: siempre en vivo
  if (req.mode === "navigate" || url.pathname.endsWith("/index.html")) {
    // la página: primero la red (para recibir actualizaciones), si no hay conexión la copia guardada
    e.respondWith(fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put("./index.html", cp)); return r; })
      .catch(() => caches.match("./index.html")));
    return;
  }
  // librería del gráfico, fuentes e íconos: copia guardada y actualización en segundo plano
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((r) => { if (r.ok || r.type === "opaque") { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => (cs.length ? cs[0].focus() : self.clients.openWindow("./"))));
});
