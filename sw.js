/* 오프라인 보관 — 한 번 열어 본 안내는 인터넷이 없어도 열립니다.
   화면(HTML)은 인터넷이 되면 항상 최신으로, 안 되면 보관본으로 보여줍니다. */
const CACHE = "gc-guide-v1";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => {
  const d = e.data || {};
  if (d.type !== "precache" || !Array.isArray(d.urls)) return;
  const src = e.source;
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const urls = ["/", ...d.urls].filter(u => typeof u === "string" && u.charAt(0) === "/" && u.indexOf("//") !== 0);
    let ok = 0;
    for (const u of urls) {
      try {
        if (await cache.match(u)) { ok++; continue; }
        const r = await fetch(u, { cache: "reload" });
        if (r && r.ok) { await cache.put(u, r); ok++; }
      } catch (err) {}
    }
    if (src && src.postMessage) src.postMessage({ type: "cached", n: ok });
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && (url.pathname.indexOf("/api/") === 0 || url.pathname === "/sw.js")) return;

  /* 화면 이동: 인터넷이 되면 최신, 안 되면 보관본 */
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const r = await fetch(req);
        if (r && r.ok && sameOrigin) cache.put(url.pathname === "/preview" ? "/preview" : "/", r.clone());
        return r;
      } catch (err) {
        return (await cache.match(url.pathname === "/preview" ? "/preview" : "/")) || (await cache.match("/")) || Response.error();
      }
    })());
    return;
  }

  /* 사진·아이콘·글꼴: 보관본을 먼저 보여주고 뒤에서 새로 받아 둠 */
  if (sameOrigin || FONT_HOSTS.indexOf(url.hostname) !== -1) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === "opaque")) cache.put(req, r.clone()); return r; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
});
