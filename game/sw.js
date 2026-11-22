// ШТАБ service worker. Caches only the static shell of the game (same origin, GET).
// The API lives on another origin and is never touched here, so progress, names and photos are never cached.
const CACHE = 'shtab-shell-20261122m';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', '../assets/fonts.css', '../assets/stickers/accepted.webp'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil((async () => { for (const k of await caches.keys()) if (k.startsWith('shtab-') && k !== CACHE) await caches.delete(k); await self.clients.claim(); })()); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin || url.pathname.includes('/api/')) return; // API and other sites: straight to the network
  if (!url.pathname.startsWith('/smm-stand/')) return;
  if (req.mode === 'navigate') { // pages: network first, offline falls back to the cached shell
    e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put('./index.html', c)); } return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  if (!/\.(js|css|png|webp|svg|ttf|woff2?|json|webmanifest)$/.test(url.pathname)) return;
  // static files carry ?v=… in their URL, so cache-first is safe; fresh copies arrive with a new version
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok && r.type === 'basic') { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); } return r; })));
});
