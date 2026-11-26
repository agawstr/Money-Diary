/* Service worker Money Diary: jaringan dulu untuk file aplikasi (versi baru langsung terpakai), cache sebagai cadangan offline.
   Naikkan VERSION setiap kali file statis berubah supaya cache lama diganti. */
const VERSION = 'md-v17';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'assets/css/style.css', 'assets/js/app.js', 'assets/js/util.js', 'assets/js/plan.js', 'assets/js/sanitize.js', 'assets/js/paylater.js', 'assets/js/wallet.js', 'assets/js/import.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(CORE.map(u => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
