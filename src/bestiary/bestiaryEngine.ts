import { Attack, Character, Direction, Weapon } from '../types';
import {
  BestiaryCatalog,
  BestiaryMonster,
  MonsterCombatProfile,
  MonsterLootItem,
  MonsterSkills,
  MonsterTacticalBundle,
} from './bestiaryTypes';

/* =========================================================================
   ELEMENTOS — lista herdada do Heartz-Link (18 atributos elementais)
   ========================================================================= */

export interface ElementoInfo {
  id: string;
  cor: string;
  simbolo: string;
  /** Grafias legadas aceites na importação do Heartz-Link */
  legado: string[];
}

export const ELEMENTOS: ElementoInfo[] = [
  { id: 'Fogo', cor: '#f97316', simbolo: '🔥', legado: ['fire'] },
  { id: 'Água', cor: '#38bdf8', simbolo: '💧', legado: ['water'] },
  { id: 'Terra', cor: '#a16207', simbolo: '⛰', legado: ['earth'] },
  { id: 'Ar', cor: '#a3e635', simbolo: '🌪', legado: ['air'] },
  { id: 'Raio', cor: '#facc15', simbolo: '⚡', legado: ['lightning'] },
  { id: 'Gelo', cor: '#67e8f9', simbolo: '❄', legado: ['ice'] },
  { id: 'Gravidade', cor: '#a78bfa', simbolo: '🌀', legado: ['gravity'] },
  { id: 'Som', cor: '#c084fc', simbolo: '🎵', legado: ['sound'] },
  { id: 'Sangue', cor: '#dc2626', simbolo: '🩸', legado: ['blood'] },
  { id: 'Veneno', cor: '#84cc16', simbolo: '☠', legado: ['poison'] },
  { id: 'Planta', cor: '#22c55e', simbolo: '🌿', legado: ['plant'] },
  { id: 'Metal', cor: '#94a3b8', simbolo: '⚙', legado: ['metal'] },
  { id: 'Sagrado', cor: '#fde047', simbolo: '✦', legado: ['holy'] },
  { id: 'Sombrio', cor: '#7c3aed', simbolo: '🌑', legado: ['dark'] },
  { id: 'Tempo', cor: '#2dd4bf', simbolo: '⏳', legado: ['time'] },
  { id: 'Dimensão', cor: '#818cf8', simbolo: '◈', legado: ['dimension'] },
  { id: 'Cristal', cor: '#22d3ee', simbolo: '💎', legado: ['crystal'] },
  { id: 'Éter', cor: '#e879f9', simbolo: '✧', legado: ['ether'] },
];

export const DIETAS_SUGERIDAS = [
  'Herbívoro',
  'Carnívoro',
  'Onívoro',
  'Detritívoro',
  'Parasita',
  'Mineral',
  'Incorpóreo',
  'Fotossintético',
];

export const RARIDADES = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendário'];

export function elementoInfo(idOuLegado: string): ElementoInfo | null {
  const q = String(idOuLegado || '').trim().toLowerCase();
  if (!q) return null;
  return (
    ELEMENTOS.find(
      (el) =>
        el.id.toLowerCase() === q ||
        el.legado.some((l) => l.toLowerCase() === q)
    ) ?? null
  );
}

function normalizarElemento(valor: string): string {
  const info = elementoInfo(valor);
  if (info) return info.id;
  const limpo = String(valor || '').trim();
  return limpo ? limpo.charAt(0).toUpperCase() + limpo.slice(1) : '';
}

function normalizarRaridade(valor: string): string {
  const q = String(valor || '').trim().toLowerCase();
  if (!q) return 'Comum';
  const mapa: Record<string, string> = {
    comum: 'Comum',
    common: 'Comum',
    incomum: 'Incomum',
    uncommon: 'Incomum',
    raro: 'Raro',
    rare: 'Raro',
    epico: 'Épico',
    'épico': 'Épico',
    epic: 'Épico',
    lendario: 'Lendário',
    'lendário': 'Lendário',
    legendary: 'Lendário',
  };
  return mapa[q] ?? 'Comum';
}

function normalizarDieta(valor: string): string {
  const q = String(valor || '').trim().toLowerCase();
  if (!q) return '';
  if (q.startsWith('carn')) return 'Carnívoro';
  if (q.startsWith('herb')) return 'Herbívoro';
  if (q.startsWith('oniv') || q.startsWith('onív')) return 'Onívoro';
  if (q.includes('planta') || q.includes('planta')) return 'Herbívoro';
  return String(valor).trim();
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};

/* =========================================================================
   NORMALIZAÇÃO — aceita fichas novas (PT) e legadas do Heartz-Link (EN)
   ========================================================================= */

export function gerarIdMonstro(): string {
  return `mon_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function criarMonstroEmBranco(nome = 'Nova Criatura'): BestiaryMonster {
  const agora = Date.now();
  return {
    id: gerarIdMonstro(),
    criadoEm: agora,
    atualizadoEm: agora,
    nome,
    alias: '',
    regioes: [],
    dieta: '',
    presas: [],
    descricao: '',
    imagemId: null,
    habilidades: {
      fisico: { rapidez: 0, forca: 0, resistencia: 0 },
      magico: { artesanato: 0, impacto: 0, manipulacao: 0 },
      extras: {},
    },
    elementos: [],
    itensExtraiveis: [],
  };
}

/**
 * Converte qualquer ficha (formato Heartz-Link em inglês ou formato novo em
 * português) num `BestiaryMonster` válido. Nunca lança — devolve sempre algo
 * utilizável, para que importações antigas não quebrem o Bestiário.
 */
export function normalizarMonstro(
  raw: any,
  idFallback?: string
): BestiaryMonster {
  const base = criarMonstroEmBranco();
  if (!raw || typeof raw !== 'object') {
    return { ...base, id: idFallback || base.id };
  }

  const skills = raw.habilidades || raw.skills || {};
  const fisico = skills.fisico || skills.physical || {};
  const magico = skills.magico || skills.magical || {};
  const extrasRaw = skills.extras || skills.extra || {};

  const extras: Record<string, number> = {};
  for (const [k, v] of Object.entries(extrasRaw || {})) {
    const nome = String(k).trim();
    if (nome) extras[nome] = num(v);
  }

  const habilidades: MonsterSkills = {
    fisico: {
      rapidez: num(fisico.rapidez ?? fisico.agility),
      forca: num(fisico.forca ?? fisico.strength),
      resistencia: num(fisico.resistencia ?? fisico.endurance),
    },
    magico: {
      artesanato: num(magico.artesanato ?? magico.crafting),
      impacto: num(magico.impacto ?? magico.impact),
      manipulacao: num(magico.manipulacao ?? magico.manipulation),
    },
    extras,
  };

  const regioesRaw = raw.regioes ?? raw.regions;
  const regioes: string[] = Array.isArray(regioesRaw)
    ? regioesRaw.map((r: any) => String(r || '').trim()).filter(Boolean)
    : raw.region
    ? [String(raw.region).trim()].filter(Boolean)
    : [];

  const elementosRaw = raw.elementos ?? raw.elements;
  const elementos = (
    Array.isArray(elementosRaw) ? elementosRaw : Object.keys(elementosRaw || {})
  )
    .map((e: any) => normalizarElemento(String(e)))
    .filter(Boolean);

  const itensRaw = raw.itensExtraiveis ?? raw.extractableItems;
  const itensExtraiveis: MonsterLootItem[] = Array.isArray(itensRaw)
    ? itensRaw
        .map((item: any) => ({
          nome: String(item?.nome ?? item?.name ?? '').trim(),
          raridade: normalizarRaridade(
            String(item?.raridade ?? item?.rarity ?? '')
          ),
          dificuldade: num(item?.dificuldade ?? item?.difficulty),
        }))
        .filter((item) => item.nome.length > 0)
    : [];

  const criadoEm =
    typeof raw.criadoEm === 'number'
      ? raw.criadoEm
      : raw.createdAt
      ? Date.parse(String(raw.createdAt)) || Date.now()
      : Date.now();

  const atualizadoEm =
    typeof raw.atualizadoEm === 'number'
      ? raw.atualizadoEm
      : raw.updatedAt
      ? Date.parse(String(raw.updatedAt)) || criadoEm
      : criadoEm;

  const presasRaw = raw.presas ?? raw.prey;

  return {
    id: String(raw.id || idFallback || base.id),
    criadoEm,
    atualizadoEm,
    nome: String(raw.nome ?? raw.name ?? 'Criatura Sem Nome').trim(),
    alias: String(raw.alias ?? '').trim(),
    regioes,
    dieta: normalizarDieta(String(raw.dieta ?? raw.diet ?? '')),
    presas: Array.isArray(presasRaw)
      ? presasRaw.map((p: any) => String(p || '').trim()).filter(Boolean)
      : [],
    descricao: String(raw.descricao ?? raw.appearance ?? '').trim(),
    imagemId:
      typeof raw.imagemId === 'string' && raw.imagemId.length > 0
        ? raw.imagemId
        : null,
    habilidades,
    elementos,
    itensExtraiveis,
    ajustes:
      raw.ajustes && typeof raw.ajustes === 'object'
        ? {
            largura: raw.ajustes.largura
              ? Math.max(1, Math.min(6, num(raw.ajustes.largura)))
              : undefined,
            altura: raw.ajustes.altura
              ? Math.max(1, Math.min(6, num(raw.ajustes.altura)))
              : undefined,
            vida: raw.ajustes.vida ? num(raw.ajustes.vida) : undefined,
            movimento: raw.ajustes.movimento
              ? num(raw.ajustes.movimento)
              : undefined,
          }
        : undefined,
  };
}

export function normalizarBestiario(raw: any): BestiaryCatalog {
  const monsters: Record<string, BestiaryMonster> = {};
  const lista: any[] = Array.isArray(raw?.monsters)
    ? raw.monsters
    : Array.isArray(raw)
    ? raw
    : raw?.monsters && typeof raw.monsters === 'object'
    ? Object.values(raw.monsters)
    : [];

  for (const item of lista) {
    const m = normalizarMonstro(item);
    monsters[m.id] = m;
  }
  return { monsters };
}

/* =========================================================================
   PERFIL TÁTICO — Pontos de Classificação → valores do Tabuleiro
   ========================================================================= */

const FAIXAS_AMEACA = [
  'Inofensivo',
  'Nível I — Trivial',
  'Nível II — Comum',
  'Nível III — Perigoso',
  'Nível IV — Letal',
  'Nível V — Catastrófico',
];

const CLASSIFICACAO_TAMANHO = [
  'Comum (1×1)',
  'Grande (2×2)',
  'Enorme (3×3)',
  'Colossal (4×4)',
];

export function calcularPerfilCombate(
  monstro: BestiaryMonster
): MonsterCombatProfile {
  const f = monstro.habilidades.fisico;
  const g = monstro.habilidades.magico;
  const extrasTotal = Object.values(monstro.habilidades.extras || {}).reduce(
    (acc, v) => acc + (Number(v) || 0),
    0
  );

  const totalPontos =
    f.rapidez +
    f.forca +
    f.resistencia +
    g.artesanato +
    g.impacto +
    g.manipulacao +
    extrasTotal;

  const vitalidadeExtra =
    Number(monstro.habilidades.extras?.['Vitalidade']) ||
    Number(monstro.habilidades.extras?.['vitalidade']) ||
    0;

  const nivelAmeaca =
    totalPontos <= 0
      ? 0
      : totalPontos <= 20
      ? 1
      : totalPontos <= 40
      ? 2
      : totalPontos <= 60
      ? 3
      : totalPontos <= 85
      ? 4
      : 5;

  const vida = Math.max(
    1,
    Math.round(
      monstro.ajustes?.vida ?? 10 + f.resistencia * 3 + vitalidadeExtra * 2
    )
  );

  const movimento = Math.max(
    1,
    Math.min(
      12,
      Math.round(monstro.ajustes?.movimento ?? 2 + Math.round(f.rapidez / 4))
    )
  );

  const danoFisico = Math.max(
    0,
    Math.round(f.forca * 0.6) + (f.forca > 0 ? 1 : 0)
  );
  const danoMagico = Math.max(0, Math.round((g.impacto + g.manipulacao) * 0.4));

  const somaTamanho = f.resistencia + f.forca;
  const indiceTamanho =
    somaTamanho < 15 ? 0 : somaTamanho < 28 ? 1 : somaTamanho < 39 ? 2 : 3;

  const largura = Math.max(
    1,
    Math.min(6, monstro.ajustes?.largura ?? indiceTamanho + 1)
  );
  const altura = Math.max(
    1,
    Math.min(6, monstro.ajustes?.altura ?? indiceTamanho + 1)
  );

  return {
    totalPontos,
    nivelAmeaca,
    faixaAmeaca: FAIXAS_AMEACA[nivelAmeaca],
    vida,
    movimento,
    danoFisico,
    danoMagico,
    iniciativa: f.rapidez,
    largura,
    altura,
    classificacaoTamanho: CLASSIFICACAO_TAMANHO[indiceTamanho],
  };
}

/* =========================================================================
   CONVERSÃO PARA O TABULEIRO
   ========================================================================= */

function slugId(monstroId: string): string {
  return String(monstroId).replace(/[^a-zA-Z0-9_-]/g, '');
}

export interface ConversaoMonstroOpcoes {
  existingCharacterId?: string | null;
  largura?: number;
  altura?: number;
}

/** Ataques naturais derivados dos pontos de classificação. */
export function gerarAtaquesDoMonstro(
  monstro: BestiaryMonster,
  perfil: MonsterCombatProfile
): Attack[] {
  const slug = slugId(monstro.id);
  const ataques: Attack[] = [];

  // 1. Golpe natural corpo a corpo (sempre existe, mesmo com 0 pontos)
  ataques.push({
    id: `atk_mon_${slug}_natural`,
    name: perfil.largura >= 3 ? 'Esmagar' : 'Golpe Natural',
    description: `Ataque físico natural de ${monstro.nome}.`,
    range: 1,
    damage: Math.max(1, perfil.danoFisico),
    impactType: 'Contundente',
    effects: [],
    area: {
      origin: { x: 0, y: 0 },
      cells: [{ dx: 0, dy: -1, zone: 'red' }],
    },
  });

  // 2. Investida ampla para criaturas Grandes ou maiores
  if (perfil.largura >= 2) {
    ataques.push({
      id: `atk_mon_${slug}_investida`,
      name: 'Investida',
      description: 'Avanço brutal que atinge toda a linha frontal.',
      range: 2,
      damage: Math.max(1, Math.round(perfil.danoFisico * 0.8)),
      impactType: 'Perfurante',
      effects: [],
      area: {
        origin: { x: 0, y: 0 },
        cells: [
          { dx: 0, dy: -1, zone: 'red' },
          { dx: 0, dy: -2, zone: 'orange' },
          { dx: -1, dy: -1, zone: 'yellow' },
          { dx: 1, dy: -1, zone: 'yellow' },
        ],
      },
    });
  }

  // 3. Descarga elemental, se houver pontos mágicos
  if (perfil.danoMagico > 0) {
    const elemento = monstro.elementos[0] || '';
    const nomeAtaque = elemento ? `Descarga de ${elemento}` : 'Descarga Elemental';
    const descricao = elemento
      ? `Manifestação elemental de ${elemento.toLowerCase()} projetada à distância.`
      : 'Manifestação mágica projetada à distância.';
    ataques.push({
      id: `atk_mon_${slug}_elemental`,
      name: nomeAtaque,
      description: descricao,
      range: 4,
      damage: perfil.danoMagico,
      impactType: elemento || 'Arcano',
      effects: [],
      area: {
        origin: { x: 0, y: 0 },
        cells: [
          { dx: 0, dy: -1, zone: 'orange' },
          { dx: 0, dy: -2, zone: 'orange' },
          { dx: 0, dy: -3, zone: 'yellow' },
        ],
      },
    });
  }

  return ataques;
}

export function converterMonstroParaTabuleiro(
  monstro: BestiaryMonster,
  opcoes: ConversaoMonstroOpcoes = {}
): MonsterTacticalBundle {
  const perfil = calcularPerfilCombate(monstro);
  const slug = slugId(monstro.id);
  const charId = opcoes.existingCharacterId || `char_mon_${slug}`;

  const ataques = gerarAtaquesDoMonstro(monstro, perfil);

  const arma: Weapon = {
    id: `wp_mon_${slug}`,
    name: `${monstro.nome} — Ataques Naturais`,
    iconId: 'wicon_claws',
    category: 'Criatura',
    range: Math.max(1, ...ataques.map((a) => a.range)),
    baseDamage: Math.max(1, perfil.danoFisico),
    attackIds: ataques.map((a) => a.id),
    epitomeTipo: 'Curta',
    description: monstro.descricao || `Ataques naturais de ${monstro.nome}.`,
  };

  const character: Character = {
    id: charId,
    name: monstro.nome,
    imageId: monstro.imagemId || '',
    hpMax: perfil.vida,
    hpCurrent: perfil.vida,
    movement: perfil.movimento,
    baseDamage: Math.max(1, perfil.danoFisico),
    weaponIds: [arma.id],
    position: null,
    facing: Direction.South,
    width: Math.max(1, Math.min(6, opcoes.largura ?? perfil.largura)),
    height: Math.max(1, Math.min(6, opcoes.altura ?? perfil.altura)),
  };

  return { character, weapons: [arma], attacks: ataques, perfil };
}

/* =========================================================================
   IMPORTAÇÃO DO HEARTZ-LINK
   ========================================================================= */

/**
 * Aceita o JSON exportado pelo Heartz-Link (`{ data: { heartzlink_monsters } }`,
 * `{ heartzlink_monsters: [...] }` ou apenas o array de monstros) e devolve um
 * catálogo do Bestiário. As imagens base64 do ficheiro original são ignoradas
 * para não inchar o banco local — o mestre pode reenviá-las na ficha.
 */
export function importarBestiarioHeartzLink(json: any): {
  catalog: BestiaryCatalog;
  total: number;
  ignoradosComImagem: number;
} {
  const raiz = json?.data ?? json;
  const lista: any[] = Array.isArray(raiz)
    ? raiz
    : Array.isArray(raiz?.heartzlink_monsters)
    ? raiz.heartzlink_monsters
    : Array.isArray(raiz?.monsters)
    ? raiz.monsters
    : [];

  const monsters: Record<string, BestiaryMonster> = {};
  let ignoradosComImagem = 0;

  for (const item of lista) {
    const m = normalizarMonstro(item);
    if (item?.image) ignoradosComImagem += 1;
    monsters[m.id] = m;
  }

  return { catalog: { monsters }, total: Object.keys(monsters).length, ignoradosComImagem };
}

/** Lista ordenada alfabeticamente, prática para as vistas do Bestiário. */
export function listarMonstros(catalog: BestiaryCatalog): BestiaryMonster[] {
  return Object.values(catalog.monsters || {}).sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR')
  );
}

/** Etiquetas de região usadas no catálogo (para filtros). */
export function listarRegioes(catalog: BestiaryCatalog): string[] {
  const set = new Set<string>();
  for (const m of Object.values(catalog.monsters || {})) {
    for (const r of m.regioes) set.add(r);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
