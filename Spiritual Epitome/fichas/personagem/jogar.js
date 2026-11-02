(function () {
  'use strict';

  /* ========================================
     ELEMENTOS
     ======================================== */

  var frame1        = document.getElementById('frame1');
  var frame2        = document.getElementById('frame2');
  var nomeFicha1    = document.getElementById('nomeFicha1');
  var nomeFicha2    = document.getElementById('nomeFicha2');
  var painel        = document.getElementById('jogarPainel');
  var aviso         = document.getElementById('avisoOrientacao');
  var btnSair       = document.getElementById('btnSair');
  var btnVoltarAviso= document.getElementById('btnVoltarAviso');
  var btnRecarregar = document.getElementById('btnRecarregar');

  /* ========================================
     LER IDS DA URL
     ======================================== */

  function obterIds() {
    var raw = new URLSearchParams(window.location.search).get('ids') || '';
    return raw.split(',')
      .map(function (s) { return decodeURIComponent(s.trim()); })
      .filter(function (s) { return s.length > 0; });
  }

  var ids = obterIds();
  console.log('[Jogar] IDs recebidos:', ids);

  if (ids.length === 0) {
    window.location.href = '../fichas.html';
    return;
  }

  /* ========================================
     CARREGAR IFRAMES
     ======================================== */

  var soloMode = (ids.length === 1);

  if (soloMode) {
    painel.classList.add('solo');
    frame1.src = 'ficha.html?id=' + encodeURIComponent(ids[0]);
    nomeFicha2.style.display = 'none';
    document.querySelector('.jogar-barra-sep').style.display = 'none';
  } else {
    frame1.src = 'ficha.html?id=' + encodeURIComponent(ids[0]);
    frame2.src = 'ficha.html?id=' + encodeURIComponent(ids[1]);
  }

  /* ========================================
     BUSCAR NOMES DAS FICHAS
     ======================================== */

  function carregarNome(id, elemento) {
    if (typeof GrimorioDB === 'undefined' || !GrimorioDB.buscar) {
      elemento.textContent = 'Ficha';
      return;
    }
    GrimorioDB.buscar(GrimorioDB.STORES.fichas, id).then(function (d) {
      elemento.textContent = (d && d.nome) ? d.nome : 'Sem Nome';
    }).catch(function () {
      elemento.textContent = 'Ficha';
    });
  }

  if (typeof GrimorioDB !== 'undefined' && GrimorioDB.abrir) {
    GrimorioDB.abrir().then(function () {
      carregarNome(ids[0], nomeFicha1);
      if (!soloMode) carregarNome(ids[1], nomeFicha2);
    }).catch(function (e) {
      console.error('[Jogar] Erro DB:', e);
      nomeFicha1.textContent = 'Ficha 1';
      if (!soloMode) nomeFicha2.textContent = 'Ficha 2';
    });
  } else {
    nomeFicha1.textContent = 'Ficha 1';
    if (!soloMode) nomeFicha2.textContent = 'Ficha 2';
  }

  /* ========================================
     DETECCAO DE ORIENTACAO
     Aviso somente quando: 2 fichas + tela pequena + retrato
     ======================================== */

  function verificarOrientacao() {
    if (soloMode) {
      aviso.classList.remove('visivel');
      return;
    }

    var telaPequena = window.innerWidth < 1024;
    var emRetrato   = window.innerHeight > window.innerWidth;

    if (telaPequena && emRetrato) {
      aviso.classList.add('visivel');
    } else {
      aviso.classList.remove('visivel');
    }
  }

  verificarOrientacao();

  window.addEventListener('resize', verificarOrientacao);
  window.addEventListener('orientationchange', function () {
    // Pequeno delay: alguns navegadores atualizam as dimensoes com atraso
    setTimeout(verificarOrientacao, 250);
  });

  /* ========================================
     BOTOES
     ======================================== */

  function sair() { window.location.href = '../fichas.html'; }

  btnSair.addEventListener('click', sair);
  btnVoltarAviso.addEventListener('click', sair);

  btnRecarregar.addEventListener('click', function () {
    frame1.src = frame1.src;
    if (!soloMode) frame2.src = frame2.src;
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') sair();
  });

})();