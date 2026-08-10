// Repact PWA — сеть первична, кэш как офлайн-запас оболочки.
const CACHE = "repact-v182";
const SHELL = [
  ".",
  "index.html",
  "styles.css?v=170",
  "app.js?v=181",
  "pose.js?v=177",
  "sync.js?v=175",
  "workout-session.js?v=172",
  "ua.js?v=173",
  "firebase-config.js",
  "manifest.json",
  "icons/icon-192.png?v=logo2",
  "icons/icon-512.png?v=logo2",
  "icons/icon-180.png?v=logo2",
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
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        }
        return res;
      })
      // index.html как фолбэк — только для навигации, иначе js/css получили бы HTML вместо кода.
      .catch(() => caches.match(request).then((r) => r || (request.mode === "navigate" ? caches.match("index.html") : new Response("", { status: 504 }))))
  );
});
