/* Smart Pantry service worker: displays server-sent Web Push notifications. */
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (_) { data = { title: "Smart Pantry", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Smart Pantry";
  const options = {
    body: data.body || "มีรายการวัตถุดิบที่ควรตรวจสอบ",
    tag: data.tag || "smart-pantry-expiry",
    icon: "./icon.svg",
    badge: "./icon.svg",
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
