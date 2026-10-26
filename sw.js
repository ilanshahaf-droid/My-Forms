/* Service Worker – ממלא טפסים PWA (כולל עבודה בלי אינטרנט) */
const CACHE = "mmale-tfasim-v4";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png",
  "./favicon-16.png",
  "./logo.png",
  "./shortcut-in.png",
  "./shortcut-out.png"
];
// ספריות חיצוניות שהאפליקציה צריכה כדי לעלות גם בלי חיבור
const LIBS = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
];
// שרתים שמותר לשמור מהם עותק (ספריות וגופנים). Supabase ו-Google API לא נשמרים לעולם.
const CDN = /^(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com)$/;

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})));      // קובץ חסר לא מפיל את ההתקנה
    await Promise.all(LIBS.map((u) => c.add(new Request(u, { mode: "cors" })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (req, res) => { if (res && (res.ok || res.type === "opaque")) { const c = res.clone(); caches.open(CACHE).then((x) => x.put(req, c)); } return res; };
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // דף האפליקציה: קודם מהרשת (כדי לקבל גרסה חדשה מיד), ובלי חיבור – מהעותק השמור.
  // ignoreSearch: גם index.html?ck=in (קיצורי הדרך) נפתח בלי חיבור.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await Promise.race([fetch(req), timeout(4000)]);
        if (res && res.ok) {   // נשמר לפי שם הדף, בלי הפרמטרים (?ck=in)
          const key = /\/$/.test(url.pathname) ? "./index.html" : url.origin + url.pathname, c = res.clone();
          caches.open(CACHE).then((x) => x.put(key, c));
        }
        return res;
      } catch (_) {
        return (await caches.match(req, { ignoreSearch: true })) || (await caches.match("./index.html")) || (await caches.match("./")) || Response.error();
      }
    })());
    return;
  }

  // קבצים של האתר עצמו (אייקונים, לוגו): מהעותק השמור, ומתעדכנים ברקע.
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => put(req, res)).catch(() => cached);
      return cached || net;
    }));
    return;
  }

  // ספריות וגופנים מ-CDN: גרסאות קבועות, אז מהעותק השמור קודם.
  if (CDN.test(url.hostname)) {
    e.respondWith(caches.match(req).then((cached) => cached || fetch(req).then((res) => put(req, res))));
    return;
  }

  // כל השאר (Supabase, Google): רק מהרשת.
});
