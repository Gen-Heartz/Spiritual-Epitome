import {
  Board,
  Character,
  DiagonalRule,
  ReachableCell,
} from '../types';
import {
  canPlaceCharacter,
  cellKey,
  getOccupiedCells,
  getTerrainAt,
  GridPoint,
} from './geometry';

const NEIGHBOR_DELTAS: Array<{ dx: number; dy: number; isDiagonal: boolean }> = [
  { dx: 0, dy: -1, isDiagonal: false },
  { dx: 1, dy: 0, isDiagonal: false },
  { dx: 0, dy: 1, isDiagonal: false },
  { dx: -1, dy: 0, isDiagonal: false },
  { dx: 1, dy: -1, isDiagonal: true },
  { dx: 1, dy: 1, isDiagonal: true },
  { dx: -1, dy: 1, isDiagonal: true },
  { dx: -1, dy: -1, isDiagonal: true },
];

interface SearchNode {
  x: number;
  y: number;
  cost: number;
  diagCount: number;
  path: GridPoint[];
}

/**
 * Calcula todos os quadrados alcançáveis por um personagem usando busca em largura
 * ponderada por custo (Dijkstra/BFS com custo de terreno), respeitando:
 * - Obstáculos impassáveis (bloqueiam passagem, inclusive aperto diagonal duplo)
 * - Terreno difícil (custa 2 unidades de movimento)
 * - Outros personagens (não podem ser atravessados)
 * - Criaturas grandes (verifica toda a área width × height em cada passo)
 * - Regra diagonal: 1 quadrado (Chebyshev) ou Alternada 1-2-1-2
 */
export function calculateReachableCells(
  board: Board,
  characters: Record<string, Character>,
  character: Character,
  diagonalRule: DiagonalRule = 'chebyshev'
): Map<string, ReachableCell> {
  const result = new Map<string, ReachableCell>();
  if (!character.position || character.movement <= 0) {
    return result;
  }

  const maxMove = character.movement;
  const start = character.position;

  // Pré-calcula quadrados ocupados por outros personagens para checagem O(1)
  const occupiedByOthers = new Set<string>();
  for (const other of Object.values(characters)) {
    if (!other.position || other.id === character.id) continue;
    for (const c of getOccupiedCells(other.position, other.width, other.height)) {
      occupiedByOthers.add(cellKey(c.x, c.y));
    }
  }

  const isFootprintValid = (px: number, py: number): boolean => {
    if (
      px < 0 ||
      py < 0 ||
      px + character.width > board.width ||
      py + character.height > board.height
    ) {
      return false;
    }
    for (let i = 0; i < character.width; i++) {
      for (let j = 0; j < character.height; j++) {
        const cx = px + i;
        const cy = py + j;
        if (getTerrainAt(board, cx, cy) === 'impassable') return false;
        if (occupiedByOthers.has(cellKey(cx, cy))) return false;
      }
    }
    return true;
  };

  const getFootprintTerrainPenalty = (px: number, py: number): number => {
    for (let i = 0; i < character.width; i++) {
      for (let j = 0; j < character.height; j++) {
        if (getTerrainAt(board, px + i, py + j) === 'difficult') {
          return 1; // +1 além do custo base 1 => total 2 em passo normal
        }
      }
    }
    return 0;
  };

  // No modo alternado 1-2-1-2, a paridade de diagonais importa para transições futuras
  const bestState = new Map<string, number>();
  const queue: SearchNode[] = [
    {
      x: start.x,
      y: start.y,
      cost: 0,
      diagCount: 0,
      path: [{ x: start.x, y: start.y }],
    },
  ];
  bestState.set(`${start.x},${start.y},0`, 0);

  while (queue.length > 0) {
    // Extrai nó de menor custo
    let bestIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].cost < queue[bestIdx].cost) {
        bestIdx = i;
      }
    }
    const current = queue.splice(bestIdx, 1)[0];

    for (const delta of NEIGHBOR_DELTAS) {
      const nx = current.x + delta.dx;
      const ny = current.y + delta.dy;

      if (!isFootprintValid(nx, ny)) continue;

      // Em movimento diagonal, impede atravessar quina fechada por dois obstáculos adjacentes
      if (delta.isDiagonal) {
        const orthoAValid = isFootprintValid(nx, current.y);
        const orthoBValid = isFootprintValid(current.x, ny);
        if (!orthoAValid && !orthoBValid) {
          continue;
        }
      }

      const nextDiagCount = delta.isDiagonal ? current.diagCount + 1 : current.diagCount;
      let baseStepCost = 1;
      if (delta.isDiagonal && diagonalRule === 'alternating') {
        baseStepCost = nextDiagCount % 2 === 0 ? 2 : 1;
      }

      const terrainExtra = getFootprintTerrainPenalty(nx, ny);
      const nextCost = current.cost + baseStepCost + terrainExtra;

      if (nextCost > maxMove) continue;

      const parity = diagonalRule === 'alternating' ? nextDiagCount % 2 : 0;
      const stateKey = `${nx},${ny},${parity}`;
      const prevBestForState = bestState.get(stateKey);
      if (prevBestForState !== undefined && prevBestForState <= nextCost) {
        continue;
      }
      bestState.set(stateKey, nextCost);

      const nextPath = [...current.path, { x: nx, y: ny }];
      const cellId = cellKey(nx, ny);
      if (!(nx === start.x && ny === start.y)) {
        const existing = result.get(cellId);
        if (!existing || nextCost < existing.cost) {
          result.set(cellId, {
            x: nx,
            y: ny,
            cost: nextCost,
            path: nextPath,
          });
        }
      }

      queue.push({
        x: nx,
        y: ny,
        cost: nextCost,
        diagCount: nextDiagCount,
        path: nextPath,
      });
    }
  }

  // Validação de segurança final com canPlaceCharacter
  for (const [k, cell] of result.entries()) {
    if (
      !canPlaceCharacter(
        board,
        characters,
        { x: cell.x, y: cell.y },
        character.width,
        character.height,
        character.id
      )
    ) {
      result.delete(k);
    }
  }

  return result;
}
