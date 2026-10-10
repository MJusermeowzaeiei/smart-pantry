import { buildPushPayload } from "@block65/webcrypto-web-push";

const APP_ORIGIN_DEFAULT = "https://mjusermeowzaeiei.github.io";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function response(data, status = 200, origin = APP_ORIGIN_DEFAULT) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, "access-control-allow-origin": origin, "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type", "vary": "Origin" }
  });
}
function validId(id) { return typeof id === "string" && /^[a-f0-9-]{36}$/i.test(id); }
function todayBangkok() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = type => parts.find(p => p.type === type)?.value;
  return get("year") + "-" + get("month") + "-" + get("day");
}
function daysUntil(date, today) {
  const a = Date.parse(date + "T00:00:00Z");
  const b = Date.parse(today + "T00:00:00Z");
  return Number.isFinite(a) ? Math.round((a - b) / 86400000) : 999999;
}
function vapidConfig(env) {
  if (!env.VAPID_SUBJECT || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) throw new Error("Missing VAPID secrets");
  return { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
}
async function readUser(env, id) {
  return await env.PANTRY_KV.get("user:" + id, "json") || { userId: id, items: [], subscriptions: [], notified: {} };
}
async function writeUser(env, user) {
  await env.PANTRY_KV.put("user:" + user.userId, JSON.stringify(user));
}
function isValidSubscription(s) {
  return s && typeof s.endpoint === "string" && s.endpoint.startsWith("https://") &&
    s.keys && typeof s.keys.p256dh === "string" && typeof s.keys.auth === "string";
}
async function sendToUser(env, user, payload) {
  if (!user.subscriptions?.length) return 0;
  const vapid = vapidConfig(env);
  let sent = 0;
  const remaining = [];
  for (const subscription of user.subscriptions) {
    try {
      const request = await buildPushPayload({ data: JSON.stringify(payload), options: { ttl: 86400, urgency: "normal" } }, subscription, vapid);
      const result = await fetch(subscription.endpoint, request);
      if (!result.ok) {
        const error = new Error("Push service returned HTTP " + result.status);
        error.statusCode = result.status;
        throw error;
      }
      remaining.push(subscription);
      sent++;
    } catch (error) {
      const status = error?.statusCode;
      if (status !== 404 && status !== 410) remaining.push(subscription);
      console.error("Push send failed", status || "", String(error?.message || error));
    }
  }
  user.subscriptions = remaining;
  await writeUser(env, user);
  return sent;
}

export default {
  async fetch(request, env) {
    const configuredOrigin = env.APP_ORIGIN || APP_ORIGIN_DEFAULT;
    const requestOrigin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": configuredOrigin,
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
        "vary": "Origin"
      }});
    }
    if (requestOrigin && requestOrigin !== configuredOrigin) return response({ error: "Origin not allowed" }, 403, configuredOrigin);
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/health") return response({ ok: true, service: "Smart Pantry Web Push" }, 200, configuredOrigin);
    if (request.method !== "POST") return response({ error: "Not found" }, 404, configuredOrigin);
    let body;
    try { body = await request.json(); } catch { return response({ error: "Invalid JSON" }, 400, configuredOrigin); }
    const userId = body?.userId;
    if (!validId(userId)) return response({ error: "Invalid userId" }, 400, configuredOrigin);
    const user = await readUser(env, userId);

    if (url.pathname === "/api/sync") {
      if (!Array.isArray(body.items) || body.items.length > 500) return response({ error: "Invalid items" }, 400, configuredOrigin);
      user.items = body.items.filter(x => x && typeof x.id === "string" && typeof x.name === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.expiry)).map(x => ({
        id: x.id, name: x.name.slice(0, 100), expiry: x.expiry
      }));
      await writeUser(env, user);
      return response({ ok: true, count: user.items.length }, 200, configuredOrigin);
    }
    if (url.pathname === "/api/subscribe") {
      if (!isValidSubscription(body.subscription)) return response({ error: "Invalid push subscription" }, 400, configuredOrigin);
      user.subscriptions = (user.subscriptions || []).filter(s => s.endpoint !== body.subscription.endpoint);
      user.subscriptions.push(body.subscription);
      await writeUser(env, user);
      return response({ ok: true }, 200, configuredOrigin);
    }
    if (url.pathname === "/api/test") {
      if (!user.subscriptions?.length) return response({ error: "No subscription saved yet" }, 409, configuredOrigin);
      const sent = await sendToUser(env, user, { title: "🔔 Smart Pantry", body: "การแจ้งเตือน Web Push ทำงานแล้ว", url: "/", tag: "smart-pantry-test" });
      return response({ ok: sent > 0, sent }, 200, configuredOrigin);
    }
    return response({ error: "Not found" }, 404, configuredOrigin);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil((async () => {
      const today = todayBangkok();
      let cursor;
      do {
        const page = await env.PANTRY_KV.list({ prefix: "user:", cursor, limit: 100 });
        for (const key of page.keys) {
          const user = await env.PANTRY_KV.get(key.name, "json");
          if (!user || !user.subscriptions?.length || !Array.isArray(user.items)) continue;
          let changed = false;
          for (const item of user.items) {
            const days = daysUntil(item.expiry, today);
            if (days > 3) continue;
            const stamp = today + "|" + item.expiry;
            if (user.notified?.[item.id] === stamp) continue;
            const title = days < 0 ? "⚠️ วัตถุดิบหมดอายุแล้ว" : days === 0 ? "⏰ วัตถุดิบหมดอายุวันนี้" : "🥬 วัตถุดิบใกล้หมดอายุ";
            const body = days < 0 ? item.name + " หมดอายุมาแล้ว " + Math.abs(days) + " วัน" : days === 0 ? item.name + " หมดอายุวันนี้" : item.name + " จะหมดอายุใน " + days + " วัน";
            const sent = await sendToUser(env, user, { title, body, url: "/", tag: "smart-pantry-" + item.id });
            if (sent > 0) {
              user.notified = user.notified || {};
              user.notified[item.id] = stamp;
              changed = true;
            }
          }
          if (changed) await writeUser(env, user);
        }
        cursor = page.cursor;
      } while (cursor);
    })());
  }
};
