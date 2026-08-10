// ATUALIZE A VERSÃO SEMPRE QUE FIZER GRANDES MUDANÇAS NO SISTEMA
const CACHE_NAME = 'cij-cache-v2';

const urlsToCache = [
    './',
    './index.html',
    './manifest.json'
];

// Instala o Service Worker e salva os arquivos principais
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
    // Força o Service Worker a assumir o controle imediatamente, sem esperar fechar a aba
    self.skipWaiting();
});

// Ativa o Service Worker e limpa os caches antigos (Apaga a versão v1 velha)
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Apagando cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Diz para o SW controlar todas as abas abertas imediatamente
    self.clients.claim();
});

// Intercepta as requisições (Estratégia: Internet Primeiro, fallback para Cache)
self.addEventListener('fetch', event => {
    // Ignora requisições que não são GET (como salvar dados no Firebase)
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Se a requisição deu certo, clona e atualiza o cofre (cache)
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                }
                return response;
            })
            .catch(() => {
                // Se falhou (sem internet), busca a última versão salva no cofre
                return caches.match(event.request);
            })
    );
});
