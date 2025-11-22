// service-worker.js

const CACHE_NAME = "shelf-lotes-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json"
  // se tiver CSS/JS externos em arquivos separados, adicione aqui
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Navegações (HTML): network first
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Outros arquivos: cache first, depois rede
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
