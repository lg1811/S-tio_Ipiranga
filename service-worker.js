const CACHE_NAME = 'sitio-ipiranga-v5.0';
const RUNTIME_CACHE = 'sitio-ipiranga-runtime-v5.0';

// Recursos essenciais para cache
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instalação - cachear recursos essenciais
self.addEventListener('install', event => {
  console.log('[SW v5.0] Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando recursos essenciais');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Erro ao cachear:', err))
  );
});

// Ativação - limpar caches antigos
self.addEventListener('activate', event => {
  console.log('[SW v5.0] Ativando...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('[SW] Deletando cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch - estratégia Cache First com fallback
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Apenas cache requisições do mesmo domínio
  if (url.origin !== location.origin) {
    return;
  }

  // Apenas GET requests
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          console.log('[SW] Servindo do cache:', url.pathname);
          
          // Atualiza em background
          fetch(request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(RUNTIME_CACHE).then(cache => {
                  cache.put(request, networkResponse.clone());
                });
              }
            })
            .catch(() => {}); // Ignora erros de rede
          
          return cachedResponse;
        }

        // Buscar da rede e cachear
        console.log('[SW] Buscando da rede:', url.pathname);
        return fetch(request)
          .then(networkResponse => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(request, responseToCache);
            });

            return networkResponse;
          })
          .catch(error => {
            console.error('[SW] Erro de rede:', error);
            
            // Retornar resposta offline
            if (request.destination === 'document') {
              return new Response(
                '<html><body><h1>🌿 Sítio Ipiranga</h1><p>Você está offline. O app continuará funcionando com os dados locais.</p></body></html>',
                {
                  headers: { 'Content-Type': 'text/html' }
                }
              );
            }
            
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Sincronização em background
self.addEventListener('sync', event => {
  console.log('[SW] Sync event:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  try {
    console.log('[SW] Sincronizando dados...');
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        timestamp: new Date().toISOString()
      });
    });
    return Promise.resolve();
  } catch (error) {
    console.error('[SW] Erro ao sincronizar:', error);
    return Promise.reject(error);
  }
}

console.log('[SW] Service Worker v5.0 carregado');
