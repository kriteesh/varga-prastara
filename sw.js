// वर्ग प्रस्तर — Service Worker
//
// HOW UPDATES WORK:
//   Every time you deploy, bump CACHE_VERSION below by one number.
//   The browser detects sw.js has changed (it always checks sw.js byte-for-byte),
//   installs the new worker, wipes the old cache, and fetches everything fresh.
//
const CACHE_VERSION = 'v6'; // ← bump this on every deploy
const CACHE = `varga-prastar-${CACHE_VERSION}`;

// Files to pre-cache on install
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
];

// ── INSTALL: cache app shell immediately, activate without waiting ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting())   // activate new SW right away
  );
});

// ── ACTIVATE: delete ALL old caches, take control of all tabs ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // take over open tabs immediately
  );
});

// ── FETCH strategy ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET and cross-origin requests (e.g. Google Fonts CDN)
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // puzzleFile.json → Network-first (always try to get latest data)
  if (url.pathname.endsWith('puzzleFile.json')) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // App shell (index.html, manifest.json, sw.js itself) → Network-first
  // This ensures updated files are always served when online.
  if (
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('index.html') ||
    url.pathname.endsWith('manifest.json')
  ) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // Everything else (fonts cached by browser, etc.) → Cache-first
  e.respondWith(cacheFirst(e.request));
});

// Network-first: try network, update cache, fall back to cache if offline
async function networkFirst(request) {
  try {
    const resp = await fetch(request);
    if (resp && resp.status === 200) {
      const cache = await caches.open(CACHE);
      cache.put(request, resp.clone());
    }
    return resp;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

// Cache-first: serve from cache, fetch and cache if missing
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const resp = await fetch(request);
    if (resp && resp.status === 200) {
      const cache = await caches.open(CACHE);
      cache.put(request, resp.clone());
    }
    return resp;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}
