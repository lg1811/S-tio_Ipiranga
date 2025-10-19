const CACHE_NAME = 'sitio-ipiranga-v3.0';
const OFFLINE_URL = '/S-tio_Ipiranga/offline.html';

// Recursos essenciais para cache imediato
const CORE_ASSETS = [
  '/S-tio_Ipiranga/',
  '/S-tio_Ipiranga/index.html',
  '/S-tio_Ipiranga/manifest.json'
];

// Recursos dinâmicos que serão cacheados sob demanda
const RUNTIME_CACHE = 'sitio-ipiranga-runtime-v3.0';

// Instalação - cachear recursos essenciais
self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker v3.0...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache aberto, adicionando recursos essenciais');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Recursos essenciais cacheados com sucesso');
        return self.skipWaiting(); // Ativa imediatamente
      })
      .catch(err => {
        console.error('[SW] Erro ao cachear recursos:', err);
      })
  );
});

// Ativação - limpar caches antigos
self.addEventListener('activate', event => {
  console.log('[SW] Ativando Service Worker v3.0...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Remove caches antigos
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('[SW] Deletando cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker ativado e assumindo controle');
        return self.clients.claim(); // Assume controle de todas as páginas
      })
  );
});

// Fetch - estratégia Cache First com fallback para Network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requisições de outros domínios (APIs externas, CDNs)
  if (url.origin !== location.origin) {
    return;
  }

  // Ignora requisições do tipo POST, PUT, DELETE (apenas cache GET)
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        // Se encontrou no cache, retorna imediatamente
        if (cachedResponse) {
          console.log('[SW] Servindo do cache:', request.url);
          
          // Atualiza o cache em background (stale-while-revalidate)
          fetch(request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(RUNTIME_CACHE).then(cache => {
                  cache.put(request, networkResponse.clone());
                });
              }
            })
            .catch(() => {
              // Falha silenciosa - já temos o cache
            });
          
          return cachedResponse;
        }

        // Se não está no cache, busca da rede
        console.log('[SW] Buscando da rede:', request.url);
        return fetch(request)
          .then(networkResponse => {
            // Verifica se é uma resposta válida
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Clona a resposta (streams só podem ser lidos uma vez)
            const responseToCache = networkResponse.clone();

            // Adiciona ao cache runtime
            caches.open(RUNTIME_CACHE)
              .then(cache => {
                cache.put(request, responseToCache);
                console.log('[SW] Adicionado ao cache runtime:', request.url);
              });

            return networkResponse;
          })
          .catch(error => {
            console.error('[SW] Erro ao buscar da rede:', error);
            
            // Se é uma navegação HTML, retorna página offline
            if (request.destination === 'document') {
              return caches.match(OFFLINE_URL);
            }
            
            // Para outros recursos, retorna erro
            return new Response('Recurso não disponível offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Message - permite comunicação com a página
self.addEventListener('message', event => {
  console.log('[SW] Mensagem recebida:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        console.log('[SW] Todos os caches limpos');
        event.ports[0].postMessage({ success: true });
      })
    );
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then(cache => {
        return cache.addAll(urls);
      }).then(() => {
        console.log('[SW] URLs cacheadas:', urls);
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

// Sync - sincronização em background (quando voltar online)
self.addEventListener('sync', event => {
  console.log('[SW] Sync event:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(
      syncData()
    );
  }
});

// Função auxiliar para sincronizar dados
async function syncData() {
  try {
    // Aqui você pode adicionar lógica para sincronizar dados pendentes
    console.log('[SW] Sincronizando dados...');
    
    // Exemplo: enviar dados pendentes para o servidor
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

// Periodic Background Sync - atualização automática (experimental)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-plants') {
    event.waitUntil(updatePlantData());
  }
});

async function updatePlantData() {
  try {
    console.log('[SW] Atualizando dados das plantas...');
    
    const response = await fetch('/S-tio_Ipiranga/dados.geojson');
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put('/S-tio_Ipiranga/dados.geojson', response);
      console.log('[SW] Dados das plantas atualizados');
    }
  } catch (error) {
    console.error('[SW] Erro ao atualizar dados:', error);
  }
}

// Log de informações do Service Worker
console.log('[SW] Service Worker Sítio Ipiranga v3.0 carregado');
console.log('[SW] Cache Name:', CACHE_NAME);
console.log('[SW] Runtime Cache:', RUNTIME_CACHE);
