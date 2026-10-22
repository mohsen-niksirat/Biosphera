/**
 * Biosphera - Service Worker for 100% Offline PWA Execution
 */

const CACHE_NAME = 'biosphera-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './src/style.css',
  './src/main.js',
  './src/audio/SoundEngine.js',
  './src/brain/NeuralNet.js',
  './src/engine/Achievements.js',
  './src/engine/SpatialHash.js',
  './src/engine/World.js',
  './src/entities/Food.js',
  './src/entities/Hazard.js',
  './src/entities/Organism.js',
  './src/genetics/DNA.js',
  './src/render/Camera.js',
  './src/render/Renderer.js',
  './src/ui/Controls.js',
  './src/ui/GeneLab.js',
  './src/ui/GodBrush.js',
  './src/engine/ArenaTrial.js',
  './src/ui/Inspector.js',
  './src/ui/PopulationChart.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request);
    })
  );
});
