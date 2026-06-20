/* SisKEN — boot.js (edit di sini) */
/* Mula */
mulaApp();

/* PWA: daftar service worker (perlukan HTTPS & hosting sebenar) */
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
