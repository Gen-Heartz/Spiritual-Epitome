(function () {
  'use strict';

  /* ========================================
     SERVICE WORKER
     ======================================== */

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(function (registro) {
      console.log('[SW] Registrado com sucesso.');
    }).catch(function (erro) {
      console.warn('[SW] Falha ao registrar:', erro);
    });
  }

  /* ========================================
     INICIALIZAR BANCO
     ======================================== */

  GrimorioDB.abrir().then(function () {
    console.log('[App] Banco pronto.');
  }).catch(function (erro) {
    console.error('[App] Erro ao abrir banco:', erro);
  });

  /* ========================================
     ELEMENTOS
     ======================================== */

  var grid = document.getElementById('menuGrid');
  var botoes = grid.querySelectorAll('.menu-botao');
  var notificacao = document.getElementById('menuNotificacao');
  var notificacaoTexto = document.getElementById('notificacaoTexto');
  var tempoNotificacao = null;

  /* ========================================
     NOTIFICACAO
     ======================================== */

  function mostrarNotificacao(texto) {
    if (tempoNotificacao) {
      clearTimeout(tempoNotificacao);
    }

    notificacaoTexto.textContent = texto;
    notificacao.classList.add('visivel');

    tempoNotificacao = setTimeout(function () {
      notificacao.classList.remove('visivel');
      tempoNotificacao = null;
    }, 2600);
  }

  /* ========================================
     SELECAO
     ======================================== */

  function marcarSelecionado(botao) {
    for (var i = 0; i < botoes.length; i++) {
      botoes[i].classList.remove('selecionado');
    }
    botao.classList.add('selecionado');
  }

  /* ========================================
     ACOES
     ======================================== */

  function executarAcao(chave) {
    switch (chave) {

      case 'glossario':
        console.log('[Menu] Glossario.');
        mostrarNotificacao('Abrindo o Glossario de Termos Arcanos...');
        break;

      case 'fichas':
        console.log('[Menu] Fichas.');
        window.location.href = './fichas/fichas.html';
        break;

      case 'sistema':
        console.log('[Menu] Sistema.');
        mostrarNotificacao('Carregando as Regras do Sistema...');
        break;

      case 'construcao':
        console.log('[Menu] Construcao.');
        mostrarNotificacao('Preparando a Forja de Mundos...');
        break;

      case 'salvar':
        console.log('[Menu] Salvar / Exportar.');
        mostrarNotificacao('Preparando pergaminho para exportacao...');
        GrimorioArquivo.exportar().then(function (nome) {
          mostrarNotificacao('Dados exportados: ' + nome);
        }).catch(function (erro) {
          mostrarNotificacao('Falha ao exportar: ' + erro.message);
        });
        break;

      case 'carregar':
        console.log('[Menu] Carregar / Importar.');
        GrimorioArquivo.carregar().then(function () {
          mostrarNotificacao('Registros importados com sucesso.');
        }).catch(function (erro) {
          mostrarNotificacao('Falha ao importar: ' + erro.message);
        });
        break;
    }
  }

  /* ========================================
     EVENTOS
     ======================================== */

  grid.addEventListener('click', function (e) {
    var botao = e.target.closest('.menu-botao');
    if (!botao) return;

    var chave = botao.getAttribute('data-menu');
    marcarSelecionado(botao);
    executarAcao(chave);
  });

  document.addEventListener('keydown', function (e) {
    var mapa = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5 };
    var indice = mapa[e.key];

    if (indice !== undefined && botoes[indice]) {
      marcarSelecionado(botoes[indice]);
      executarAcao(botoes[indice].getAttribute('data-menu'));
    }
  });

})();