// FitStake PWA — сеть первична, кэш как офлайн-запас оболочки.
const CACHE = "fitstake-v95";
const SHELL = [
  ".",
  "index.html",
  "styles.css?v=95",
  "app.js?v=95",
  "pose.js?v=95",
  "sync.js?v=95",
  "workout-session.js?v=95",
  "firebase-config.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Модель и wasm MediaPipe качаем с CDN мимо кэша.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
      // index.html как фолбэк — только для навигации, иначе js/css получили бы HTML вместо кода.
      .catch(() => caches.match(request).then((r) => r || (request.mode === "navigate" ? caches.match("index.html") : new Response("", { status: 504 }))))
  );
});
