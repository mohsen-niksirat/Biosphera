/**
 * Biosphera - Service Worker
 *
 * Production builds fingerprint their JS/CSS into /assets, so a fixed
 * precache list of raw src files 404s and leaves the app unusable offline.
 * Instead: precache the shell, network-first for navigations, and runtime
 * cache every successful same-origin GET (hashed assets included).
 */

const CACHE_NAME = 'biosphera-v9';
const SHELL = ['./', './index.html', './favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const shell = await caches.match('./index.html');
    if (shell) return shell;
    throw new Error('offline and no cached shell');
  }
}

self.addEventListener('fetch', (e) => {
  const request = e.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    e.respondWith(networkFirstNavigation(request));
    return;
  }

  e.respondWith(cacheFirst(request));
});
