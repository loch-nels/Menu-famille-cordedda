// ── Service Worker — Mes Menus ────────────────────────────────
// Stratégie :
//   - App shell (HTML, manifest, firebase-sync) : cache-first
//   - menus_data.js : network-first → mise à jour hebdo propagée
//   - Polices Google : cache-first après premier chargement
//
// ⚠️ 20260630-0829 est remplacé automatiquement par la date du jour
//    lors de chaque upload via _github_upload_test.html
//    → force tous les navigateurs à vider l'ancien cache

const CACHE_APP  = 'menus-app-20260630-0829';
const CACHE_DATA = 'menus-data-20260630-0829';

const APP_SHELL = [
  './menus_app.html',
  './manifest.json',
  './icon.svg',
  './firebase-sync.js',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap',
];

// ── Install : mise en cache du shell ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_APP)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate : nettoyage des anciens caches ───────────────────
self.addEventListener('activate', event => {
  const VALID = [CACHE_APP, CACHE_DATA];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !VALID.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch : stratégie selon la ressource ─────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // menus_data.js → network-first (les menus changent chaque semaine)
  if (url.includes('menus_data.js')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_DATA).then(c => c.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Polices et ressources Firebase CDN → cache-first
  if (url.startsWith('https://fonts.') || url.includes('firebasejs')) {
    event.respondWith(
      caches.match(event.request).then(r => r || fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_APP).then(c => c.put(event.request, clone));
          return response;
        })
      )
    );
    return;
  }

  // App shell → cache-first
  event.respondWith(
    caches.match(event.request)
      .then(r => r || fetch(event.request))
  );
});