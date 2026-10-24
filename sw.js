/* Smart Pantry service worker v2: refresh icon assets and retain Web Push handling. */
const ICON_CACHE = "smart-pantry-icons-v2";
const ICON_ASSETS = ["./icon-v2.svg","./icon-maskable-v2.svg","./icon-180-v2.png","./icon-192-v2.png","./icon-512-v2.png","./icon-maskable-512-v2.png"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(ICON_CACHE).then(cache => cache.addAll(ICON_ASSETS)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("smart-pantry-icons-") && key !== ICON_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  const filename = url.pathname.split("/").pop();
  if (url.origin !== self.location.origin || !ICON_ASSETS.some(asset => asset.slice(2) === filename)) return;
  event.respondWith(caches.open(ICON_CACHE).then(async cache => {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) cache.put(event.request, response.clone());
    return response;
  }));
});
/* Smart Pantry service worker: displays server-sent Web Push notifications. */
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (_) { data = { title: "Smart Pantry", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Smart Pantry";
  const options = {
    body: data.body || "มีรายการวัตถุดิบที่ควรตรวจสอบ",
    tag: data.tag || "smart-pantry-expiry",
    icon: "./icon-192-v2.png",
    badge: "./icon-192-v2.png",
    data: { url: data.url || "./" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "./", self.location.origin).href;
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.focus();
        if ("navigate" in client && client.url !== target) await client.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
