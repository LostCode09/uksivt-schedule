// Сервис-воркер: сайт открывается и без интернета — с последним расписанием, которое ты смотрел.
// Стратегия «сначала сеть, при неудаче кеш»: онлайн всегда свежие данные, офлайн — сохранённые.
const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const DATA = `data-${VERSION}`;
const SHELL_FILES = ["./", "index.html", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
const MAX_DATA_ENTRIES = 80;   // недели, которые ты открывал; старые вытесняются

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL).then(cache => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== DATA).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      if (limit) {
        const keys = await cache.keys();
        for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
      }
    }
    return response;
  } catch (error) {
    // ?t=g52 в адресе не должен мешать открыть сохранённую страницу
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const isData = url.pathname.includes("/data/");
  event.respondWith(networkFirst(request, isData ? DATA : SHELL, isData ? MAX_DATA_ENTRIES : 0));
});
