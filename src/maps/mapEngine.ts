import { Board, Character, TerrainType } from '../types';
import { canPlaceCharacter, cellKey, getOccupiedCells } from '../engine/geometry';
import {
  GameMap,
  MAP_DEFAULT_FOG_RANGE,
  MAP_DEFAULT_HEIGHT,
  MAP_DEFAULT_WIDTH,
  MAP_MAX_SIZE,
  MAP_MIN_SIZE,
  MapCatalog,
  MapFolder,
  MapStair,
  StairDirection,
} from './mapTypes';

const clampSize = (v: unknown, fallback: number): number =>
  Math.max(MAP_MIN_SIZE, Math.min(MAP_MAX_SIZE, Math.round(Number(v) || fallback)));

export function gerarMapId(): string {
  return `map_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function gerarPastaId(): string {
  return `folder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Cria uma pasta vazia de mapas. */
export function criarPasta(nome = 'Nova Pasta', descricao = ''): MapFolder {
  return {
    id: gerarPastaId(),
    nome: String(nome).trim() || 'Nova Pasta',
    descricao: String(descricao || ''),
    criadoEm: Date.now(),
  };
}

function normalizarPasta(raw: any): MapFolder | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : gerarPastaId();
  return {
    id,
    nome: String(raw.nome ?? raw.name ?? 'Pasta').trim() || 'Pasta',
    descricao: String(raw.descricao ?? raw.description ?? ''),
    criadoEm: typeof raw.criadoEm === 'number' ? raw.criadoEm : Date.now(),
  };
}

export function gerarStairId(): string {
  return `stair_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function criarMapaEmBranco(
  nome = 'Novo Mapa',
  largura = MAP_DEFAULT_WIDTH,
  altura = MAP_DEFAULT_HEIGHT
): GameMap {
  const agora = Date.now();
  return {
    id: gerarMapId(),
    nome,
    descricao: '',
    largura: clampSize(largura, MAP_DEFAULT_WIDTH),
    altura: clampSize(altura, MAP_DEFAULT_HEIGHT),
    terrain: {},
    stairs: [],
    fog: { mode: 'day', range: MAP_DEFAULT_FOG_RANGE, locked: false },
    placements: {},
    folderId: null,
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

/** Cria um mapa a partir do tabuleiro atual (adota dimensões e terreno). */
export function mapaAPartirDoTabuleiro(
  board: Board,
  nome: string,
  id?: string
): GameMap {
  const agora = Date.now();
  return {
    id: id || board.id || gerarMapId(),
    nome: nome || 'Mapa do Tabuleiro',
    descricao: '',
    largura: clampSize(board.width, MAP_DEFAULT_WIDTH),
    altura: clampSize(board.height, MAP_DEFAULT_HEIGHT),
    terrain: { ...board.terrain },
    stairs: [],
    fog: { mode: 'day', range: MAP_DEFAULT_FOG_RANGE, locked: false },
    placements: {},
    folderId: null,
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

function normalizarEscada(raw: any): MapStair {
  return {
    id: String(raw?.id || gerarStairId()),
    x: Math.max(0, Math.round(Number(raw?.x) || 0)),
    y: Math.max(0, Math.round(Number(raw?.y) || 0)),
    direction: (raw?.direction === 'up' ? 'up' : 'down') as StairDirection,
    label: String(raw?.label ?? '').trim(),
    targetMapId:
      typeof raw?.targetMapId === 'string' && raw.targetMapId
        ? raw.targetMapId
        : null,
    targetStairId:
      typeof raw?.targetStairId === 'string' && raw.targetStairId
        ? raw.targetStairId
        : null,
  };
}

/** Normaliza um mapa vindo do banco local ou de um ficheiro importado. */
export function normalizarMapa(raw: any, idFallback?: string): GameMap {
  const base = criarMapaEmBranco();
  if (!raw || typeof raw !== 'object') {
    return { ...base, id: idFallback || base.id };
  }

  const largura = clampSize(raw.largura ?? raw.width, MAP_DEFAULT_WIDTH);
  const altura = clampSize(raw.altura ?? raw.height, MAP_DEFAULT_HEIGHT);

  // Só mantém terreno dentro dos limites do mapa
  const terrain: Record<string, TerrainType> = {};
  const rawTerrain = (raw.terrain || {}) as Record<string, TerrainType>;
  for (const [k, v] of Object.entries(rawTerrain)) {
    if (v !== 'impassable' && v !== 'difficult' && v !== 'normal') continue;
    const [xs, ys] = k.split(',');
    const x = Number(xs);
    const y = Number(ys);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < 0 || y < 0 || x >= largura || y >= altura) continue;
    if (v === 'normal') continue;
    terrain[k] = v;
  }

  const stairs: MapStair[] = Array.isArray(raw.stairs)
    ? raw.stairs
        .map((st: any) => normalizarEscada(st))
        .filter(
          (st: MapStair) =>
            st.x >= 0 && st.y >= 0 && st.x < largura && st.y < altura
        )
    : [];

  const placements: Record<string, { x: number; y: number }> = {};
  const rawPlacements = (raw.placements || {}) as Record<string, any>;
  for (const [cid, pos] of Object.entries(rawPlacements)) {
    if (!pos) continue;
    const x = Math.round(Number(pos.x));
    const y = Math.round(Number(pos.y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < 0 || y < 0 || x >= largura || y >= altura) continue;
    placements[cid] = { x, y };
  }

  const fogRaw = raw.fog || {};
  const mode = fogRaw.mode === 'exploration' ? 'exploration' : 'day';
  const range = Math.max(
    1,
    Math.min(40, Math.round(Number(fogRaw.range) || MAP_DEFAULT_FOG_RANGE))
  );

  const criadoEm =
    typeof raw.criadoEm === 'number' ? raw.criadoEm : Date.now();

  return {
    id: String(raw.id || idFallback || base.id),
    nome: String(raw.nome ?? raw.name ?? 'Mapa').trim() || 'Mapa',
    descricao: String(raw.descricao ?? raw.description ?? ''),
    largura,
    altura,
    terrain,
    stairs,
    fog: { mode, range, locked: fogRaw.locked === true },
    placements,
    folderId:
      typeof raw.folderId === 'string' && raw.folderId ? raw.folderId : null,
    criadoEm,
    atualizadoEm: typeof raw.atualizadoEm === 'number' ? raw.atualizadoEm : criadoEm,
  };
}

export function normalizarCatalogoMapas(raw: any): MapCatalog {
  const maps: Record<string, GameMap> = {};
  const lista: any[] = Array.isArray(raw?.maps)
    ? raw.maps
    : raw?.maps && typeof raw.maps === 'object'
    ? Object.values(raw?.maps)
    : [];

  for (const item of lista) {
    const m = normalizarMapa(item);
    maps[m.id] = m;
  }

  const folders: Record<string, MapFolder> = {};
  const listaPastas: any[] = Array.isArray(raw?.folders)
    ? raw.folders
    : raw?.folders && typeof raw.folders === 'object'
    ? Object.values(raw.folders)
    : [];
  for (const item of listaPastas) {
    const f = normalizarPasta(item);
    if (f) folders[f.id] = f;
  }

  // Pastas referenciadas por mapas mas inexistentes são descartadas
  for (const m of Object.values(maps)) {
    if (m.folderId && !folders[m.folderId]) m.folderId = null;
  }

  const defaultMapId =
    typeof raw?.defaultMapId === 'string' && maps[raw.defaultMapId]
      ? raw.defaultMapId
      : Object.keys(maps)[0] ?? null;

  return agruparPastasLigadas({ maps, folders, defaultMapId });
}

/** Pastas ordenadas por nome. */
export function listarPastas(catalog: MapCatalog): MapFolder[] {
  return Object.values(catalog.folders || {}).sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR')
  );
}

/** Mapas de uma pasta (ou os que não têm pasta, com folderId = null). */
export function mapasDaPasta(
  catalog: MapCatalog,
  folderId: string | null
): GameMap[] {
  return listarMapas(catalog).filter((m) => (m.folderId ?? null) === folderId);
}

/**
 * Componente de mapas ligados por escadas (ida e/ou volta), a partir de um mapa.
 * Serve de fallback quando o mapa ainda não está numa pasta.
 */
export function componenteDeMapas(
  catalog: MapCatalog,
  mapId: string | null | undefined
): GameMap[] {
  if (!mapId || !catalog.maps[mapId]) return [];
  const vistos = new Set<string>([mapId]);
  const fila = [mapId];
  while (fila.length > 0) {
    const atual = catalog.maps[fila.shift() as string];
    if (!atual) continue;
    for (const st of atual.stairs) {
      if (!st.targetMapId || vistos.has(st.targetMapId)) continue;
      if (!catalog.maps[st.targetMapId]) continue;
      vistos.add(st.targetMapId);
      fila.push(st.targetMapId);
    }
    // Ligações inversas (mapas que apontam para este)
    for (const m of Object.values(catalog.maps)) {
      if (vistos.has(m.id)) continue;
      if (m.stairs.some((st) => st.targetMapId === atual.id)) {
        vistos.add(m.id);
        fila.push(m.id);
      }
    }
  }

  // Andares inferiores primeiro (quem só tem ligações de descida para fora)
  return listarMapas(catalog).filter((m) => vistos.has(m.id));
}

/**
 * Mapas que fazem sentido mostrar no jogo para o mapa ativo:
 * a pasta (se existir) ou, sem pasta, os mapas ligados por escadas.
 */
export function mapasDoConjunto(
  catalog: MapCatalog,
  mapId: string | null | undefined
): GameMap[] {
  if (!mapId || !catalog.maps[mapId]) return listarMapas(catalog);
  const mapa = catalog.maps[mapId];
  if (mapa.folderId && catalog.folders[mapa.folderId]) {
    return mapasDaPasta(catalog, mapa.folderId);
  }
  const comp = componenteDeMapas(catalog, mapId);
  return comp.length > 0 ? comp : [mapa];
}

/** Escada do mapa ativo que leva a um andar superior / inferior. */
export function vizinhosDeAndar(
  catalog: MapCatalog,
  mapId: string | null | undefined
): { acima: GameMap | null; abaixo: GameMap | null } {
  const mapa = mapId ? catalog.maps[mapId] : null;
  if (!mapa) return { acima: null, abaixo: null };

  const primeiroAlvo = (dir: StairDirection): GameMap | null => {
    for (const st of mapa.stairs) {
      if (st.direction !== dir) continue;
      const alvo = st.targetMapId ? catalog.maps[st.targetMapId] : null;
      if (alvo) return alvo;
    }
    return null;
  };

  return { acima: primeiroAlvo('up'), abaixo: primeiroAlvo('down') };
}

/**
 * Garante que mapas ligados por escadas ficam na mesma pasta.
 * Só cria pasta quando os dois mapas ainda não têm nenhuma.
 */
export function agruparPastasLigadas(catalog: MapCatalog): MapCatalog {
  const folders = { ...catalog.folders };
  const maps = { ...catalog.maps };

  for (const origem of Object.values(maps)) {
    for (const st of origem.stairs) {
      const destinoId = st.targetMapId;
      if (!destinoId || destinoId === origem.id) continue;
      const destino = maps[destinoId];
      if (!destino) continue;

      const a = maps[origem.id];
      if (a.folderId && destino.folderId && a.folderId !== destino.folderId) {
        continue; // pastas diferentes escolhidas pelo mestre: respeitar
      }
      if (a.folderId && !destino.folderId) {
        maps[destinoId] = { ...destino, folderId: a.folderId };
      } else if (!a.folderId && destino.folderId) {
        maps[origem.id] = { ...a, folderId: destino.folderId };
      }
    }
  }

  // Componentes ligados sem pasta nenhuma passam a ter uma pasta própria
  const vistos = new Set<string>();
  for (const mapa of Object.values(maps)) {
    if (vistos.has(mapa.id)) continue;
    const comp = componenteDeMapas({ maps, folders, defaultMapId: null }, mapa.id);
    comp.forEach((m) => vistos.add(m.id));
    if (comp.length < 2) continue;
    if (comp.some((m) => m.folderId && folders[m.folderId])) continue;
    const pasta = criarPasta(`Andares — ${mapa.nome}`);
    folders[pasta.id] = pasta;
    for (const m of comp) {
      maps[m.id] = { ...maps[m.id], folderId: pasta.id };
    }
  }

  return { maps, folders, defaultMapId: catalog.defaultMapId };
}

export function listarMapas(catalog: MapCatalog): GameMap[] {
  return Object.values(catalog.maps || {}).sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR')
  );
}

/** Escada que ocupa a célula indicada (considera o footprint da unidade). */
export function escadaNaCelula(
  mapa: GameMap | null | undefined,
  x: number,
  y: number
): MapStair | null {
  if (!mapa) return null;
  return mapa.stairs.find((s) => s.x === x && s.y === y) ?? null;
}

/**
 * Escada sob a unidade (qualquer célula do seu footprint).
 * Unidades maiores que 1×1 também acionam escadas nas células que ocupam.
 */
export function escadaSobUnidade(
  mapa: GameMap | null | undefined,
  unidade: Character
): MapStair | null {
  if (!mapa || !unidade.position) return null;
  const cells = getOccupiedCells(unidade.position, unidade.width, unidade.height);
  for (const c of cells) {
    const s = escadaNaCelula(mapa, c.x, c.y);
    if (s) return s;
  }
  return null;
}

export function escadasLigadas(mapa: GameMap): MapStair[] {
  return mapa.stairs.filter((s) => Boolean(s.targetMapId));
}

export function escadasOrfas(mapa: GameMap, catalog: MapCatalog): MapStair[] {
  return mapa.stairs.filter(
    (s) => !s.targetMapId || !catalog.maps[s.targetMapId]
  );
}

/**
 * Calcula a célula de chegada ao entrar num mapa.
 * Prioridade: escada de chegada explícita → escada que aponta de volta para
 * a origem → primeira escada do mapa → `null` (colocação automática).
 */
export function resolverChegada(
  destino: GameMap,
  origemMapId: string | null,
  chegadaStairId?: string | null
): { x: number; y: number } | null {
  if (chegadaStairId) {
    const s = destino.stairs.find((st) => st.id === chegadaStairId);
    if (s) return { x: s.x, y: s.y };
  }
  if (origemMapId) {
    const retorno = destino.stairs.find((s) => s.targetMapId === origemMapId);
    if (retorno) return { x: retorno.x, y: retorno.y };
  }
  if (destino.stairs.length > 0) {
    return { x: destino.stairs[0].x, y: destino.stairs[0].y };
  }
  return null;
}

/** Primeira célula livre em espiral a partir de uma posição. */
export function primeiraCelulaLivre(
  board: Board,
  characters: Record<string, Character>,
  unidade: Character,
  origem: { x: number; y: number }
): { x: number; y: number } | null {
  const maxRaio = Math.max(board.width, board.height);
  for (let raio = 0; raio <= maxRaio; raio++) {
    for (let dy = -raio; dy <= raio; dy++) {
      for (let dx = -raio; dx <= raio; dx++) {
        if (raio > 0 && Math.abs(dx) !== raio && Math.abs(dy) !== raio) continue;
        const pos = { x: origem.x + dx, y: origem.y + dy };
        if (pos.x < 0 || pos.y < 0) continue;
        if (pos.x + unidade.width > board.width) continue;
        if (pos.y + unidade.height > board.height) continue;
        if (
          canPlaceCharacter(
            board,
            characters,
            pos,
            unidade.width,
            unidade.height,
            unidade.id
          )
        ) {
          return pos;
        }
      }
    }
  }
  return null;
}

/** Converte um GameMap no `Board` usado pelo tabuleiro. */
export function boardDoMapa(mapa: GameMap): Board {
  return {
    id: mapa.id,
    width: mapa.largura,
    height: mapa.altura,
    terrain: { ...mapa.terrain },
  };
}

/** Etiqueta curta da direção da escada. */
export function rotuloDirecao(dir: StairDirection): string {
  return dir === 'up' ? 'Subida' : 'Descida';
}

export function simboloDirecao(dir: StairDirection): string {
  return dir === 'up' ? '▲' : '▼';
}

/** Valida se duas escadas não ocupam a mesma célula. */
export function celulaTemEscada(
  mapa: GameMap,
  x: number,
  y: number,
  ignorarStairId?: string | null
): boolean {
  return mapa.stairs.some(
    (s) => s.x === x && s.y === y && s.id !== ignorarStairId
  );
}

export function chaveCelula(x: number, y: number): string {
  return cellKey(x, y);
}
