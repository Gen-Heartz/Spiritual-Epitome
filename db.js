var GrimorioDB = (function () {
  'use strict';

  var DB_NOME = 'grimorio_mestre';
  var DB_VERSAO = 1;
  var db = null;

  /* ========================================
     STORES (tabelas)
     ======================================== */

  var STORES = {
    fichas: 'fichas',
    sistema: 'sistema',
    glossario: 'glossario',
    construcao: 'construcao',
    config: 'config'
  };

  /* ========================================
     ABRIR / CRIAR BANCO
     ======================================== */

  function abrir() {
    return new Promise(function (resolver, rejeitar) {
      if (db) {
        resolver(db);
        return;
      }

      var pedido = indexedDB.open(DB_NOME, DB_VERSAO);

      pedido.onerror = function () {
        rejeitar(pedido.error);
      };

      pedido.onsuccess = function () {
        db = pedido.result;
        console.log('[DB] Banco aberto com sucesso.');
        resolver(db);
      };

      pedido.onupgradeneeded = function (evento) {
        var banco = evento.target.result;

        if (!banco.objectStoreNames.contains(STORES.fichas)) {
          var storeFichas = banco.createObjectStore(STORES.fichas, {
            keyPath: 'id'
          });
          storeFichas.createIndex('nome', 'nome', { unique: false });
          storeFichas.createIndex('criadoEm', 'criadoEm', { unique: false });
        }

        if (!banco.objectStoreNames.contains(STORES.sistema)) {
          banco.createObjectStore(STORES.sistema, { keyPath: 'id' });
        }

        if (!banco.objectStoreNames.contains(STORES.glossario)) {
          var storeGlossario = banco.createObjectStore(STORES.glossario, {
            keyPath: 'id'
          });
          storeGlossario.createIndex('termo', 'termo', { unique: false });
        }

        if (!banco.objectStoreNames.contains(STORES.construcao)) {
          banco.createObjectStore(STORES.construcao, { keyPath: 'id' });
        }

        if (!banco.objectStoreNames.contains(STORES.config)) {
          banco.createObjectStore(STORES.config, { keyPath: 'chave' });
        }

        console.log('[DB] Stores criados na versao ' + DB_VERSAO);
      };
    });
  }

  /* ========================================
     GERAR ID UNICO
     ======================================== */

  function gerarId() {
    var agora = Date.now().toString(36);
    var aleatorio = Math.random().toString(36).substring(2, 8);
    return agora + '-' + aleatorio;
  }

  /* ========================================
     INSERIR / ATUALIZAR
     ======================================== */

  function salvar(nomeStore, dados) {
    return abrir().then(function (banco) {
      return new Promise(function (resolver, rejeitar) {
        if (!dados.id) {
          dados.id = gerarId();
        }

        var transacao = banco.transaction(nomeStore, 'readwrite');
        var store = transacao.objectStore(nomeStore);
        var pedido = store.put(dados);

        pedido.onsuccess = function () {
          console.log('[DB] Salvo em ' + nomeStore + ':', dados.id);
          resolver(dados);
        };

        pedido.onerror = function () {
          rejeitar(pedido.error);
        };
      });
    });
  }

  /* ========================================
     BUSCAR POR ID
     ======================================== */

  function buscar(nomeStore, id) {
    return abrir().then(function (banco) {
      return new Promise(function (resolver, rejeitar) {
        var transacao = banco.transaction(nomeStore, 'readonly');
        var store = transacao.objectStore(nomeStore);
        var pedido = store.get(id);

        pedido.onsuccess = function () {
          resolver(pedido.result || null);
        };

        pedido.onerror = function () {
          rejeitar(pedido.error);
        };
      });
    });
  }

  /* ========================================
     LISTAR TODOS
     ======================================== */

  function listarTodos(nomeStore) {
    return abrir().then(function (banco) {
      return new Promise(function (resolver, rejeitar) {
        var transacao = banco.transaction(nomeStore, 'readonly');
        var store = transacao.objectStore(nomeStore);
        var pedido = store.getAll();

        pedido.onsuccess = function () {
          resolver(pedido.result || []);
        };

        pedido.onerror = function () {
          rejeitar(pedido.error);
        };
      });
    });
  }

  /* ========================================
     REMOVER POR ID
     ======================================== */

  function remover(nomeStore, id) {
    return abrir().then(function (banco) {
      return new Promise(function (resolver, rejeitar) {
        var transacao = banco.transaction(nomeStore, 'readwrite');
        var store = transacao.objectStore(nomeStore);
        var pedido = store.delete(id);

        pedido.onsuccess = function () {
          console.log('[DB] Removido de ' + nomeStore + ':', id);
          resolver(true);
        };

        pedido.onerror = function () {
          rejeitar(pedido.error);
        };
      });
    });
  }

  /* ========================================
     LIMPAR STORE INTEIRO
     ======================================== */

  function limpar(nomeStore) {
    return abrir().then(function (banco) {
      return new Promise(function (resolver, rejeitar) {
        var transacao = banco.transaction(nomeStore, 'readwrite');
        var store = transacao.objectStore(nomeStore);
        var pedido = store.clear();

        pedido.onsuccess = function () {
          console.log('[DB] Store limpo:', nomeStore);
          resolver(true);
        };

        pedido.onerror = function () {
          rejeitar(pedido.error);
        };
      });
    });
  }

  /* ========================================
     CONTAR REGISTROS
     ======================================== */

  function contar(nomeStore) {
    return abrir().then(function (banco) {
      return new Promise(function (resolver, rejeitar) {
        var transacao = banco.transaction(nomeStore, 'readonly');
        var store = transacao.objectStore(nomeStore);
        var pedido = store.count();

        pedido.onsuccess = function () {
          resolver(pedido.result);
        };

        pedido.onerror = function () {
          rejeitar(pedido.error);
        };
      });
    });
  }

  /* ========================================
     EXPORTAR TUDO (todos os stores)
     ======================================== */

  function exportarTudo() {
    return abrir().then(function (banco) {
      var nomesStores = Object.keys(STORES);
      var promessas = nomesStores.map(function (chave) {
        return listarTodos(STORES[chave]).then(function (dados) {
          return { store: STORES[chave], dados: dados };
        });
      });

      return Promise.all(promessas).then(function (resultados) {
        var exportacao = {
          versao: DB_VERSAO,
          exportadoEm: new Date().toISOString(),
          aplicacao: 'grimorio_mestre',
          stores: {}
        };

        for (var i = 0; i < resultados.length; i++) {
          exportacao.stores[resultados[i].store] = resultados[i].dados;
        }

        return exportacao;
      });
    });
  }

  /* ========================================
     IMPORTAR TUDO
     ======================================== */

  function importarTudo(dadosExportados) {
    if (!dadosExportados || !dadosExportados.stores) {
      return Promise.reject(new Error('Formato de dados invalido.'));
    }

    if (dadosExportados.aplicacao !== 'grimorio_mestre') {
      return Promise.reject(new Error('Arquivo nao pertence ao Grimorio do Mestre.'));
    }

    return abrir().then(function (banco) {
      var nomesStores = Object.keys(dadosExportados.stores);
      var promessas = [];

      for (var i = 0; i < nomesStores.length; i++) {
        var nomeStore = nomesStores[i];

        if (!banco.objectStoreNames.contains(nomeStore)) {
          console.warn('[DB] Store ignorado (nao existe):', nomeStore);
          continue;
        }

        var registros = dadosExportados.stores[nomeStore];

        for (var j = 0; j < registros.length; j++) {
          promessas.push(salvar(nomeStore, registros[j]));
        }
      }

      return Promise.all(promessas).then(function () {
        console.log('[DB] Importacao concluida.');
        return true;
      });
    });
  }

  /* ========================================
     API PUBLICA
     ======================================== */

  return {
    STORES: STORES,
    abrir: abrir,
    gerarId: gerarId,
    salvar: salvar,
    buscar: buscar,
    listarTodos: listarTodos,
    remover: remover,
    limpar: limpar,
    contar: contar,
    exportarTudo: exportarTudo,
    importarTudo: importarTudo
  };

})();