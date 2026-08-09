// Nome do cache. Sempre que atualizarmos o sistema no futuro, podemos mudar para v2, v3, etc.
const CACHE_NAME = 'cij-cache-v2'; // Mudei para v2 para forçar o celular a atualizar

// Lista de arquivos que o celular vai baixar e guardar quando tiver internet
const urlsToCache = [
    './',
    './index.html',
    './usuarios.html',
    './estoque.html'
];

// Evento de instalação: É chamado na primeira vez que o técnico acessa o site
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache aberto com sucesso. Salvando arquivos offline...');
                return cache.addAll(urlsToCache);
            })
    );
});

// Evento Fetch: Ocorre sempre que o celular tenta abrir uma tela do sistema
self.addEventListener('fetch', event => {
    // A Estratégia aqui é: "Network First" (Tenta a internet primeiro)
    event.respondWith(
        fetch(event.request).catch(() => {
            // Se o fetch falhar (porque o técnico está sem internet ou sem sinal),
            // nós pegamos a tela que deixamos guardada no "cache" do celular.
            return caches.match(event.request);
        })
    );
});

// Evento de Ativação: Limpa caches antigos se mudarmos a versão
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
