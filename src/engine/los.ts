import { Board, Character } from '../types';
import { getOccupiedCells, getTerrainAt, GridPoint } from './geometry';

function isImpassable(board: Board, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= board.width || y >= board.height) {
    return true;
  }
  return getTerrainAt(board, x, y) === 'impassable';
}

/**
 * Traça linha entre centros de quadrados (x0, y0) -> (x1, y1) com o algoritmo de Bresenham
 * e verifica Linha de Visão (LoS) segundo a Parte 8:
 * - Terrenos impassáveis bloqueiam LoS.
 * - Terrenos difíceis não bloqueiam LoS.
 * - Quando a linha atravessar dois obstáculos adjacentes em diagonal, é considerada bloqueada
 *   (regra conservadora).
 */
export function hasCellLoS(
  board: Board,
  origin: GridPoint,
  target: GridPoint
): boolean {
  let x = origin.x;
  let y = origin.y;
  const x1 = target.x;
  const y1 = target.y;

  if (x === x1 && y === y1) return true;

  // Se o próprio quadrado de destino é um obstáculo impassável, bloqueia visão através/nele
  if (isImpassable(board, x1, y1)) {
    return false;
  }

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

    // Regra conservadora: passo diagonal entre dois obstáculos adjacentes
    if (movedX && movedY) {
      if (isImpassable(board, x, prevY) && isImpassable(board, prevX, y)) {
        return false;
      }
    }

    // Se chegou ao destino, já validamos acima que destino não é impassável
    if (x === x1 && y === y1) {
      return true;
    }

    if (isImpassable(board, x, y)) {
      return false;
    }
  }

  return true;
}

/**
 * Retorna os pontos da linha de Bresenham para visualização (ex: ferramenta Régua / LoS),
 * além de indicar se e onde houve bloqueio.
 */
export function traceBresenhamLine(
  board: Board,
  origin: GridPoint,
  target: GridPoint
): { cells: GridPoint[]; clear: boolean; blockedAt: GridPoint | null } {
  const cells: GridPoint[] = [{ x: origin.x, y: origin.y }];
  let x = origin.x;
  let y = origin.y;
  const x1 = target.x;
  const y1 = target.y;

  if (x === x1 && y === y1) {
    return { cells, clear: true, blockedAt: null };
  }

  const dx = Math.abs(x1 - x);
  const dy = Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx - dy;
  let blockedAt: GridPoint | null = null;

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

    if (movedX && movedY && blockedAt === null) {
      if (isImpassable(board, x, prevY) && isImpassable(board, prevX, y)) {
        blockedAt = { x, y };
      }
    }

    cells.push({ x, y });

    if (blockedAt === null && isImpassable(board, x, y)) {
      blockedAt = { x, y };
    }
  }

  return {
    cells,
    clear: blockedAt === null,
    blockedAt,
  };
}

/**
 * Parte 8.3 — Criaturas grandes (qualquer-para-qualquer com early exit):
 * A criatura A tem LoS para a criatura B se existir pelo menos um par de quadrados
 * (qa ∈ A, qb ∈ B) cuja linha de centro a centro não seja bloqueada por terreno impassável.
 */
export function hasCreatureLoS(
  board: Board,
  source: Character,
  target: Character
): boolean {
  if (!source.position || !target.position) return false;
  const sourceCells = getOccupiedCells(source.position, source.width, source.height);
  const targetCells = getOccupiedCells(target.position, target.width, target.height);

  for (const qa of sourceCells) {
    for (const qb of targetCells) {
      if (hasCellLoS(board, qa, qb)) {
        return true; // Early exit
      }
    }
  }

  return false;
}

/**
 * Verifica se uma criatura tem LoS para um quadrado específico (ex: ponto de origem de uma área de ataque).
 * Usa early exit sobre os quadrados ocupados pela criatura atacante.
 */
export function hasCreatureToCellLoS(
  board: Board,
  source: Character,
  targetCell: GridPoint
): boolean {
  if (!source.position) return false;
  const sourceCells = getOccupiedCells(source.position, source.width, source.height);
  for (const qa of sourceCells) {
    if (hasCellLoS(board, qa, targetCell)) {
      return true;
    }
  }
  return false;
}
