const CACHE_NAME = 'money-plan-receivable-delete-v1';
const SHELL = [
  './',
  './index.html',
  './money-plan.css',
  './money-plan-v2.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/config.js',
  './js/supabase-client.js',
  './js/auth.js',
  './js/money-api.js',
  './js/money-calculations.js',
  './js/money-charts.js',
  './js/money-sheets.js',
  './js/money-app.js',
  './js/bank-opening-ui.js',
  './js/undo-payment-actions.js',
  './js/receivable-edit-actions.js',
  './js/screens/setup.js',
  './js/screens/overview.js',
  './js/screens/payments.js',
  './js/screens/debts.js',
  './js/screens/receivables.js',
  './js/screens/history.js',
  './js/screens/settings.js',
  './ot.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || caches.match('./index.html')))
  );
});
