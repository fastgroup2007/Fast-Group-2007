const CACHE_NAME = 'fast-group-laptop-v6';
const APP_SHELL = ['./', 'index.html', 'app.css', 'compact.css', 'compact.js', 'mobile-config.js', 'catalog-workflows.js', 'reliability.js', 'manifest.webmanifest', 'fast-group-icon.svg', 'device-placeholder.svg'].map(path=>new URL(path,self.registration.scope).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin || !APP_SHELL.includes(url.href)) return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    if(response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || Response.error())));
});
