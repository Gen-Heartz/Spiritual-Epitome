import {
  AnguloMagicoStr,
  ArmaTipoKey,
  BonusCirculacao,
  CalculatedEpitomeStats,
  CircSimbolo,
  EpitomeFicha,
  EpitomeTacticalSummary,
  LinhagemKey,
  PericiaKey,
  SlotKey,
} from './epitomeTypes';
import { isLinhagemDefinida } from './linhagemCatalogo';
import { normalizarArvoreLinhagem } from './linhagemEngine';
import {
  AreaCell,
  ArsenalCatalog,
  Attack,
  Character,
  Direction,
  Weapon,
} from '../types';

export const ARMA_TIPO_LABELS: Record<Exclude<ArmaTipoKey, ''>, string> = {
  Curta: 'Curta',
  Media: 'Média',
  Longa: 'Longa',
  Magica: 'Mágica',
};

/**
 * Infere ou retorna o Porte Spiritual-Epitome de uma Arma do Arsenal.
 */
export function inferEpitomeTipoFromWeapon(
  wp: Weapon
): Exclude<ArmaTipoKey, ''> {
  if (
    wp.epitomeTipo === 'Curta' ||
    wp.epitomeTipo === 'Media' ||
    wp.epitomeTipo === 'Longa' ||
    wp.epitomeTipo === 'Magica'
  ) {
    return wp.epitomeTipo;
  }
  const cat = (wp.category || '').toLowerCase();
  if (
    cat.includes('cajado') ||
    cat.includes('mágic') ||
    cat.includes('magic') ||
    cat.includes('grimório') ||
    cat.includes('orbe')
  ) {
    return 'Magica';
  }
  if (
    wp.range >= 4 ||
    cat.includes('arco') ||
    cat.includes('besta') ||
    cat.includes('longo')
  ) {
    return 'Longa';
  }
  if (
    wp.range >= 2 ||
    cat.includes('espada') ||
    cat.includes('machado') ||
    cat.includes('lança') ||
    cat.includes('martelo')
  ) {
    return 'Media';
  }
  return 'Curta';
}

/**
 * Equipa (ou desequipa, se `weapon === null`) uma arma do Arsenal na Ficha,
 * garantindo que ela esteja na Zona de Armas da Mochila e preenchendo automaticamente
 * os campos da aba Combate (`tipoArma`, `nomeArma`, `danoArma`).
 */
export function equiparArmaDoArsenalNaFicha(
  ficha: EpitomeFicha,
  weapon: Weapon | null
): EpitomeFicha {
  if (!weapon) {
    return {
      ...ficha,
      armaEquipadaId: null,
      tipoArma: '',
      nomeArma: '',
      danoArma: 0,
    };
  }
  const tipo = inferEpitomeTipoFromWeapon(weapon);
  const nextMochila = ficha.mochilaArmasIds.includes(weapon.id)
    ? ficha.mochilaArmasIds
    : [...ficha.mochilaArmasIds, weapon.id];
  return {
    ...ficha,
    mochilaArmasIds: nextMochila,
    armaEquipadaId: weapon.id,
    tipoArma: tipo,
    nomeArma: weapon.name,
    danoArma: Math.max(0, Math.round(weapon.baseDamage || 0)),
  };
}

export interface PericiaMeta {
  key: PericiaKey;
  label: string;
  tipo: 'Agilidade' | 'Força' | 'Resistência';
  tooltip: string;
}

export interface PericiaGrupoMeta {
  id: string;
  titulo: string;
  pericias: PericiaMeta[];
}

export const PERICIAS_GRUPOS: PericiaGrupoMeta[] = [
  {
    id: 'fisico',
    titulo: 'Físico',
    pericias: [
      {
        key: 'atletismo',
        label: 'Atletismo',
        tipo: 'Agilidade',
        tooltip:
          'Atletismo: Deslocamento (2m base), mobilidade. Influencia: Deslocamento, Agilidade de combate, Estamina.',
      },
      {
        key: 'vigor',
        label: 'Vigor',
        tipo: 'Força',
        tooltip:
          'Vigor: Vitalidade. Influencia: Vida Total (×3), Descanso (recupera Vigor por tipo).',
      },
      {
        key: 'tolerancia',
        label: 'Tolerância',
        tipo: 'Resistência',
        tooltip:
          'Tolerância: Resistência a dano. Influencia: Estamina Total (×2), Limite de gasto de Estamina, Dano Físico.',
      },
    ],
  },
  {
    id: 'mental',
    titulo: 'Mental',
    pericias: [
      {
        key: 'analise',
        label: 'Análise',
        tipo: 'Agilidade',
        tooltip:
          'Análise: Dedução e lógica. Influencia: Raciocínio Total (×0.5).',
      },
      {
        key: 'foco',
        label: 'Foco',
        tipo: 'Força',
        tooltip:
          'Foco: Precisão e atenção. Influencia: Raciocínio, Agilidade de combate, Vel. Mágica, Dano Mágico, Alcance.',
      },
      {
        key: 'concentracao',
        label: 'Concentração',
        tipo: 'Resistência',
        tooltip:
          'Concentração: Manutenção de efeitos. Influencia: Raciocínio Total (×2.5), Recuperar Rac (×2), Dens. Mágica.',
      },
    ],
  },
  {
    id: 'espiritual',
    titulo: 'Espiritual',
    pericias: [
      {
        key: 'canalizacao',
        label: 'Canalização',
        tipo: 'Agilidade',
        tooltip:
          'Canalização: Projeção de energia. Influencia: Mana, Vel. Mágica, Dano Mágico, Alcance, Desl. Magia. Desbloqueia slots externos 5–6.',
      },
      {
        key: 'integracao',
        label: 'Integração',
        tipo: 'Força',
        tooltip:
          'Integração: Conexão espiritual. Influencia: Mana, Dano Mágico (×1.5), Vel/Dens Mágica. Desbloqueia slots internos 3–4 e externo 4.',
      },
      {
        key: 'ancoragem',
        label: 'Ancoragem',
        tipo: 'Resistência',
        tooltip:
          'Ancoragem: Estabilidade espiritual. Influencia: Mana Total (×2), Dens. Mágica (×1.5).',
      },
    ],
  },
  {
    id: 'sentidos',
    titulo: 'Sentidos',
    pericias: [
      {
        key: 'prontidao',
        label: 'Prontidão',
        tipo: 'Agilidade',
        tooltip:
          'Prontidão: Iniciativa. Influencia: Dano Físico (×0.4), Agilidade de combate (×1.5), Recuperação de Estamina.',
      },
      {
        key: 'investigacao',
        label: 'Investigação',
        tipo: 'Força',
        tooltip: 'Investigação: Busca. Não influencia campos calculados.',
      },
      {
        key: 'sensibilidade',
        label: 'Sensibilidade',
        tipo: 'Resistência',
        tooltip:
          'Sensibilidade: Percepção sutil. Influencia: Vel. Mágica, Limite de gasto de Estamina, Alcance (×1.7).',
      },
    ],
  },
  {
    id: 'social',
    titulo: 'Social',
    pericias: [
      {
        key: 'sensacao',
        label: 'Sensação',
        tipo: 'Agilidade',
        tooltip: 'Sensação: Presença. Não influencia campos calculados.',
      },
      {
        key: 'persuasao',
        label: 'Persuasão',
        tipo: 'Força',
        tooltip: 'Persuasão: Convencimento. Não influencia campos calculados.',
      },
      {
        key: 'empatia',
        label: 'Empatia',
        tipo: 'Resistência',
        tooltip:
          'Empatia: Leitura emocional. Não influencia campos calculados.',
      },
    ],
  },
  {
    id: 'combate',
    titulo: 'Combate',
    pericias: [
      {
        key: 'agilidade',
        label: 'Agilidade',
        tipo: 'Agilidade',
        tooltip:
          'Agilidade combate: Esquiva. Influencia: Agilidade Combate (×1.5).',
      },
      {
        key: 'forca',
        label: 'Força',
        tipo: 'Força',
        tooltip:
          'Força combate: Dano corpo a corpo. Influencia: Dano Físico (×1.5).',
      },
      {
        key: 'manualidade',
        label: 'Manualidade',
        tipo: 'Resistência',
        tooltip:
          'Manualidade: Destreza com armas. Influencia: Dano Arma (×3).',
      },
    ],
  },
];

export const ALL_PERICIA_KEYS: PericiaKey[] = PERICIAS_GRUPOS.flatMap((g) =>
  g.pericias.map((p) => p.key)
);

export const SLOTS_INTERNOS: SlotKey[] = ['int-1', 'int-2', 'int-3', 'int-4'];
export const SLOTS_EXTERNOS: SlotKey[] = [
  'ext-1',
  'ext-2',
  'ext-3',
  'ext-4',
  'ext-5',
  'ext-6',
];
export const ALL_SLOT_KEYS: SlotKey[] = [...SLOTS_INTERNOS, ...SLOTS_EXTERNOS];

export const LINHAGEM_LABELS: Record<LinhagemKey, string> = {
  '': 'Nenhuma Linhagem',
  pungente: 'Linhagem Pungente',
  erudita: 'Linhagem Erudita',
  agraco: 'Linhagem Agraço',
  desperta: 'Linhagem Desperta',
  espectro: 'Linhagem Espectro',
};

export const ANGULOS_OPCOES: Array<{ value: AnguloMagicoStr; label: string }> = [
  { value: '180', label: '180 graus' },
  { value: '120', label: '120 graus' },
  { value: '90', label: '90 graus' },
  { value: '60', label: '60 graus' },
  { value: '45', label: '45 graus' },
  { value: '30', label: '30 graus' },
  { value: '15', label: '15 graus' },
  { value: '0', label: '0 graus (reta)' },
];

export function gerarFichaId(): string {
  const agora = Date.now().toString(36);
  const aleatorio = Math.random().toString(36).substring(2, 8);
  return `${agora}-${aleatorio}`;
}

export function criarPericiasZeradas(): Record<PericiaKey, number> {
  const rec = {} as Record<PericiaKey, number>;
  for (const k of ALL_PERICIA_KEYS) {
    rec[k] = 0;
  }
  return rec;
}

export function criarSlotsVazios(): {
  _slots: Record<SlotKey, string>;
  _slotCustos: Record<SlotKey, number>;
} {
  const _slots = {} as Record<SlotKey, string>;
  const _slotCustos = {} as Record<SlotKey, number>;
  for (const k of ALL_SLOT_KEYS) {
    _slots[k] = '';
    _slotCustos[k] = 0;
  }
  return { _slots, _slotCustos };
}

export function criarFichaEmBranco(): EpitomeFicha {
  const { _slots, _slotCustos } = criarSlotsVazios();
  return {
    id: gerarFichaId(),
    nomeJogador: '',
    nome: '',
    conceito: '',
    linhagem: '',
    tribo: '',
    nivel: 1,
    xp: 0,
    tipoArma: '',
    nomeArma: '',
    danoArma: 0,
    quadSE: '',
    quadSD: '',
    quadIE: '',
    quadID: '',
    anguloDirecional: '90',
    larguraReta: 1,
    bolsa: '',
    mochilaArmasIds: [],
    armaEquipadaId: null,
    avatarImageId: '',
    _pericias: criarPericiasZeradas(),
    _arvoreLinhagem: { aprendidas: [], habilidadeExterna: null, energiasPorPericia: {} },
    _slots,
    _slotCustos,
    _estado: {
      vidaAtual: 10,
      vidaVendida: 0,
      manaVendida: 0,
      estaminaAtual: 3,
      racAtual: 5,
    },
    _ts: Date.now(),
  };
}

/**
 * Normaliza qualquer objeto vindo de `saves/*.json` do `Spiritual-Epitome`
 * ou do IndexedDB, garantindo todos os campos válidos sem perda de dados.
 */
export function normalizarFicha(raw: any): EpitomeFicha {
  const base = criarFichaEmBranco();
  if (!raw || typeof raw !== 'object') return base;

  const pericias = criarPericiasZeradas();
  const srcPericias = raw._pericias || raw.pericias || {};
  for (const k of ALL_PERICIA_KEYS) {
    const val = Number(srcPericias[k]);
    pericias[k] = Number.isFinite(val) ? Math.max(0, Math.min(10, val)) : 0;
  }

  const { _slots, _slotCustos } = criarSlotsVazios();
  const srcSlots = raw._slots || raw.slots || {};
  const srcCustos = raw._slotCustos || raw.slotCustos || {};
  for (const k of ALL_SLOT_KEYS) {
    _slots[k] = typeof srcSlots[k] === 'string' ? srcSlots[k] : '';
    const c = Number(srcCustos[k]);
    _slotCustos[k] = Number.isFinite(c) ? Math.max(0, c) : 0;
  }

  const linhagem = isLinhagemDefinida(raw.linhagem) ? raw.linhagem : '';
  const nivelBruto = Number(raw.nivel === '' ? 1 : raw.nivel ?? 1);
  const nivel = Number.isFinite(nivelBruto) ? Math.max(0, Math.floor(nivelBruto)) : 1;

  const validArmas: ArmaTipoKey[] = ['', 'Curta', 'Media', 'Longa', 'Magica'];
  const tipoArma: ArmaTipoKey = validArmas.includes(raw.tipoArma)
    ? raw.tipoArma
    : '';

  const validCirc: CircSimbolo[] = ['', 'X', 'O', 'Q'];
  const normCirc = (v: any): CircSimbolo => (validCirc.includes(v) ? v : '');

  const validAngulos: AnguloMagicoStr[] = [
    '180',
    '120',
    '90',
    '60',
    '45',
    '30',
    '15',
    '0',
  ];
  const angStr = String(raw.anguloDirecional ?? '90') as AnguloMagicoStr;
  const anguloDirecional: AnguloMagicoStr = validAngulos.includes(angStr)
    ? angStr
    : '90';

  const rawMochilaIds = Array.isArray(raw.mochilaArmasIds)
    ? Array.from(
        new Set(
          raw.mochilaArmasIds
            .filter((x: unknown) => typeof x === 'string' && x.trim().length > 0)
            .map((x: string) => x.trim())
        )
      )
    : [];
  const rawEquipadaId =
    typeof raw.armaEquipadaId === 'string' && raw.armaEquipadaId.trim()
      ? raw.armaEquipadaId.trim()
      : null;
  const mochilaArmasIds =
    rawEquipadaId && !rawMochilaIds.includes(rawEquipadaId)
      ? [...rawMochilaIds, rawEquipadaId]
      : rawMochilaIds;

  const fichaTemp: EpitomeFicha = {
    id: raw.id !== undefined && raw.id !== null ? String(raw.id) : base.id,
    nomeJogador: String(raw.nomeJogador ?? ''),
    nome: String(raw.nome ?? ''),
    conceito: String(raw.conceito ?? ''),
    linhagem,
    tribo: String(raw.tribo ?? ''),
    nivel,
    xp: Math.max(0, Number(raw.xp) || 0),
    tipoArma,
    nomeArma: String(raw.nomeArma ?? ''),
    danoArma: Math.max(0, Number(raw.danoArma) || 0),
    quadSE: normCirc(raw.quadSE),
    quadSD: normCirc(raw.quadSD),
    quadIE: normCirc(raw.quadIE),
    quadID: normCirc(raw.quadID),
    anguloDirecional,
    larguraReta: Math.max(1, Number(raw.larguraReta) || 1),
    bolsa: String(raw.bolsa ?? ''),
    mochilaArmasIds,
    armaEquipadaId: rawEquipadaId,
    avatarImageId: raw.avatarImageId ? String(raw.avatarImageId) : '',
    _pericias: pericias,
    _arvoreLinhagem: normalizarArvoreLinhagem(raw._arvoreLinhagem, pericias, linhagem),
    _slots,
    _slotCustos,
    _estado: {
      vidaAtual: Number(raw._estado?.vidaAtual ?? 10),
      vidaVendida: Math.max(0, Number(raw._estado?.vidaVendida ?? 0)),
      manaVendida: Math.max(0, Number(raw._estado?.manaVendida ?? 0)),
      estaminaAtual: Number(raw._estado?.estaminaAtual ?? 3),
      racAtual: Number(raw._estado?.racAtual ?? 5),
    },
    _ts: Number(raw._ts) || Date.now(),
  };

  // Clampa recursos ao máximo efetivo calculado pelas fórmulas do sistema
  const stats = calcularFicha(fichaTemp);
  fichaTemp._estado.vidaVendida = Math.min(
    Math.max(0, stats.vidaTotal - 1),
    fichaTemp._estado.vidaVendida
  );
  fichaTemp._estado.vidaAtual = Math.max(
    0,
    Math.min(
      Math.max(0, stats.vidaTotal - fichaTemp._estado.vidaVendida),
      fichaTemp._estado.vidaAtual
    )
  );
  fichaTemp._estado.manaVendida = Math.min(
    Math.max(0, stats.manaTotal - 1),
    fichaTemp._estado.manaVendida
  );
  fichaTemp._estado.estaminaAtual = Math.max(
    0,
    Math.min(stats.estaminaTotal, fichaTemp._estado.estaminaAtual)
  );
  fichaTemp._estado.racAtual = Math.max(
    0,
    Math.min(stats.racTotal, fichaTemp._estado.racAtual)
  );

  return fichaTemp;
}

/**
 * Calcula o bônus da Circulação Mágica (2×2):
 * - X: Estamina (+1 superior, +2 inferior)
 * - O: Mana (+2 cada se formar par horizontal SE+SD ou IE+ID; caso contrário +1)
 * - Q: Vida (+2 cada se formar par vertical SE+IE ou SD+ID; caso contrário +1)
 */
export function calcularBonusCirculacao(
  quadSE: CircSimbolo,
  quadSD: CircSimbolo,
  quadIE: CircSimbolo,
  quadID: CircSimbolo
): BonusCirculacao {
  let vida = 0;
  let mana = 0;
  let estamina = 0;

  // Estamina (X)
  if (quadSE === 'X') estamina += 1;
  if (quadSD === 'X') estamina += 1;
  if (quadIE === 'X') estamina += 2;
  if (quadID === 'X') estamina += 2;

  // Mana (O — pares horizontais)
  if (quadSE === 'O' && quadSD === 'O') {
    mana += 4;
  } else {
    if (quadSE === 'O') mana += 1;
    if (quadSD === 'O') mana += 1;
  }

  if (quadIE === 'O' && quadID === 'O') {
    mana += 4;
  } else {
    if (quadIE === 'O') mana += 1;
    if (quadID === 'O') mana += 1;
  }

  // Vida (Q — pares verticais)
  if (quadSE === 'Q' && quadIE === 'Q') {
    vida += 4;
  } else {
    if (quadSE === 'Q') vida += 1;
    if (quadIE === 'Q') vida += 1;
  }

  if (quadSD === 'Q' && quadID === 'Q') {
    vida += 4;
  } else {
    if (quadSD === 'Q') vida += 1;
    if (quadID === 'Q') vida += 1;
  }

  return { vida, mana, estamina };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Executa todas as fórmulas oficiais do `Spiritual-Epitome` (`ficha.js`).
 */
export function calcularFicha(ficha: EpitomeFicha): CalculatedEpitomeStats {
  const p = ficha._pericias;
  const n = Math.max(0, Number(ficha.nivel) || 0);

  // Em ficha.js: calcPericiasDisp usa t = 6 + (n * 3)
  const periciasTotais = 6 + n * 3;
  let periciasGastas = 0;
  for (const k of ALL_PERICIA_KEYS) {
    periciasGastas += Number(p[k]) || 0;
  }
  const periciasRestantes = periciasTotais - periciasGastas;

  const bonusCirc = calcularBonusCirculacao(
    ficha.quadSE,
    ficha.quadSD,
    ficha.quadIE,
    ficha.quadID
  );

  // 1. Vida
  const rawVidaTotal = 10 + bonusCirc.vida + p.vigor * 3;
  const vidaTotal = Math.ceil(rawVidaTotal);
  const vidaVendida = Math.max(
    0,
    Math.min(vidaTotal - 1, Math.ceil(ficha._estado.vidaVendida || 0))
  );
  const vidaEfetivaMax = Math.max(0, vidaTotal - vidaVendida);
  const vidaAtual = Math.max(
    0,
    Math.min(vidaEfetivaMax, Math.ceil(ficha._estado.vidaAtual ?? vidaEfetivaMax))
  );
  const descansoCurto = Math.ceil(p.vigor);
  const descansoMedio = Math.ceil(p.vigor * 2);
  const descansoLongo = Math.ceil(p.vigor * 3);

  // 2. Mana & Slots
  const rawManaTotal =
    5 +
    bonusCirc.mana +
    p.ancoragem * 2 +
    p.integracao * 0.5 +
    p.canalizacao * 0.5;
  const manaTotal = Math.ceil(rawManaTotal);

  const slotsDesbloqueados: Record<SlotKey, boolean> = {
    'int-1': true,
    'int-2': true,
    'int-3': p.integracao >= 3,
    'int-4': p.integracao >= 6,
    'ext-1': true,
    'ext-2': true,
    'ext-3': true,
    'ext-4': p.integracao >= 3,
    'ext-5': p.canalizacao >= 3,
    'ext-6': p.canalizacao >= 6,
  };

  let manaCustoSlots = 0;
  for (const sk of ALL_SLOT_KEYS) {
    if (slotsDesbloqueados[sk]) {
      manaCustoSlots += Math.max(0, Number(ficha._slotCustos[sk]) || 0);
    }
  }

  const manaVendida = Math.max(
    0,
    Math.min(manaTotal - 1, Math.ceil(ficha._estado.manaVendida || 0))
  );
  const manaEfetivaMax = Math.max(0, manaTotal - manaVendida);
  const manaAtual = Math.ceil(
    Math.max(0, rawManaTotal - manaVendida - manaCustoSlots)
  );

  // 3. Estamina
  const rawEstaminaTotal = p.tolerancia * 2 + 3 + bonusCirc.estamina;
  const estaminaTotal = Math.ceil(rawEstaminaTotal);
  const estaminaAtual = Math.max(
    0,
    Math.min(estaminaTotal, Math.ceil(ficha._estado.estaminaAtual ?? estaminaTotal))
  );
  const estaminaMaxGasto = Math.ceil(
    Math.max(1, p.atletismo * 0.5 + p.tolerancia * 1.0 + p.sensibilidade * 0.2)
  );
  const estaminaRecuperarPadrao = Math.ceil(
    p.atletismo * 0.5 + p.prontidao * 0.5
  );

  // 4. Raciocínio
  const rawRacTotal = 5 + p.concentracao * 2.5 + p.analise * 0.5 + p.foco * 0.5;
  const racTotal = Math.ceil(rawRacTotal);
  const racAtual = Math.max(
    0,
    Math.min(racTotal, Math.ceil(ficha._estado.racAtual ?? racTotal))
  );
  const racRecuperarPadrao = Math.ceil(p.concentracao * 2);

  // 5. Combate (Math.floor como em ficha.js)
  const danoFisico = Math.floor(
    p.forca * 1.5 +
      p.atletismo * 0.4 +
      p.tolerancia * 0.7 +
      p.prontidao * 0.4
  );
  const danoMagico = Math.floor(
    p.integracao * 1.5 + p.foco * 0.5 + p.canalizacao * 0.5
  );
  const deslocamento = Math.floor(2 + p.atletismo * 1.5);
  const agilidadeCombate = Math.floor(
    p.atletismo + p.prontidao * 1.5 + p.foco * 0.5 + p.agilidade * 1.5
  );
  const velocidadeMagica = Math.floor(
    p.canalizacao * 1.5 + p.integracao + p.foco * 0.5 + p.sensibilidade
  );
  const densidadeMagica = Math.floor(
    p.ancoragem * 1.5 + p.integracao * 0.5 + p.concentracao
  );
  const deslocamentoMagia = Math.floor(p.canalizacao * 2.5 + 5);
  const danoArmaTotal = Math.floor(
    (Number(ficha.danoArma) || 0) + p.manualidade * 3
  );

  // 6. Alcance Mágico
  const r = p.foco * 2.5 + p.sensibilidade * 1.7 + p.canalizacao * 2.8;
  const area = Math.PI * r * r;
  const anguloNum = parseInt(ficha.anguloDirecional, 10);
  const safeAng = Number.isNaN(anguloNum) ? 90 : anguloNum;
  const larg = Math.max(1, Number(ficha.larguraReta) || 1);
  const alcDir =
    safeAng === 0 ? area / larg : r * Math.sqrt(360 / safeAng);

  return {
    periciasTotais,
    periciasGastas,
    periciasRestantes,
    bonusCirc,
    vidaTotal,
    vidaEfetivaMax,
    vidaAtual,
    descansoCurto,
    descansoMedio,
    descansoLongo,
    manaTotal,
    manaEfetivaMax,
    manaCustoSlots,
    manaAtual,
    slotsDesbloqueados,
    estaminaTotal,
    estaminaAtual,
    estaminaMaxGasto,
    estaminaRecuperarPadrao,
    racTotal,
    racAtual,
    racRecuperarPadrao,
    danoFisico,
    danoMagico,
    deslocamento,
    agilidadeCombate,
    velocidadeMagica,
    densidadeMagica,
    deslocamentoMagia,
    danoArmaTotal,
    raioCircular: round2(r),
    areaCircular: round2(area),
    anguloNum: safeAng,
    alcanceDirecional: round2(alcDir),
  };
}

export function extrairResumoTatico(ficha: EpitomeFicha): EpitomeTacticalSummary {
  const s = calcularFicha(ficha);
  const slotsAtivos: EpitomeTacticalSummary['slotsAtivos'] = [];
  for (const sk of ALL_SLOT_KEYS) {
    if (s.slotsDesbloqueados[sk] && ficha._slots[sk]?.trim()) {
      slotsAtivos.push({
        slot: sk,
        nome: ficha._slots[sk].trim(),
        custo: Number(ficha._slotCustos[sk]) || 0,
      });
    }
  }
  return {
    fichaId: ficha.id,
    nivel: ficha.nivel,
    linhagem: ficha.linhagem,
    tribo: ficha.tribo,
    agilidadeCombate: s.agilidadeCombate,
    danoFisico: s.danoFisico,
    danoMagico: s.danoMagico,
    danoArmaTotal: s.danoArmaTotal,
    manualidadeBonusArma: ficha._pericias.manualidade * 3,
    velocidadeMagica: s.velocidadeMagica,
    densidadeMagica: s.densidadeMagica,
    deslocamentoMagia: s.deslocamentoMagia,
    manaTotal: s.manaTotal,
    manaAtual: s.manaAtual,
    estaminaTotal: s.estaminaTotal,
    estaminaAtual: s.estaminaAtual,
    estaminaMaxGasto: s.estaminaMaxGasto,
    estaminaRecuperarPadrao: s.estaminaRecuperarPadrao,
    racTotal: s.racTotal,
    racAtual: s.racAtual,
    racRecuperarPadrao: s.racRecuperarPadrao,
    raioCircular: s.raioCircular,
    anguloDirecional: ficha.anguloDirecional,
    alcanceDirecional: s.alcanceDirecional,
    larguraReta: ficha.larguraReta,
    slotsAtivos,
  };
}

/**
 * Gera os quadrados (orientação padrão Norte: dy < 0) para a Projeção Mágica Direcional
 * respeitando o `anguloDirecional` (`180°` a `15°` ou `0°` reta com `larguraReta`).
 */
export function gerarAreaDirecionalMagica(
  anguloNum: number,
  alcanceGrid: number,
  larguraReta = 1
): AreaCell[] {
  const len = Math.max(2, Math.min(12, Math.round(alcanceGrid)));
  const cells: AreaCell[] = [];

  if (anguloNum === 0) {
    const w = Math.max(1, Math.min(5, Math.round(larguraReta)));
    const left = -Math.floor((w - 1) / 2);
    const right = Math.ceil((w - 1) / 2);
    for (let step = 1; step <= len; step++) {
      for (let dx = left; dx <= right; dx++) {
        const isCenterCore = dx === 0 && step <= Math.ceil(len * 0.55);
        const isEdge = Math.abs(dx) > 0 && step > Math.ceil(len * 0.65);
        cells.push({
          dx,
          dy: -step,
          zone: isCenterCore ? 'red' : isEdge ? 'yellow' : 'orange',
        });
      }
    }
    return cells;
  }

  const halfRad = ((anguloNum / 2) * Math.PI) / 180;
  for (let dy = -len; dy <= -1; dy++) {
    for (let dx = -len; dx <= len; dx++) {
      const dist = Math.hypot(dx, dy);
      if (dist > len + 0.25) continue;
      const theta = Math.atan2(Math.abs(dx), -dy);
      // Tolerância angular leve (+0.11 rad) para garantir feixes contínuos em cones de 15°/30°
      if (theta <= halfRad + 0.11 || (dx === 0 && -dy <= len)) {
        const ratioDist = dist / len;
        const ratioAng = halfRad > 0 ? theta / (halfRad + 0.11) : 0;
        let zone: AreaCell['zone'] = 'orange';
        if (ratioDist <= 0.5 && ratioAng <= 0.55) {
          zone = 'red';
        } else if (ratioDist > 0.82 || ratioAng > 0.82) {
          zone = 'yellow';
        }
        cells.push({ dx, dy, zone });
      }
    }
  }

  if (cells.length === 0) {
    cells.push({ dx: 0, dy: -1, zone: 'red' });
  }
  return cells;
}

/**
 * Gera área circular graduada (núcleo vermelho, anel laranja, borda amarela).
 */
export function gerarAreaCircularMagica(
  raioGrid: number,
  incluirCentro = true
): AreaCell[] {
  const r = Math.max(1, Math.min(6, Math.round(raioGrid)));
  const cells: AreaCell[] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (!incluirCentro && dx === 0 && dy === 0) continue;
      const d = Math.hypot(dx, dy);
      if (d <= r + 0.25) {
        let zone: AreaCell['zone'] = 'yellow';
        if (d <= Math.max(0.5, r * 0.38)) zone = 'red';
        else if (d <= r * 0.75) zone = 'orange';
        cells.push({ dx, dy, zone });
      }
    }
  }
  return cells;
}

export function sugerirEmblemaPorFicha(ficha: EpitomeFicha): string {
  if (ficha.avatarImageId) return ficha.avatarImageId;
  switch (ficha.linhagem) {
    case 'erudita':
    case 'desperta':
      return 'preset_mage';
    case 'pungente':
    case 'espectro':
      return ficha.tipoArma === 'Longa' ? 'preset_archer' : 'preset_rogue';
    case 'agraco':
      return 'preset_knight';
    default:
      if (ficha.tipoArma === 'Magica') return 'preset_mage';
      if (ficha.tipoArma === 'Longa') return 'preset_archer';
      return 'preset_knight';
  }
}

export interface ConversaoTabuleiroOpcoes {
  /** Metros/unidades de alcance mágico por quadrado do grid (padrão: 5) */
  metrosPorQuadrado?: number;
  width?: number;
  height?: number;
  existingCharacterId?: string;
  /** Catálogo do Arsenal do Glossário para resolver a Arma Equipada da Mochila */
  arsenalCatalog?: ArsenalCatalog;
}

export interface FichaTacticalBundle {
  character: Character;
  weapons: Weapon[];
  attacks: Attack[];
  summary: EpitomeTacticalSummary;
}

/**
 * Converte uma `EpitomeFicha` em um pacote tático completo (`Character` + `Weapon[]` + `Attack[]`)
 * adaptado às mecânicas do `Spiritual-Epitome`:
 * - Vida e Deslocamento calculados pelas tríades
 * - Arma equipada (`Curta`, `Media`, `Longa`, `Magica` ou `Combate Corporal`) com `Dano Físico + Dano Arma`
 * - Kit de `Canalização Arcana` gerado automaticamente a partir do `Raio Circular`, `Ângulo Direcional`,
 *   `Alcance Direcional`, `Deslocamento da Magia` e `Slots de Mana` ativos!
 */
export function converterFichaParaTabuleiro(
  ficha: EpitomeFicha,
  opcoes: ConversaoTabuleiroOpcoes = {}
): FichaTacticalBundle {
  const stats = calcularFicha(ficha);
  const summary = extrairResumoTatico(ficha);
  const escala = Math.max(1, opcoes.metrosPorQuadrado ?? 5);
  const safeSlug = ficha.id.replace(/[^a-zA-Z0-9_-]/g, '');
  const charId = opcoes.existingCharacterId || `char_ep_${safeSlug}`;

  const weapons: Weapon[] = [];
  const attacks: Attack[] = [];

  // 1. Arma Equipada da Mochila (Arsenal do Glossário) OU Arma Física/Corporal Gerada
  const equippedArsenalWeapon =
    ficha.armaEquipadaId && opcoes.arsenalCatalog
      ? opcoes.arsenalCatalog.weapons[ficha.armaEquipadaId]
      : undefined;

  if (equippedArsenalWeapon) {
    const validAttackList = equippedArsenalWeapon.attackIds
      .map((aid) => opcoes.arsenalCatalog?.attacks[aid])
      .filter((a): a is Attack => Boolean(a));

    if (validAttackList.length > 0) {
      attacks.push(...validAttackList);
      weapons.push({
        ...equippedArsenalWeapon,
        attackIds: validAttackList.map((a) => a.id),
      });
    } else {
      const fallbackAtk: Attack = {
        id: `atk_ep_fb_${equippedArsenalWeapon.id}`,
        name: `${equippedArsenalWeapon.name} — Golpe Direto`,
        description: `Golpe padrão da arma ${equippedArsenalWeapon.name}.`,
        range: Math.max(1, equippedArsenalWeapon.range || 1),
        damage: Math.max(1, equippedArsenalWeapon.baseDamage || 3),
        impactType: equippedArsenalWeapon.category || 'Impacto',
        effects: [],
        area: {
          origin: { x: 0, y: 0 },
          cells: [{ dx: 0, dy: -1, zone: 'red' }],
        },
      };
      attacks.push(fallbackAtk);
      weapons.push({
        ...equippedArsenalWeapon,
        attackIds: [fallbackAtk.id],
      });
    }
  } else {
    const wpFisicaId = `wp_ep_arm_${safeSlug}`;
    const tipo = ficha.tipoArma || 'Curta';
    const nomeArma =
      ficha.nomeArma.trim() ||
      (ficha.tipoArma ? `Arma (${ficha.tipoArma})` : 'Combate Corporal');
    const danoGolpeBase = Math.max(1, stats.danoFisico + stats.danoArmaTotal);

    if (tipo === 'Longa') {
      const atkPreciso: Attack = {
        id: `atk_ep_lng1_${safeSlug}`,
        name: `${nomeArma} — Disparo Focado`,
        description: `Ataque à distância (Dano Arma ${stats.danoArmaTotal} + Físico ${stats.danoFisico}).`,
        range: 7,
        damage: danoGolpeBase,
        impactType: 'Longo Alcance',
        effects: [],
        area: {
          origin: { x: 0, y: -5 },
          cells: [
            { dx: 0, dy: 0, zone: 'red' },
            { dx: -1, dy: 0, zone: 'yellow' },
            { dx: 1, dy: 0, zone: 'yellow' },
          ],
        },
      };
      const atkLinha: Attack = {
        id: `atk_ep_lng2_${safeSlug}`,
        name: `${nomeArma} — Tiro Perfurante`,
        description: 'Disparo linear que atravessa alvos alinhados.',
        range: 5,
        damage: Math.max(1, Math.round(danoGolpeBase * 0.9)),
        impactType: 'Perfurante',
        effects: [],
        area: {
          origin: { x: 0, y: 0 },
          cells: [
            { dx: 0, dy: -1, zone: 'red' },
            { dx: 0, dy: -2, zone: 'red' },
            { dx: 0, dy: -3, zone: 'orange' },
            { dx: 0, dy: -4, zone: 'orange' },
            { dx: 0, dy: -5, zone: 'yellow' },
          ],
        },
      };
      attacks.push(atkPreciso, atkLinha);
      weapons.push({
        id: wpFisicaId,
        name: nomeArma,
        iconId: 'wicon_bow',
        category: 'Arma Longa (Epitome)',
        range: 7,
        baseDamage: stats.danoArmaTotal,
        attackIds: [atkPreciso.id, atkLinha.id],
      });
    } else if (tipo === 'Media') {
      const atkEstocada: Attack = {
        id: `atk_ep_med1_${safeSlug}`,
        name: `${nomeArma} — Golpe de Alcance`,
        description: `Golpe de média distância (${danoGolpeBase} dano total).`,
        range: 2,
        damage: danoGolpeBase,
        impactType: 'Alcance Médio',
        effects: [],
        area: {
          origin: { x: 0, y: 0 },
          cells: [
            { dx: 0, dy: -1, zone: 'red' },
            { dx: 0, dy: -2, zone: 'orange' },
          ],
        },
      };
      const atkArco: Attack = {
        id: `atk_ep_med2_${safeSlug}`,
        name: `${nomeArma} — Varredura Tática`,
        description: `Arco amplo com impulso de Estamina (máx ${stats.estaminaMaxGasto}/ação).`,
        range: 2,
        damage: Math.max(2, danoGolpeBase + stats.estaminaMaxGasto),
        impactType: 'Cortante / Impulso',
        effects: [],
        area: {
          origin: { x: 0, y: 0 },
          cells: [
            { dx: 0, dy: -1, zone: 'red' },
            { dx: -1, dy: -1, zone: 'orange' },
            { dx: 1, dy: -1, zone: 'orange' },
            { dx: 0, dy: -2, zone: 'yellow' },
          ],
        },
      };
      attacks.push(atkEstocada, atkArco);
      weapons.push({
        id: wpFisicaId,
        name: nomeArma,
        iconId: 'wicon_sword',
        category: 'Arma Média (Epitome)',
        range: 2,
        baseDamage: stats.danoArmaTotal,
        attackIds: [atkEstocada.id, atkArco.id],
      });
    } else if (tipo === 'Magica') {
      const rangeMag = Math.max(
        3,
        Math.min(10, Math.round(stats.deslocamentoMagia / 2))
      );
      const danoHibrido = Math.max(1, stats.danoMagico + stats.danoArmaTotal);
      const atkOrbe: Attack = {
        id: `atk_ep_wmg1_${safeSlug}`,
        name: `${nomeArma} — Disparo Canalizado`,
        description: `Canaliza Dano Mágico (${stats.danoMagico}) + Arma (${stats.danoArmaTotal}).`,
        range: rangeMag,
        damage: danoHibrido,
        impactType: 'Arcano',
        effects: [],
        area: {
          origin: { x: 0, y: -Math.min(4, rangeMag) },
          cells: [
            { dx: 0, dy: 0, zone: 'red' },
            { dx: 0, dy: -1, zone: 'orange' },
            { dx: 1, dy: 0, zone: 'orange' },
            { dx: 0, dy: 1, zone: 'orange' },
            { dx: -1, dy: 0, zone: 'orange' },
          ],
        },
      };
      attacks.push(atkOrbe);
      weapons.push({
        id: wpFisicaId,
        name: nomeArma,
        iconId: 'wicon_staff',
        category: 'Arma Mágica (Epitome)',
        range: rangeMag,
        baseDamage: stats.danoArmaTotal,
        attackIds: [atkOrbe.id],
      });
    } else {
      // Curta ou Combate Corporal
      const atkDireto: Attack = {
        id: `atk_ep_cur1_${safeSlug}`,
        name: `${nomeArma} — Golpe Direto`,
        description: `Impacto curto (Dano Físico ${stats.danoFisico} + Arma ${stats.danoArmaTotal}).`,
        range: 1,
        damage: danoGolpeBase,
        impactType: 'Corpo a Corpo',
        effects: [],
        area: {
          origin: { x: 0, y: 0 },
          cells: [
            { dx: 0, dy: -1, zone: 'red' },
            { dx: -1, dy: -1, zone: 'yellow' },
            { dx: 1, dy: -1, zone: 'yellow' },
          ],
        },
      };
      const atkImpulso: Attack = {
        id: `atk_ep_cur2_${safeSlug}`,
        name: `${nomeArma} — Investida de Estamina`,
        description: `Golpe reforçado com limite de gasto de Estamina (+${stats.estaminaMaxGasto}).`,
        range: 1,
        damage: danoGolpeBase + stats.estaminaMaxGasto,
        impactType: 'Impacto Pesado',
        effects: [],
        area: {
          origin: { x: 0, y: 0 },
          cells: [
            { dx: 0, dy: -1, zone: 'red' },
            { dx: -1, dy: -1, zone: 'orange' },
            { dx: 1, dy: -1, zone: 'orange' },
          ],
        },
      };
      attacks.push(atkDireto, atkImpulso);
      weapons.push({
        id: wpFisicaId,
        name: nomeArma,
        iconId: ficha.tipoArma ? 'wicon_sword' : 'wicon_claws',
        category: ficha.tipoArma ? 'Arma Curta (Epitome)' : 'Combate Corporal',
        range: 1,
        baseDamage: stats.danoArmaTotal,
        attackIds: [atkDireto.id, atkImpulso.id],
      });
    }
  }

  // 2. Kit de Canalização & Alcance Mágico (se possuir alcance mágico, dano mágico ou slots ativos)
  const temMagia =
    stats.raioCircular > 0 ||
    stats.danoMagico > 0 ||
    summary.slotsAtivos.length > 0;

  if (temMagia) {
    const wpMagiaId = `wp_ep_mag_${safeSlug}`;
    const magicAttackIds: string[] = [];
    const danoArcano = Math.max(
      2,
      stats.danoMagico + Math.floor(stats.densidadeMagica * 0.5)
    );
    const deslMagGrid = Math.max(
      2,
      Math.min(10, Math.round(stats.deslocamentoMagia / 2))
    );

    if (stats.alcanceDirecional > 0) {
      const alcDirGrid = Math.max(
        2,
        Math.min(10, Math.round(stats.alcanceDirecional / escala))
      );
      const rotuloAng =
        stats.anguloNum === 0
          ? `Reta (Larg. ${ficha.larguraReta})`
          : `Cone ${stats.anguloNum}°`;
      const atkDir: Attack = {
        id: `atk_ep_mdir_${safeSlug}`,
        name: `Projeção Direcional (${rotuloAng})`,
        description: `Alcance Direcional ${stats.alcanceDirecional}m (~${alcDirGrid} quad.) • Vel. Mágica ${stats.velocidadeMagica}.`,
        range: alcDirGrid,
        damage: danoArcano,
        impactType: `Magia Direcional (${rotuloAng})`,
        effects: [],
        area: {
          origin: { x: 0, y: 0 },
          cells: gerarAreaDirecionalMagica(
            stats.anguloNum,
            alcDirGrid,
            ficha.larguraReta
          ),
        },
      };
      attacks.push(atkDir);
      magicAttackIds.push(atkDir.id);
    }

    if (stats.raioCircular > 0) {
      const raioGrid = Math.max(
        1,
        Math.min(5, Math.round(stats.raioCircular / escala))
      );
      const atkCirc: Attack = {
        id: `atk_ep_mcir_${safeSlug}`,
        name: `Domínio Circular (Raio ${raioGrid}q)`,
        description: `Raio Circular ${stats.raioCircular}m • Desl. Magia ${stats.deslocamentoMagia} (~${deslMagGrid} quad.).`,
        range: deslMagGrid,
        damage: danoArcano,
        impactType: 'Área Circular',
        effects: [],
        area: {
          origin: { x: 0, y: -Math.min(4, deslMagGrid) },
          cells: gerarAreaCircularMagica(raioGrid, true),
        },
      };
      attacks.push(atkCirc);
      magicAttackIds.push(atkCirc.id);
    }

    // Cada Slot de Mana nomeado vira uma técnica tática pronta para usar!
    summary.slotsAtivos.forEach((slotItem, idx) => {
      const isExt = slotItem.slot.startsWith('ext-');
      const bonusSlot = Math.max(0, Math.round(slotItem.custo));
      const alcSlotGrid = Math.max(
        2,
        Math.min(9, Math.round((stats.alcanceDirecional || 12) / escala))
      );
      const atkSlot: Attack = {
        id: `atk_ep_slot_${idx}_${safeSlug}`,
        name: `${slotItem.nome} (${slotItem.slot.toUpperCase()})`,
        description: `Técnica de Slot ${
          isExt ? 'Externo' : 'Interno'
        } (Custo reservado: ${slotItem.custo} Mana).`,
        range: isExt ? deslMagGrid : alcSlotGrid,
        damage: danoArcano + bonusSlot,
        impactType: isExt ? 'Manifestação Externa' : 'Técnica Interna',
        effects: [],
        area: isExt
          ? {
              origin: { x: 0, y: -Math.min(3, deslMagGrid) },
              cells: gerarAreaCircularMagica(
                Math.max(1, Math.min(3, Math.round(stats.raioCircular / escala) || 1)),
                true
              ),
            }
          : {
              origin: { x: 0, y: 0 },
              cells: gerarAreaDirecionalMagica(
                stats.anguloNum,
                alcSlotGrid,
                ficha.larguraReta
              ),
            },
      };
      attacks.push(atkSlot);
      magicAttackIds.push(atkSlot.id);
    });

    if (magicAttackIds.length > 0) {
      weapons.push({
        id: wpMagiaId,
        name: 'Canalização Espiritual',
        iconId: 'wicon_staff',
        category: `${LINHAGEM_LABELS[ficha.linhagem]} • Magia`,
        range: deslMagGrid,
        baseDamage: stats.danoMagico,
        attackIds: magicAttackIds,
      });
    }
  }

  const character: Character = {
    id: charId,
    name: ficha.nome.trim() || 'Herói Sem Nome',
    imageId: sugerirEmblemaPorFicha(ficha),
    hpMax: Math.max(1, stats.vidaEfetivaMax),
    hpCurrent: Math.max(0, Math.min(stats.vidaEfetivaMax, stats.vidaAtual)),
    movement: Math.max(1, stats.deslocamento),
    baseDamage: stats.danoFisico,
    weaponIds: weapons.map((w) => w.id),
    position: null,
    facing: Direction.South,
    width: Math.max(1, Math.min(6, opcoes.width ?? 1)),
    height: Math.max(1, Math.min(6, opcoes.height ?? 1)),
    fichaId: ficha.id,
    epitomeSummary: summary,
  };

  return { character, weapons, attacks, summary };
}

/**
 * Fichas demonstrativas originais extraídas de `Spiritual-Epitome/saves/`,
 * semeadas apenas na primeira execução se o banco estiver vazio.
 */
export const DEFAULT_SAMPLE_FICHAS: EpitomeFicha[] = [
  normalizarFicha({
    id: 'mtc73zyx-h7974x',
    nomeJogador: 'Mestre',
    nome: 'Thorgar Uru’Khan',
    conceito:
      'Thorgar nasceu nas terras selvagens do Norte, onde o vento corta como lâminas e apenas os fortes sobrevivem. Criado desde pequeno para a guerra, aprendeu a caçar, lutar e honrar os espíritos ancestrais da sua tribo.',
    linhagem: 'agraco',
    tribo: 'Gigante Tribal',
    nivel: 17,
    xp: 0,
    tipoArma: 'Media',
    nomeArma: 'Machado Ancestral Uru’Khan',
    danoArma: 6,
    quadSE: 'Q',
    quadSD: '',
    quadIE: 'Q',
    quadID: 'X',
    anguloDirecional: '90',
    larguraReta: 1,
    bolsa: 'Totem dos Espíritos Ancestrais, Manto de Pele do Norte, Ração de Caça.',
    mochilaArmasIds: ['wp_arsenal_machado'],
    armaEquipadaId: 'wp_arsenal_machado',
    avatarImageId: 'preset_knight',
    _pericias: {
      atletismo: 3,
      vigor: 6,
      tolerancia: 6,
      analise: 1,
      foco: 2,
      concentracao: 0,
      canalizacao: 2,
      integracao: 4,
      ancoragem: 3,
      prontidao: 5,
      investigacao: 1,
      sensibilidade: 3,
      sensacao: 2,
      persuasao: 0,
      empatia: 1,
      agilidade: 6,
      forca: 6,
      manualidade: 6,
    },
    _slots: {
      'int-1': 'Fúria Ancestral',
      'int-2': '',
      'int-3': '',
      'int-4': '',
      'ext-1': 'Rugido dos Uru’Khan',
      'ext-2': '',
      'ext-3': '',
      'ext-4': '',
      'ext-5': '',
      'ext-6': '',
    },
    _slotCustos: {
      'int-1': 2,
      'int-2': 0,
      'int-3': 0,
      'int-4': 0,
      'ext-1': 3,
      'ext-2': 0,
      'ext-3': 0,
      'ext-4': 0,
      'ext-5': 0,
      'ext-6': 0,
    },
    _estado: {
      vidaAtual: 32,
      vidaVendida: 0,
      manaVendida: 0,
      estaminaAtual: 17,
      racAtual: 7,
    },
    _ts: 1787875835865,
  }),
  normalizarFicha({
    id: 'mtc867rl-fqw68b',
    nomeJogador: 'Mestre',
    nome: 'Kael Andarilho',
    conceito: 'Um Kael Andarilho, de uma família de Andarilhos.',
    linhagem: 'pungente',
    tribo: 'Sem Tribo',
    nivel: 8,
    xp: 500,
    tipoArma: 'Curta',
    nomeArma: 'Adaga de Caça',
    danoArma: 5,
    quadSE: 'O',
    quadSD: 'Q',
    quadIE: 'X',
    quadID: 'Q',
    anguloDirecional: '60',
    larguraReta: 1,
    bolsa: 'Adaga de Caça, Mapa das Estradas Antigas, Cantil.',
    mochilaArmasIds: ['wp_arsenal_adaga', 'wp_elven_bow'],
    armaEquipadaId: 'wp_arsenal_adaga',
    avatarImageId: 'preset_rogue',
    _pericias: {
      atletismo: 3,
      vigor: 2,
      tolerancia: 1,
      analise: 6,
      foco: 5,
      concentracao: 1,
      canalizacao: 3,
      integracao: 3,
      ancoragem: 2,
      prontidao: 3,
      investigacao: 1,
      sensibilidade: 0,
      sensacao: 0,
      persuasao: 0,
      empatia: 0,
      agilidade: 0,
      forca: 0,
      manualidade: 0,
    },
    _slots: {
      'int-1': 'Passo Sombrio',
      'int-2': '',
      'int-3': '',
      'int-4': '',
      'ext-1': 'Lâmina de Vento',
      'ext-2': '',
      'ext-3': '',
      'ext-4': '',
      'ext-5': '',
      'ext-6': '',
    },
    _slotCustos: {
      'int-1': 1,
      'int-2': 0,
      'int-3': 0,
      'int-4': 0,
      'ext-1': 2,
      'ext-2': 0,
      'ext-3': 0,
      'ext-4': 0,
      'ext-5': 0,
      'ext-6': 0,
    },
    _estado: {
      vidaAtual: 20,
      vidaVendida: 0,
      manaVendida: 0,
      estaminaAtual: 7,
      racAtual: 13,
    },
    _ts: 1787877618897,
  }),
];
