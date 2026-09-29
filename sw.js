/* ============================================================
   SisKEN — Service Worker (PWA)
   Strategi: network-first untuk fail app (sentiasa dapat versi
   terkini bila online), fallback ke cache bila luar talian.
   Permintaan ke API backend (php/api.php) TIDAK di-cache.
   ============================================================ */
const CACHE = "sisken-v12"; // naikkan nombor (v2, v3...) bila kemas kini app

const ASET = [
  "./",
  "./index.html",
  "./style.css",
  "./js/core.js",
  "./js/awam.js",
  "./js/dashboard.js",
  "./js/tempahan.js",
  "./js/kenderaan.js",
  "./js/pemandu.js",
  "./js/selenggara.js",
  "./js/laporan.js",
  "./js/pengguna.js",
  "./js/tugasan.js",
  "./js/log.js",
  "./js/boot.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASET))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Jangan sentuh permintaan ke domain lain (cth: API Apps Script)
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const salinan = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, salinan));
        return res;
      })
      .catch(() =>
        caches.match(e.request).then(
          (m) => m || caches.match("./index.html")
        )
      )
  );
});
