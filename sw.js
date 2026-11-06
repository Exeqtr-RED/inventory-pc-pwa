/* Service Worker: офлайн-режим для «Инвентаризация ПК».
   Пути вычисляются от scope, поэтому работает и в корне сайта,
   и в подкаталоге (GitHub Pages: /имя-репозитория/). */
const CACHE = "pc-inventory-v1";
const BASE = new URL(self.registration.scope).pathname; // всегда заканчивается на "/"
const CORE = [
  BASE,
  `${BASE}manifest.json`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BASE)) return;

  // Навигация: сначала сеть, при офлайне — кэш главной
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(BASE, copy));
          return res;
        })
        .catch(() => caches.match(BASE))
    );
    return;
  }

  // Статика: сначала кэш, затем сеть с обновлением кэша
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            if (
              res.ok &&
              (url.pathname.startsWith(`${BASE}_next/static/`) ||
                url.pathname.startsWith(`${BASE}icons/`) ||
                url.pathname === `${BASE}manifest.json`)
            ) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached)
    )
  );
});
