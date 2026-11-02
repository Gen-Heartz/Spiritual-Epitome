var CACHE_NAME = 'grimorio-v1';

var ARQUIVOS = [
  './',
  './index.html',
  './styles.css',
  './menu.css',
  './menu.js',
  './db.js',
  './exportar.js',
  './manifest.json',
  './fichas/fichas.html',
  './fichas/fichas.css',
  './fichas/fichas.js',
  'https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cinzel:wght@400..900&family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=MedievalSharp&family=Philosopher:ital,wght@0,400;0,700;1,400&display=swap'
];

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ARQUIVOS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(
        nomes
          .filter(function (nome) { return nome !== CACHE_NAME; })
          .map(function (nome) { return caches.delete(nome); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (evento) {
  evento.respondWith(
    caches.match(evento.request).then(function (resposta) {
      if (resposta) {
        return resposta;
      }

      return fetch(evento.request).then(function (respostaRede) {
        if (
          respostaRede &&
          respostaRede.status === 200 &&
          respostaRede.type === 'basic'
        ) {
          var copia = respostaRede.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(evento.request, copia);
          });
        }
        return respostaRede;
      }).catch(function () {
        return new Response('Sem conexao e recurso nao encontrado no cache.', {
          status: 503,
          statusText: 'Offline'
        });
      });
    })
  );
});