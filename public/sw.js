/* NAMMA KADAI service worker: caches the app shell + static assets so the app opens offline.
   It NEVER caches Supabase/API calls or money data; pending entries live in IndexedDB (see src/lib/offline). */
const VERSION = 'nk-v1';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(['/offline'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // Supabase is cross-origin: untouched
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.open(STATIC).then(async (c) => { const hit = await c.match(req); if (hit) return hit; const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try { const res = await fetch(req); if (res.ok && !res.redirected) { const c = await caches.open(PAGES); c.put(req, res.clone()); } return res; }
      catch { return (await caches.match(req)) || (await caches.match('/offline')) || Response.error(); }
    })());
  }
});
