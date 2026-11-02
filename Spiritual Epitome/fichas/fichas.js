(function () {
  'use strict';

  /* ========================================
     ELEMENTOS
     ======================================== */

  var grid           = document.getElementById('fichasGrid');
  var botoes         = grid.querySelectorAll('.fichas-botao');
  var btnVoltar      = document.getElementById('btnVoltar');
  var listaArea      = document.getElementById('fichasListaArea');
  var listaContainer = document.getElementById('fichasLista');
  var listaVazia     = document.getElementById('fichasListaVazia');
  var listaTitulo    = document.getElementById('fichasListaTitulo');
  var selecaoBarra   = document.getElementById('fichasSelecaoBarra');
  var selecaoInfo    = document.getElementById('fichasSelecaoInfo');
  var btnIniciarJogo = document.getElementById('btnIniciarJogo');
  var modalOverlay   = document.getElementById('modalOverlay');
  var modalTexto     = document.getElementById('modalTexto');
  var modalCancelar  = document.getElementById('modalCancelar');
  var modalConfirmar = document.getElementById('modalConfirmar');

  var LINHAGEM_NOMES = {
    pungente: 'Pungente', erudita: 'Erudita', agraco: 'Agraco',
    desperta: 'Desperta', espectro: 'Espectro'
  };

  var MAX_SELECAO = 2;

  var fichaParaApagar  = null;
  var etapaConfirmacao = 0;
  var modoAtual        = '';
  var selecionadas     = []; // array de IDs na ordem de selecao

  /* ========================================
     BANCO
     ======================================== */

  var bancoOk = false;

  if (typeof GrimorioDB !== 'undefined') {
    GrimorioDB.abrir().then(function () {
      bancoOk = true;
      console.log('[Fichas] Banco pronto.');
    }).catch(function (erro) {
      console.error('[Fichas] Erro ao abrir banco:', erro);
    });
  }

  /* ========================================
     SELECAO DE BOTAO DO MENU
     ======================================== */

  function marcarSelecionado(botao) {
    for (var i = 0; i < botoes.length; i++) botoes[i].classList.remove('selecionado');
    botao.classList.add('selecionado');
  }

  /* ========================================
     LISTAR FICHAS
     ======================================== */

  function listarFichas(modo) {
    modoAtual = modo;
    selecionadas = [];
    listaArea.style.display = 'block';
    listaContainer.innerHTML = '';
    listaVazia.style.display = 'none';

    if (modo === 'jogar') {
      listaTitulo.textContent = 'Selecione 1 ou 2 Fichas para Jogar';
      selecaoBarra.style.display = 'flex';
      atualizarBarraSelecao();
    } else {
      listaTitulo.textContent = 'Selecione uma Ficha para Editar';
      selecaoBarra.style.display = 'none';
    }

    function renderizar(fichas) {
      if (!fichas || fichas.length === 0) {
        listaVazia.style.display = 'block';
        if (modo === 'jogar') selecaoBarra.style.display = 'none';
        return;
      }
      fichas.sort(function (a, b) { return (b._ts || 0) - (a._ts || 0); });
      fichas.forEach(function (ficha) {
        listaContainer.appendChild(criarCard(ficha, modo));
      });
    }

    if (bancoOk && typeof GrimorioDB !== 'undefined') {
      GrimorioDB.listarTodos(GrimorioDB.STORES.fichas)
        .then(renderizar)
        .catch(function (e) {
          console.error('[Fichas] Erro ao listar:', e);
          renderizar(listarLocalStorage());
        });
    } else {
      renderizar(listarLocalStorage());
    }
  }

  function listarLocalStorage() {
    var fichas = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf('ficha_') === 0) {
        try {
          var dados = JSON.parse(localStorage.getItem(key));
          if (dados) fichas.push(dados);
        } catch (e) { /* ignora */ }
      }
    }
    return fichas;
  }

  /* ========================================
     CRIAR CARD
     ======================================== */

  function criarCard(ficha, modo) {
    var card = document.createElement('div');
    card.className = 'ficha-card';
    card.setAttribute('data-ficha-id', ficha.id);

    // Indicador de ordem (1 ou 2) — somente modo jogar
    if (modo === 'jogar') {
      card.classList.add('ficha-card--selecionavel');
      var ordem = document.createElement('span');
      ordem.className = 'ficha-card-ordem';
      ordem.textContent = '';
      card.appendChild(ordem);
    }

    // Info
    var info = document.createElement('div');
    info.className = 'ficha-card-info';

    var nome = document.createElement('div');
    nome.className = 'ficha-card-nome';
    nome.textContent = ficha.nome || 'Sem Nome';

    var detalhe = document.createElement('div');
    detalhe.className = 'ficha-card-detalhe';
    var partes = [];
    if (ficha.nomeJogador) partes.push(ficha.nomeJogador);
    if (ficha.tribo) partes.push(ficha.tribo);
    if (ficha.nivel) partes.push('Nv. ' + ficha.nivel);
    detalhe.textContent = partes.join(' - ') || 'Sem detalhes';

    info.appendChild(nome);
    info.appendChild(detalhe);
    card.appendChild(info);

    // Badge linhagem
    if (ficha.linhagem && LINHAGEM_NOMES[ficha.linhagem]) {
      var badge = document.createElement('span');
      badge.className = 'ficha-card-linhagem ficha-card-linhagem--' + ficha.linhagem;
      badge.textContent = LINHAGEM_NOMES[ficha.linhagem];
      card.appendChild(badge);
    }

    // Botao apagar (somente editar)
    if (modo === 'editar') {
      var btnApagar = document.createElement('button');
      btnApagar.className = 'ficha-card-apagar';
      btnApagar.textContent = 'Apagar';
      btnApagar.type = 'button';
      btnApagar.addEventListener('click', function (e) {
        e.stopPropagation();
        iniciarExclusao(ficha);
      });
      card.appendChild(btnApagar);
    }

    // Click
    card.addEventListener('click', function () {
      if (modo === 'jogar') alternarSelecao(ficha.id, card);
      else abrirFicha(ficha.id);
    });

    return card;
  }

  /* ========================================
     SELECAO PARA JOGAR
     ======================================== */

  function alternarSelecao(id, card) {
    var idx = selecionadas.indexOf(id);

    if (idx !== -1) {
      // Desselecionar
      selecionadas.splice(idx, 1);
    } else {
      // Selecionar (respeitando o maximo)
      if (selecionadas.length >= MAX_SELECAO) return;
      selecionadas.push(id);
    }

    atualizarVisualSelecao();
    atualizarBarraSelecao();
  }

  function atualizarVisualSelecao() {
    var cards = listaContainer.querySelectorAll('.ficha-card');
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var cid = c.getAttribute('data-ficha-id');
      var pos = selecionadas.indexOf(cid);
      var ordem = c.querySelector('.ficha-card-ordem');

      if (pos !== -1) {
        c.classList.add('selecionado-jogo');
        if (ordem) ordem.textContent = (pos + 1);
      } else {
        c.classList.remove('selecionado-jogo');
        if (ordem) ordem.textContent = '';
      }
    }
  }

  function atualizarBarraSelecao() {
    var n = selecionadas.length;
    selecaoInfo.textContent = n + ' de ' + MAX_SELECAO + ' selecionada' + (n === 1 ? '' : 's');
    btnIniciarJogo.disabled = (n === 0);
    btnIniciarJogo.textContent = n === 2 ? 'Iniciar Jogo (Tela Dividida)' : 'Iniciar Jogo';
  }

  btnIniciarJogo.addEventListener('click', function () {
    if (selecionadas.length === 0) return;

    if (selecionadas.length === 1) {
      window.location.href = 'personagem/ficha.html?id=' + encodeURIComponent(selecionadas[0]);
    } else {
      var ids = selecionadas.map(encodeURIComponent).join(',');
      window.location.href = 'personagem/jogar.html?ids=' + ids;
    }
  });

  /* ========================================
     ABRIR FICHA (modo editar)
     ======================================== */

  function abrirFicha(id) {
    if (!id) return;
    window.location.href = 'personagem/ficha.html?id=' + encodeURIComponent(id);
  }

  /* ========================================
     EXCLUSAO COM DUPLA CONFIRMACAO
     ======================================== */

  function iniciarExclusao(ficha) {
    fichaParaApagar = ficha;
    etapaConfirmacao = 1;
    modalTexto.textContent = 'Deseja apagar a ficha "' + (ficha.nome || 'Sem Nome') + '"?';
    modalConfirmar.textContent = 'Sim, Apagar';
    modalConfirmar.style.background = '#884444';
    modalOverlay.style.display = 'flex';
  }

  function confirmarExclusao() {
    if (etapaConfirmacao === 1) {
      etapaConfirmacao = 2;
      modalTexto.textContent = 'ATENCAO: Esta acao e irreversivel! Confirma a exclusao permanente de "' + (fichaParaApagar.nome || 'Sem Nome') + '"?';
      modalConfirmar.textContent = 'CONFIRMAR EXCLUSAO';
      modalConfirmar.style.background = '#e04545';
      return;
    }

    if (etapaConfirmacao === 2 && fichaParaApagar) {
      var id = fichaParaApagar.id;
      if (bancoOk && typeof GrimorioDB !== 'undefined' && GrimorioDB.remover) {
        GrimorioDB.remover(GrimorioDB.STORES.fichas, id).then(function () {
          fecharModal();
          listarFichas('editar');
        }).catch(function (e) {
          console.error('[Fichas] Erro ao apagar:', e);
          localStorage.removeItem(id);
          fecharModal();
          listarFichas('editar');
        });
      } else {
        localStorage.removeItem(id);
        fecharModal();
        listarFichas('editar');
      }
    }
  }

  function fecharModal() {
    modalOverlay.style.display = 'none';
    fichaParaApagar = null;
    etapaConfirmacao = 0;
  }

  modalConfirmar.addEventListener('click', confirmarExclusao);
  modalCancelar.addEventListener('click', fecharModal);
  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) fecharModal();
  });

  /* ========================================
     ESCONDER LISTA
     ======================================== */

  function esconderLista() {
    listaArea.style.display = 'none';
    listaContainer.innerHTML = '';
    selecaoBarra.style.display = 'none';
    selecionadas = [];
    modoAtual = '';
  }

  /* ========================================
     ACOES
     ======================================== */

  function executarAcao(chave) {
    switch (chave) {
      case 'jogar':
        esconderLista();
        listarFichas('jogar');
        break;
      case 'criar':
        esconderLista();
        window.location.href = 'personagem/ficha.html';
        break;
      case 'editar':
        esconderLista();
        listarFichas('editar');
        break;
    }
  }

  /* ========================================
     EVENTOS
     ======================================== */

  grid.addEventListener('click', function (e) {
    var botao = e.target.closest('.fichas-botao');
    if (!botao) return;
    var chave = botao.getAttribute('data-acao');
    marcarSelecionado(botao);
    executarAcao(chave);
  });

  btnVoltar.addEventListener('click', function () {
    window.location.href = '../index.html';
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (modalOverlay.style.display === 'flex') { fecharModal(); return; }
      if (listaArea.style.display !== 'none') {
        esconderLista();
        for (var i = 0; i < botoes.length; i++) botoes[i].classList.remove('selecionado');
        return;
      }
      window.location.href = '../index.html';
      return;
    }

    // Enter inicia o jogo se houver selecao
    if (e.key === 'Enter' && modoAtual === 'jogar' && selecionadas.length > 0) {
      btnIniciarJogo.click();
      return;
    }

    var mapa = { '1': 0, '2': 1, '3': 2 };
    var indice = mapa[e.key];
    if (indice !== undefined && botoes[indice]) {
      marcarSelecionado(botoes[indice]);
      executarAcao(botoes[indice].getAttribute('data-acao'));
    }
  });

})();