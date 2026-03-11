const CACHE_NAME = 'moe-raspisanie-v5';
const ASSETS = [
  'index.html',
  'login.html',
  'dashboard.html',
  'profile.html',
  'style.css',
  'script.js',
  'dashboard.js',
  'profile.js',
  'moe-raspisanie.png',
  'moe-raspisanie-bg.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  
  // Стратегия Network First для динамических данных
  if (req.url.includes('users.json') || req.url.includes('schedule.json') || req.url.includes('/api/')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          if (req.method === 'GET' && res.ok) cache.put(req, copy);
        });
        return res;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('index.html');
        return new Response('', { status: 503 });
      });
    })
  );
});
