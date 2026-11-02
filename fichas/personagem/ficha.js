document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ========================================
     ESTADO
     ======================================== */

  var estado = {
    vidaAtual: 10,
    vidaVendida: 0,
    manaVendida: 0,
    estaminaAtual: 3,
    racAtual: 5
  };

  var LINHAGEM_NOMES = {
    pungente: 'Pungente', erudita: 'Erudita', agraco: 'Agraco',
    desperta: 'Desperta', espectro: 'Espectro'
  };

  var PERICIAS_LIST = [
    'atletismo','vigor','tolerancia','canalizacao','integracao','ancoragem',
    'analise','foco','concentracao','prontidao','investigacao','sensibilidade',
    'sensacao','persuasao','empatia','agilidade','forca','manualidade'
  ];

  var SLOTS_MANA_IDS = ['int-1','int-2','int-3','int-4','ext-1','ext-2','ext-3','ext-4','ext-5','ext-6'];

  /* ========================================
     HELPERS
     ======================================== */

  function el(id){return document.getElementById(id);}
  function q(s){return document.querySelector(s);}
  function qa(s){return document.querySelectorAll(s);}
  function getNum(id){var e=el(id);return e?(parseFloat(e.value)||0):0;}
  function getPericia(nome){var i=q('[data-pericia="'+nome+'"]');return i?(parseFloat(i.value)||0):0;}
  function fmt(n){return Number.isInteger(n)?n:Math.round(n*100)/100;}
  function fmtCeil(n){return Math.ceil(n);}
  function fmtFloor(n){return Math.floor(n);}

  function on(target,evento,handler){
    if(!target){console.warn('[Ficha] Elemento nao encontrado para o evento:',evento);return;}
    target.addEventListener(evento,function(e){
      try{handler.call(this,e);}catch(err){console.error('[Ficha] Erro '+evento+':',err);}
    });
  }
  function setText(id,v){var e=el(id);if(e)e.textContent=v;}
  function setValue(id,v){var e=el(id);if(e)e.value=v;}

  /* ========================================
     TOOLTIPS
     ======================================== */

  var elTooltip = el('tooltipFlutuante');
  var elTooltipConteudo = el('tooltipConteudo');
  var tooltipTimer = null;

  function posicionarTooltip(t){
    if(!elTooltip)return;
    var r=t.getBoundingClientRect();
    elTooltip.style.left='0';elTooltip.style.top='0';
    elTooltip.classList.add('visivel');
    var tr=elTooltip.getBoundingClientRect();
    var top=r.top-tr.height-10, left=r.left+r.width/2-tr.width/2;
    if(left<8)left=8;
    if(left+tr.width>window.innerWidth-8)left=window.innerWidth-tr.width-8;
    elTooltip.classList.remove('tooltip--acima');
    if(top<8){top=r.bottom+10;elTooltip.classList.add('tooltip--acima');}
    elTooltip.style.left=left+'px';elTooltip.style.top=top+'px';
    var seta=elTooltip.querySelector('.tooltip-seta');
    if(seta){var sl=Math.max(12,Math.min(tr.width-12,r.left+r.width/2-left));seta.style.left=sl+'px';seta.style.marginLeft='0';}
  }
  function mostrarTooltip(t){
    if(!elTooltip||!elTooltipConteudo)return;
    var txt=t.getAttribute('data-tooltip');
    if(!txt)return;
    elTooltipConteudo.textContent=txt;
    posicionarTooltip(t);
    elTooltip.setAttribute('aria-hidden','false');
  }
  function esconderTooltip(){
    if(!elTooltip)return;
    elTooltip.classList.remove('visivel');
    elTooltip.setAttribute('aria-hidden','true');
  }

  document.addEventListener('mouseenter',function(e){
    var t=e.target.closest&&e.target.closest('.tooltip-trigger');
    if(!t)return;
    clearTimeout(tooltipTimer);
    tooltipTimer=setTimeout(function(){mostrarTooltip(t);},200);
  },true);
  document.addEventListener('mouseleave',function(e){
    if(e.target.closest&&e.target.closest('.tooltip-trigger')){clearTimeout(tooltipTimer);esconderTooltip();}
  },true);
  window.addEventListener('scroll',esconderTooltip,true);

  /* ========================================
     ABAS
     ======================================== */

  var elAbas=el('fichaAbas');
  var abasBtn=elAbas?elAbas.querySelectorAll('.ficha-aba'):[];
  var paineis=qa('.ficha-painel');

  function trocarAba(nome){
    for(var i=0;i<abasBtn.length;i++)abasBtn[i].classList.toggle('ativa',abasBtn[i].getAttribute('data-aba')===nome);
    for(var j=0;j<paineis.length;j++)paineis[j].classList.toggle('ativo',paineis[j].getAttribute('data-painel')===nome);
    esconderTooltip();
  }
  on(elAbas,'click',function(e){var b=e.target.closest('.ficha-aba');if(b)trocarAba(b.getAttribute('data-aba'));});

  /* ========================================
     CIRCULACAO
     ======================================== */

  function getCirc(){
    return{
      SE:el('quadSE')?el('quadSE').value:'',
      SD:el('quadSD')?el('quadSD').value:'',
      IE:el('quadIE')?el('quadIE').value:'',
      ID:el('quadID')?el('quadID').value:''
    };
  }
  function calcBonusCirc(){
    var Q=getCirc(),bV=0,bM=0,bE=0;
    if(Q.SE==='X')bE+=1;if(Q.SD==='X')bE+=1;if(Q.IE==='X')bE+=2;if(Q.ID==='X')bE+=2;
    var oS=(Q.SE==='O'&&Q.SD==='O'),oI=(Q.IE==='O'&&Q.ID==='O');
    if(Q.SE==='O')bM+=oS?2:1;if(Q.SD==='O')bM+=oS?2:1;if(Q.IE==='O')bM+=oI?2:1;if(Q.ID==='O')bM+=oI?2:1;
    var qE=(Q.SE==='Q'&&Q.IE==='Q'),qD=(Q.SD==='Q'&&Q.ID==='Q');
    if(Q.SE==='Q')bV+=qE?2:1;if(Q.IE==='Q')bV+=qE?2:1;if(Q.SD==='Q')bV+=qD?2:1;if(Q.ID==='Q')bV+=qD?2:1;
    return{vida:bV,mana:bM,estamina:bE};
  }
  function atualizarCirc(){
    var b=calcBonusCirc();
    setText('bonusVida',b.vida);setText('bonusMana',b.mana);setText('bonusEstamina',b.estamina);
    recalcVida();recalcMana();recalcEstamina();
  }
  ['quadSE','quadSD','quadIE','quadID'].forEach(function(id){on(el(id),'change',atualizarCirc);});

  /* ========================================
     VIDA
     ======================================== */

  function calcVidaTotal(){
    var v=getPericia('vigor'),b=calcBonusCirc().vida,t=10+b+(v*3);
    setText('vidaTotal',fmtCeil(t));
    return t;
  }
  function recalcVida(){
    var total=calcVidaTotal();
    var max=Math.max(0,total-estado.vidaVendida);
    if(estado.vidaAtual>max)estado.vidaAtual=max;
    if(estado.vidaAtual<0)estado.vidaAtual=0;
    setText('vidaAtualDisplay',fmtCeil(estado.vidaAtual));
    setText('vidaVendidaDisplay',fmtCeil(estado.vidaVendida));
  }
  on(el('vidaPerdida'),'keydown',function(e){
    if(e.key!=='Enter')return;e.preventDefault();
    var v=parseFloat(this.value)||0;this.value='';
    if(v===0)return;
    estado.vidaAtual-=v;recalcVida();
  });
  on(el('vidaVendida'),'keydown',function(e){
    if(e.key!=='Enter')return;e.preventDefault();
    var v=parseFloat(this.value)||0;this.value='';
    if(v===0)return;
    var t=calcVidaTotal();
    if(estado.vidaVendida+v>t-1)estado.vidaVendida=t-1;
    else estado.vidaVendida+=v;
    if(estado.vidaVendida<0)estado.vidaVendida=0;
    recalcVida();
  });
  function recuperarVida(v){estado.vidaAtual+=v;recalcVida();}
  on(el('descCustom'),'keydown',function(e){
    if(e.key!=='Enter')return;e.preventDefault();
    var v=parseFloat(this.value)||0;this.value='';
    if(v!==0)recuperarVida(v);
  });

  function atualizarTitlesDescanso(){
    var v=getPericia('vigor');
    var btnC=q('[data-descanso="curto"]');
    var btnM=q('[data-descanso="medio"]');
    var btnL=q('[data-descanso="longo"]');
    if(btnC)btnC.title='Recupera '+Math.ceil(v)+' de Vida (Vigor)';
    if(btnM)btnM.title='Recupera '+Math.ceil(v*2)+' de Vida (Vigor x 2)';
    if(btnL)btnL.title='Recupera '+Math.ceil(v*3)+' de Vida (Vigor x 3)';
    var custom=el('descCustom');
    if(custom)custom.title='Digite um valor customizado e pressione Enter para recuperar vida';
  }

  /* ========================================
     MANA
     ======================================== */

  function calcManaTotal(){
    var a=getPericia('ancoragem'),i=getPericia('integracao'),c=getPericia('canalizacao'),b=calcBonusCirc().mana;
    var t=5+b+(a*2)+(i*0.5)+(c*0.5);
    setText('manaTotal',fmtCeil(t));
    return t;
  }
  function getSomaSlotsMana(){
    var s=0;
    SLOTS_MANA_IDS.forEach(function(id){
      var i=q('[data-slot-custo="'+id+'"]');
      if(i&&!i.disabled)s+=parseFloat(i.value)||0;
    });
    return s;
  }
  function recalcMana(){
    var t=calcManaTotal(),a=Math.max(0,t-estado.manaVendida-getSomaSlotsMana());
    setText('manaAtualDisplay',fmtCeil(a));
    setText('manaVendidaDisplay',fmtCeil(estado.manaVendida));
  }
  on(el('manaVendida'),'keydown',function(e){
    if(e.key!=='Enter')return;e.preventDefault();
    var v=parseFloat(this.value)||0;this.value='';
    if(v===0)return;
    var t=calcManaTotal();
    if(estado.manaVendida+v>t-1)estado.manaVendida=t-1;
    else estado.manaVendida+=v;
    if(estado.manaVendida<0)estado.manaVendida=0;
    recalcMana();
  });

  function verificarSlots(){
    var i=getPericia('integracao'),c=getPericia('canalizacao');
    setSlotState('int-3',i>=3);setSlotState('int-4',i>=6);
    setSlotState('ext-4',i>=3);setSlotState('ext-5',c>=3);setSlotState('ext-6',c>=6);
  }
  function setSlotState(id,on_){
    var t=q('[data-slot="'+id+'"]'),n=q('[data-slot-custo="'+id+'"]');
    if(t)t.disabled=!on_;if(n)n.disabled=!on_;
  }

  /* ========================================
     MODAIS
     ======================================== */

  var modalInterno=el('modalInterno'),modalExterno=el('modalExterno');
  var btnInterno=el('btnInterno'),btnExterno=el('btnExterno');

  function fecharModais(){
    if(modalInterno)modalInterno.classList.remove('aberto');
    if(modalExterno)modalExterno.classList.remove('aberto');
  }
  on(btnInterno,'click',function(e){
    e.stopPropagation();
    var a=modalInterno&&modalInterno.classList.contains('aberto');
    fecharModais();
    if(!a&&modalInterno)modalInterno.classList.add('aberto');
  });
  on(btnExterno,'click',function(e){
    e.stopPropagation();
    var a=modalExterno&&modalExterno.classList.contains('aberto');
    fecharModais();
    if(!a&&modalExterno)modalExterno.classList.add('aberto');
  });
  on(modalInterno,'click',function(e){e.stopPropagation();});
  on(modalExterno,'click',function(e){e.stopPropagation();});

  /* ========================================
     GLOBAL CLICK
     ======================================== */

  document.addEventListener('click',function(e){
    try{
      var t=e.target.closest&&e.target.closest('.tooltip-trigger');
      if(t){e.preventDefault();e.stopPropagation();elTooltip&&elTooltip.classList.contains('visivel')?esconderTooltip():mostrarTooltip(t);return;}
      var b=e.target.closest&&e.target.closest('[data-descanso]');
      if(b){var tipo=b.getAttribute('data-descanso'),v=getPericia('vigor');recuperarVida(tipo==='curto'?v:tipo==='medio'?v*2:v*3);return;}
      var dm=e.target.closest&&e.target.closest('.modal-popup');
      var bm=e.target.closest&&(e.target.closest('#btnInterno')||e.target.closest('#btnExterno'));
      var nt=e.target.closest&&e.target.closest('.tooltip-flutuante');
      if(!dm&&!bm)fecharModais();
      if(!nt)esconderTooltip();
    }catch(err){console.error('[Ficha] Erro click:',err);}
  });

    document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();salvarFicha();return;}
    if(e.key==='Escape'){
      if(elTooltip&&elTooltip.classList.contains('visivel')){esconderTooltip();return;}
      // Dentro do iframe: nao navegar (o jogar.js cuida do Escape)
      if (window.self !== window.top) return;
      window.location.href='../fichas.html';
    }
  });
  /* ========================================
     GLOBAL INPUT
     ======================================== */

  document.addEventListener('input',function(e){
    try{if(e.target.matches&&e.target.matches('[data-slot-custo]'))recalcMana();}
    catch(err){console.error('[Ficha] Erro input:',err);}
  });

  /* ========================================
     ESTAMINA
     ======================================== */

  function calcEstaminaTotal(){
    var t=getPericia('tolerancia'),b=calcBonusCirc().estamina,tot=(t*2)+3+b;
    setText('estaminaTotal',fmtCeil(tot));
    return tot;
  }
  function recalcEstamina(){
    var t=calcEstaminaTotal();
    if(estado.estaminaAtual>t)estado.estaminaAtual=t;
    if(estado.estaminaAtual<0)estado.estaminaAtual=0;
    setText('estaminaAtualDisplay',fmtCeil(estado.estaminaAtual));
    atualizarLimiteGasto();
  }

  function calcLimiteGasto(){
    var a=getPericia('atletismo');
    var t=getPericia('tolerancia');
    var s=getPericia('sensibilidade');
    var lim=(a*0.5)+(t*1.0)+(s*0.2);
    return Math.ceil(Math.max(1,lim));
  }
  function atualizarLimiteGasto(){
    var lim=calcLimiteGasto();
    var input=el('estaminaGasto');
    if(input){
      input.placeholder='Max: '+lim+' (Enter)';
      input.title='Gasto maximo por acao: '+lim+' (Atletismo x 0.5 + Tolerancia x 1.0 + Sensibilidade x 0.2, minimo 1)';
      input.setAttribute('max',lim);
    }
  }
  function atualizarTitleRecuperarEstamina(){
    var a=getPericia('atletismo');
    var p=getPericia('prontidao');
    var rec=Math.ceil((a*0.5)+(p*0.5));
    var input=el('estaminaRecuperar');
    if(input){
      input.placeholder='Vazio = '+rec+' (Enter)';
      input.title='Recuperacao padrao (vazio): '+rec+' (Atletismo x 0.5 + Prontidao x 0.5). Ou digite valor customizado.';
    }
  }

  on(el('estaminaGasto'),'keydown',function(e){
    if(e.key!=='Enter')return;e.preventDefault();
    var v=parseFloat(this.value)||0;this.value='';
    if(v<=0)return;
    var lim=calcLimiteGasto();
    if(v>lim)return;
    estado.estaminaAtual-=v;
    recalcEstamina();
  });
  on(el('estaminaRecuperar'),'keydown',function(e){
    if(e.key!=='Enter')return;e.preventDefault();
    var v=parseFloat(this.value);this.value='';
    if(isNaN(v)||v===0){
      v=(getPericia('atletismo')*0.5)+(getPericia('prontidao')*0.5);
    }
    estado.estaminaAtual+=v;
    recalcEstamina();
  });

  /* ========================================
     RACIOCINIO
     ======================================== */

  function calcRacTotal(){
    var c=getPericia('concentracao'),a=getPericia('analise'),f=getPericia('foco');
    var t=5+(c*2.5)+(a*0.5)+(f*0.5);
    setText('racTotal',fmtCeil(t));
    return t;
  }
  function recalcRac(){
    var t=calcRacTotal();
    if(estado.racAtual>t)estado.racAtual=t;
    if(estado.racAtual<0)estado.racAtual=0;
    setText('racAtualDisplay',fmtCeil(estado.racAtual));
  }
  on(el('racGasto'),'keydown',function(e){
    if(e.key!=='Enter')return;e.preventDefault();
    var v=parseFloat(this.value)||0;this.value='';
    if(v<=0)return;
    estado.racAtual-=v;recalcRac();
  });
  on(el('racRecuperar'),'keydown',function(e){
    if(e.key!=='Enter')return;e.preventDefault();
    var v=parseFloat(this.value);this.value='';
    if(isNaN(v)||v===0)v=getPericia('concentracao')*2;
    estado.racAtual+=v;recalcRac();
  });

  /* ========================================
     PERICIAS
     ======================================== */

  function atualizarPericias(){
    var inputs=qa('.pericia-pontos');
    for(var i=0;i<inputs.length;i++){
      var inp=inputs[i],nome=inp.getAttribute('data-pericia');
      var pts=parseInt(inp.value,10)||0;
      var m=q('[data-mod="'+nome+'"]');
      if(m)m.textContent=(pts>=0?'+':'')+pts;
    }
    recalcVida();recalcMana();recalcEstamina();recalcRac();
    calcCombate();calcAlcance();verificarSlots();calcPericiasDisp();
    atualizarTitlesDescanso();
    atualizarLimiteGasto();
    atualizarTitleRecuperarEstamina();
  }
  on(el('periciaMatriz'),'input',function(e){
    if(e.target.classList&&e.target.classList.contains('pericia-pontos'))atualizarPericias();
  });

  /* ========================================
     NIVEL / PERICIAS DISP
     ======================================== */

  function calcPericiasTotal(){
    var n=getNum('nivel');
    var t=6+(n*3);
    setValue('periciasTotal',fmt(t));
    return t;
  }
  function calcPericiasDisp(){
    var t=calcPericiasTotal(),s=0;
    PERICIAS_LIST.forEach(function(nm){s+=getPericia(nm);});
    var disp=t-s;
    setValue('periciasAtual',fmt(disp));
    var elDisp=el('periciasAtual');
    if(elDisp){
      if(disp<0)elDisp.classList.add('negativo');
      else elDisp.classList.remove('negativo');
    }
  }
  on(el('nivel'),'input',calcPericiasDisp);

  /* ========================================
     COMBATE
     ======================================== */

  function calcCombate(){
    var i=getPericia('integracao'),f=getPericia('foco'),c=getPericia('canalizacao');
    var fr=getPericia('forca'),a=getPericia('atletismo'),t=getPericia('tolerancia');
    var p=getPericia('prontidao'),ag=getPericia('agilidade'),s=getPericia('sensibilidade');
    var an=getPericia('ancoragem'),co=getPericia('concentracao'),m=getPericia('manualidade');
    setValue('danoFisico',fmtFloor((fr*1.5)+(a*0.4)+(t*0.7)+(p*0.4)));
    setValue('danoMagico',fmtFloor((i*1.5)+(f*0.5)+(c*0.5)));
    setValue('deslocamento',fmtFloor(2+(a*1.5)));
    setValue('agilidadeCombate',fmtFloor(a+(p*1.5)+(f*0.5)+(ag*1.5)));
    setValue('velocidadeMagica',fmtFloor((c*1.5)+i+(f*0.5)+s));
    setValue('densidadeMagica',fmtFloor((an*1.5)+(i*0.5)+co));
    setValue('deslocamentoMagia',fmtFloor((c*2.5)+5));
    setValue('danoArmaTotal',fmtFloor(getNum('danoArma')+(m*3)));
  }
  on(el('danoArma'),'input',calcCombate);

  /* ========================================
     ALCANCE
     ======================================== */

  function calcAlcance(){
    var f=getPericia('foco'),s=getPericia('sensibilidade'),c=getPericia('canalizacao');
    var r=(f*2.5)+(s*1.7)+(c*2.8);setValue('raioCircular',fmt(r));
    var ar=Math.PI*r*r;setValue('areaCircular',fmt(ar));
    var ea=el('anguloDirecional'),ang=ea?parseFloat(ea.value):90;
    var alc=ang===0?ar/(getNum('larguraReta')||1):r*Math.sqrt(360/ang);
    setValue('alcanceDirecional',fmt(alc));
  }
  on(el('anguloDirecional'),'change',calcAlcance);
  on(el('larguraReta'),'input',calcAlcance);

  /* ========================================
     LINHAGEM
     ======================================== */

  var elLinhagemSelect=el('linhagemSelect'),elLinhagemBadge=el('linhagemBadge');
  function atualizarLinhagemBadge(){
    if(!elLinhagemSelect||!elLinhagemBadge)return;
    var v=elLinhagemSelect.value;
    elLinhagemBadge.className='linhagem-badge';
    if(!v){elLinhagemBadge.textContent='Nenhuma Linhagem';return;}
    elLinhagemBadge.textContent=LINHAGEM_NOMES[v]||v;
    elLinhagemBadge.classList.add('linhagem-badge--'+v);
  }
  on(elLinhagemSelect,'change',atualizarLinhagemBadge);

  /* ========================================
     PERSISTENCIA
     ======================================== */

  function coletarDados(){
    var d={};
    qa('[data-campo]').forEach(function(e){
      var ch=e.getAttribute('data-campo');
      if(e.tagName==='SELECT')d[ch]=e.value;
      else if(e.tagName==='TEXTAREA')d[ch]=e.value;
      else if(e.type==='number')d[ch]=parseFloat(e.value)||0;
      else d[ch]=e.value;
    });
    d._pericias={};qa('[data-pericia]').forEach(function(p){d._pericias[p.getAttribute('data-pericia')]=parseFloat(p.value)||0;});
    d._slots={};qa('[data-slot]').forEach(function(s){d._slots[s.getAttribute('data-slot')]=s.value;});
    d._slotCustos={};qa('[data-slot-custo]').forEach(function(s){d._slotCustos[s.getAttribute('data-slot-custo')]=parseFloat(s.value)||0;});
    d._estado={
      vidaAtual:estado.vidaAtual,vidaVendida:estado.vidaVendida,
      manaVendida:estado.manaVendida,estaminaAtual:estado.estaminaAtual,
      racAtual:estado.racAtual
    };
    d._ts=Date.now();
    return d;
  }

  function carregarDados(d){
    if(!d){
      console.warn('[Ficha] carregarDados chamado sem dados');
      return;
    }

    console.log('[Ficha] Carregando dados:', d);

    // 1. Preencher campos data-campo
    qa('[data-campo]').forEach(function(e){
      var ch=e.getAttribute('data-campo');
      if(d[ch]!==undefined&&d[ch]!==null)e.value=d[ch];
    });

    // 2. Preencher pericias
    if(d._pericias){
      qa('[data-pericia]').forEach(function(p){
        var k=p.getAttribute('data-pericia');
        if(d._pericias[k]!==undefined)p.value=d._pericias[k];
      });
    }

    // 3. Preencher slots (textos)
    if(d._slots){
      qa('[data-slot]').forEach(function(s){
        var k=s.getAttribute('data-slot');
        if(d._slots[k]!==undefined)s.value=d._slots[k];
      });
    }

    // 4. Preencher custos dos slots
    if(d._slotCustos){
      qa('[data-slot-custo]').forEach(function(s){
        var k=s.getAttribute('data-slot-custo');
        if(d._slotCustos[k]!==undefined)s.value=d._slotCustos[k];
      });
    }

    // 5. Restaurar estado dinamico ANTES de recalcular
    if(d._estado){
      estado.vidaAtual=d._estado.vidaAtual!==undefined?d._estado.vidaAtual:0;
      estado.vidaVendida=d._estado.vidaVendida!==undefined?d._estado.vidaVendida:0;
      estado.manaVendida=d._estado.manaVendida!==undefined?d._estado.manaVendida:0;
      estado.estaminaAtual=d._estado.estaminaAtual!==undefined?d._estado.estaminaAtual:0;
      estado.racAtual=d._estado.racAtual!==undefined?d._estado.racAtual:0;
    }

    // 6. Atualizar badge de linhagem
    atualizarLinhagemBadge();

    // 7. Atualizar modificadores das pericias (visual +N)
    qa('.pericia-pontos').forEach(function(inp){
      var nome=inp.getAttribute('data-pericia');
      var pts=parseInt(inp.value,10)||0;
      var m=q('[data-mod="'+nome+'"]');
      if(m)m.textContent=(pts>=0?'+':'')+pts;
    });

    // 8. Verificar slots desbloqueados
    verificarSlots();

    // 9. Calcular pericias disponiveis
    calcPericiasDisp();

    // 10. Recalcular tudo (usando estado ja restaurado)
    recalcVida();
    recalcMana();
    recalcEstamina();
    recalcRac();

    // 11. Calcular combate e alcance
    calcCombate();
    calcAlcance();

    // 12. Atualizar bonus de circulacao (display)
    var b=calcBonusCirc();
    setText('bonusVida',b.vida);
    setText('bonusMana',b.mana);
    setText('bonusEstamina',b.estamina);

    // 13. Titles e limites
    atualizarTitlesDescanso();
    atualizarLimiteGasto();
    atualizarTitleRecuperarEstamina();

    console.log('[Ficha] Dados carregados com sucesso. Estado:', estado);
  }

  /* ========================================
     SALVAR / CARREGAR
     ======================================== */

  var btnSalvar=el('btnSalvar'),btnVoltar=el('btnVoltarFichas'),fichaId=null;

  function obterIdURL(){return new URLSearchParams(window.location.search).get('id')||null;}

  function feedbackSalvar(){
    if(!btnSalvar) return;
    btnSalvar.textContent='Salvo!';
    btnSalvar.style.borderColor='#6bff8a';
    btnSalvar.style.color='#6bff8a';
    setTimeout(function(){
      btnSalvar.textContent='Salvar Ficha';
      btnSalvar.style.borderColor='';btnSalvar.style.color='';
    },1500);
  }

  function salvarFicha(){
    var d=coletarDados();
    if(fichaId)d.id=fichaId;

    if(typeof GrimorioDB!=='undefined'&&GrimorioDB.salvar){
      GrimorioDB.salvar(GrimorioDB.STORES.fichas,d).then(function(dadosSalvos){
        // CORRECAO: GrimorioDB.salvar retorna o objeto completo salvado
        fichaId=dadosSalvos.id;
        console.log('[Ficha] Salva no DB com ID:',fichaId);
        feedbackSalvar();
      }).catch(function(e){
        console.error('[Ficha] Erro salvar (DB), usando localStorage:',e);
        if(!fichaId)fichaId='ficha_'+Date.now();
        d.id=fichaId;
        localStorage.setItem(fichaId,JSON.stringify(d));
        feedbackSalvar();
      });
    }else{
      if(!fichaId)fichaId='ficha_'+Date.now();
      d.id=fichaId;
      localStorage.setItem(fichaId,JSON.stringify(d));
      feedbackSalvar();
    }
  }

  function carregarFicha(id){
    console.log('[Ficha] Tentando carregar ID:',id);

    return new Promise(function(resolve){
      // CORRECAO: Chamando GrimorioDB.buscar() em vez de buscarPorId()
      if(typeof GrimorioDB!=='undefined'&&GrimorioDB.buscar){
        GrimorioDB.buscar(GrimorioDB.STORES.fichas,id).then(function(dados){
          if(dados){
            fichaId=id;
            carregarDados(dados);
            resolve(true);
          }else{
            console.warn('[Ficha] Ficha nao encontrada no DB, tentando localStorage');
            var raw=localStorage.getItem(id);
            if(raw){
              fichaId=id;
              carregarDados(JSON.parse(raw));
              resolve(true);
            }else{
              console.warn('[Ficha] Ficha nao encontrada:',id);
              resolve(false);
            }
          }
        }).catch(function(e){
          console.error('[Ficha] Erro DB, tentando localStorage:',e);
          var raw=localStorage.getItem(id);
          if(raw){
            fichaId=id;
            carregarDados(JSON.parse(raw));
            resolve(true);
          }else{
            resolve(false);
          }
        });
      }else{
        var raw=localStorage.getItem(id);
        if(raw){
          fichaId=id;
          carregarDados(JSON.parse(raw));
          resolve(true);
        }else{
          resolve(false);
        }
      }
    });
  }

  on(btnSalvar,'click',salvarFicha);
  on(btnVoltar,'click',function(){
    // Se estiver dentro de um iframe (modo tela dividida), nao navegar
    if (window.self !== window.top) return;
    window.location.href='../fichas.html';
  });

  document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();salvarFicha();return;}
    if(e.key==='Escape'){
      if(elTooltip&&elTooltip.classList.contains('visivel')){esconderTooltip();return;}
      window.location.href='../fichas.html';
    }
  });

  /* ========================================
     INIT
     ======================================== */

  function setupPadrao(){
    atualizarLinhagemBadge();
    verificarSlots();
    calcPericiasDisp();
    atualizarCirc();
    calcCombate();
    calcAlcance();
    atualizarTitlesDescanso();
    atualizarLimiteGasto();
    atualizarTitleRecuperarEstamina();

    qa('.pericia-pontos').forEach(function(inp){
      var nome=inp.getAttribute('data-pericia');
      var pts=parseInt(inp.value,10)||0;
      var m=q('[data-mod="'+nome+'"]');
      if(m)m.textContent=(pts>=0?'+':'')+pts;
    });
  }

  function iniciarComoNovo(){
    estado.vidaAtual=calcVidaTotal();
    estado.estaminaAtual=calcEstaminaTotal();
    estado.racAtual=calcRacTotal();
    estado.vidaVendida=0;
    estado.manaVendida=0;
    recalcVida();recalcMana();recalcEstamina();recalcRac();
    console.log('[Ficha] Iniciada como ficha nova. Estado:',estado);
  }

  // Esconder botao Voltar quando estiver em modo tela dividida
  if (window.self !== window.top && btnVoltar) {
    btnVoltar.style.display = 'none';
  }

  try{
    var idURL=obterIdURL();
    console.log('[Ficha] ID na URL:',idURL);

    setupPadrao();

    if(idURL){
      if(typeof GrimorioDB!=='undefined'&&GrimorioDB.abrir){
        GrimorioDB.abrir().then(function(){
          console.log('[Ficha] DB aberto, carregando ficha:',idURL);
          return carregarFicha(idURL);
        }).then(function(sucesso){
          if(!sucesso){
            console.warn('[Ficha] Nao foi possivel carregar ficha, iniciando como nova');
            iniciarComoNovo();
          }
        }).catch(function(e){
          console.error('[Ficha] Erro DB:',e);
          carregarFicha(idURL).then(function(sucesso){
            if(!sucesso)iniciarComoNovo();
          });
        });
      }else{
        carregarFicha(idURL).then(function(sucesso){
          if(!sucesso)iniciarComoNovo();
        });
      }
    }else{
      if(typeof GrimorioDB!=='undefined'&&GrimorioDB.abrir){
        GrimorioDB.abrir().catch(function(e){console.error('[Ficha] DB:',e);});
      }
      iniciarComoNovo();
    }

    console.log('[Ficha] Init completo');
  }catch(err){
    console.error('[Ficha] Erro init:',err);
    iniciarComoNovo();
  }
});