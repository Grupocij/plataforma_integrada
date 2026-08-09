const CACHE_NAME = 'portal-cij-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './usuarios.html',
  './despesas.html',
  './veiculos_mobile.html',
  './simulador.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Retorna do cache se estiver sem internet
        }
        return fetch(event.request); // Busca da internet se tiver rede
      })
  );
});
