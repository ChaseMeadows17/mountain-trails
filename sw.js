// Offline support: use the network when available (so updates show up right away), fall back to cache offline.
const CACHE = 'mtws-apothecary-v4';
const SHELL = [
  './', 'index.html', 'styles.css', 'config.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/logo.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Only the app's own files and the sign-in library. Account data always goes straight to Supabase.
  const url = new URL(e.request.url);
  if (url.origin !== location.origin && url.hostname !== 'cdn.jsdelivr.net') return;
  e.respondWith(caches.open(CACHE).then(cache =>
    fetch(e.request).then(res => {
      if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone());
      return res;
    }).catch(() => cache.match(e.request, { ignoreSearch: true }))
  ));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => {
    if (list[0]) return list[0].focus();
    return self.clients.openWindow('./');
  }));
});
