/* sw.js — cache supaya Money Diary bisa dibuka offline.
   Naikkan VERSION setiap kali file di SHELL berubah agar cache lama dibuang.
   Strategi: halaman = jaringan dulu (timeout 3 dtk, lalu cache); aset statis = stale-while-revalidate
   (langsung dari cache, diperbarui di belakang layar) sehingga aplikasi terbuka instan dan tetap segar. */
const VERSION = 'md-v65';
const SHELL = [
  './',
  'index.html',
  'assets/css/style.css',
  'assets/js/app.js',
  'assets/js/import.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  // hanya file milik situs ini; data.json (data awal opsional) dan pustaka cdnjs selalu lewat jaringan
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('/data.json')) return;

  if (req.mode === 'navigate') {
    e.respondWith(new Promise(ok => {
      const fallback = () => caches.match('index.html').then(r => r || caches.match('./')).then(r => r || Response.error());
      const t = setTimeout(() => fallback().then(ok), 3000);
      fetch(req).then(res => {
        clearTimeout(t);
        const copy = res.clone(); caches.open(VERSION).then(c => c.put('index.html', copy));
        ok(res);
      }).catch(() => { clearTimeout(t); fallback().then(ok); });
    }));
    return;
  }

  e.respondWith(
    caches.open(VERSION).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }))
  );
});
