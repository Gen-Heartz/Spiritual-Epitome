import { Board, Character, DiagonalRule, FogRangeMode } from '../types';
import { cellKey, getOccupiedCells, getTerrainAt, GridPoint } from './geometry';

/**
 * Sistema de Névoa de Visão (Exploração).
 *
 * Só calcula que quadrados estão visíveis — não altera posições, terrenos,
 * unidades nem qualquer dado do tabuleiro. A névoa é aplicada apenas como
 * camada visual no `BoardCanvas`.
 */

export const FOG_DEFAULT_RANGE = 8;
export const FOG_MIN_RANGE = 1;
export const FOG_MAX_RANGE = 40;

/** Distância em quadrados entre duas células, respeitando a regra diagonal. */
export function distanciaGrid(
  a: GridPoint,
  b: GridPoint,
  rule: DiagonalRule = 'chebyshev'
): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if (rule === 'alternating') {
    const min = Math.min(dx, dy);
    const max = Math.max(dx, dy);
    // Cada passo diagonal alterna custo 1 e 2
    return max + Math.floor((min + 1) / 2);
  }
  return Math.max(dx, dy);
}

function dentroDoTabuleiro(board: Board, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < board.width && y < board.height;
}

/**
 * Linha de visão direta entre duas células (Bresenham).
 * - Os obstáculos intermédios bloqueiam a visão.
 * - O quadrado de destino é sempre considerado alcançável pela linha: assim uma
 *   parede adjacente à unidade aparece (vê-se a parede), mas não se vê através
 *   dela para os quadrados seguintes.
 */
export function linhaDeVisaoLivre(
  board: Board,
  origem: GridPoint,
  destino: GridPoint
): boolean {
  let x = origem.x;
  let y = origem.y;
  const x1 = destino.x;
  const y1 = destino.y;
  if (x === x1 && y === y1) return true;
  if (!dentroDoTabuleiro(board, x1, y1)) return false;

  const dx = Math.abs(x1 - x);
  const dy = Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx - dy;

  while (!(x === x1 && y === y1)) {
    const e2 = 2 * err;
    const prevX = x;
    const prevY = y;
    let movedX = false;
    let movedY = false;

    if (e2 > -dy) {
      err -= dy;
      x += sx;
      movedX = true;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
      movedY = true;
    }

    if (x === x1 && y === y1) break; // destino: não bloqueia a própria visão

    // Regra conservadora: diagonal entre dois obstáculos adjacentes bloqueia
    if (movedX && movedY) {
      const ortogonalA = getTerrainAt(board, x, prevY) === 'impassable';
      const ortogonalB = getTerrainAt(board, prevX, y) === 'impassable';
      if (ortogonalA && ortogonalB) return false;
    }

    if (getTerrainAt(board, x, y) === 'impassable') return false;
  }

  return true;
}

export interface VisionResult {
  /** Conjunto de chaves `x,y` visíveis */
  visible: Set<string>;
  /** Alcance efetivamente usado (global ou individual) */
  range: number;
  /** Células de origem usadas como referência (footprint da unidade) */
  sourceCells: GridPoint[];
  /** Chaves `x,y` na orla da visão (para suavizar o desenho da névoa) */
  edge: Set<string>;
}

/** Alcance efetivo da unidade: individual (se ativo e definido) ou global. */
export function alcanceVisaoDaUnidade(
  unidade: Character | null | undefined,
  rangeMode: FogRangeMode,
  globalRange: number
): number {
  if (unidade && rangeMode === 'individual') {
    const individual = unidade.visionRange;
    if (typeof individual === 'number' && Number.isFinite(individual)) {
      return Math.max(FOG_MIN_RANGE, Math.min(FOG_MAX_RANGE, Math.round(individual)));
    }
  }
  return Math.max(FOG_MIN_RANGE, Math.min(FOG_MAX_RANGE, Math.round(globalRange)));
}

/**
 * Calcula a área visível a partir de uma unidade.
 * Unidades maiores que 1×1 projetam visão a partir de todos os seus quadrados.
 */
export function calcularVisaoDaUnidade(
  board: Board,
  unidade: Character,
  range: number,
  diagonalRule: DiagonalRule = 'chebyshev'
): VisionResult {
  const visible = new Set<string>();
  const sourceCells: GridPoint[] = unidade.position
    ? getOccupiedCells(unidade.position, unidade.width, unidade.height)
    : [];

  const raio = Math.max(FOG_MIN_RANGE, Math.min(FOG_MAX_RANGE, Math.round(range)));

  // O corpo da própria unidade é sempre visível
  for (const c of sourceCells) {
    if (dentroDoTabuleiro(board, c.x, c.y)) visible.add(cellKey(c.x, c.y));
  }

  if (sourceCells.length === 0) {
    return { visible, range: raio, sourceCells, edge: new Set() };
  }

  const minX = Math.max(0, Math.min(...sourceCells.map((c) => c.x)) - raio);
  const maxX = Math.min(board.width - 1, Math.max(...sourceCells.map((c) => c.x)) + raio);
  const minY = Math.max(0, Math.min(...sourceCells.map((c) => c.y)) - raio);
  const maxY = Math.min(board.height - 1, Math.max(...sourceCells.map((c) => c.y)) + raio);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const alvo: GridPoint = { x, y };
      const k = cellKey(x, y);
      if (visible.has(k)) continue;

      let dentroDoAlcance = false;
      for (const origem of sourceCells) {
        if (distanciaGrid(origem, alvo, diagonalRule) <= raio) {
          dentroDoAlcance = true;
          break;
        }
      }
      if (!dentroDoAlcance) continue;

      for (const origem of sourceCells) {
        if (linhaDeVisaoLivre(board, origem, alvo)) {
          visible.add(k);
          break;
        }
      }
    }
  }

  // Orla: quadrados não visíveis que tocam um visível (usada para o degradê)
  const edge = new Set<string>();
  for (const k of visible) {
    const [xs, ys] = k.split(',');
    const x = Number(xs);
    const y = Number(ys);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (!dentroDoTabuleiro(board, nx, ny)) continue;
        const nk = cellKey(nx, ny);
        if (!visible.has(nk)) edge.add(nk);
      }
    }
  }

  return { visible, range: raio, sourceCells, edge };
}

/** Indica se a névoa está ativa nas configurações atuais. */
export function nevoaAtiva(settings: {
  fogMode?: 'day' | 'exploration';
}): boolean {
  return settings.fogMode === 'exploration';
}
