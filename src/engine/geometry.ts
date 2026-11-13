import { Board, Character, Direction, TerrainType } from '../types';

export interface GridPoint {
  x: number;
  y: number;
}

export const DIRECTION_LABELS: Record<Direction, string> = {
  [Direction.North]: 'Norte (N)',
  [Direction.NorthEast]: 'Nordeste (NE)',
  [Direction.East]: 'Leste (L)',
  [Direction.SouthEast]: 'Sudeste (SE)',
  [Direction.South]: 'Sul (S)',
  [Direction.SouthWest]: 'Sudoeste (SO)',
  [Direction.West]: 'Oeste (O)',
  [Direction.NorthWest]: 'Noroeste (NO)',
};

export const DIRECTION_SHORT: Record<Direction, string> = {
  [Direction.North]: 'N',
  [Direction.NorthEast]: 'NE',
  [Direction.East]: 'L',
  [Direction.SouthEast]: 'SE',
  [Direction.South]: 'S',
  [Direction.SouthWest]: 'SO',
  [Direction.West]: 'O',
  [Direction.NorthWest]: 'NO',
};

export const DIRECTION_VECTORS: Record<Direction, { dx: number; dy: number }> = {
  [Direction.North]: { dx: 0, dy: -1 },
  [Direction.NorthEast]: { dx: 1, dy: -1 },
  [Direction.East]: { dx: 1, dy: 0 },
  [Direction.SouthEast]: { dx: 1, dy: 1 },
  [Direction.South]: { dx: 0, dy: 1 },
  [Direction.SouthWest]: { dx: -1, dy: 1 },
  [Direction.West]: { dx: -1, dy: 0 },
  [Direction.NorthWest]: { dx: -1, dy: -1 },
};

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseCellKey(key: string): GridPoint {
  const [xs, ys] = key.split(',');
  return { x: Number(xs), y: Number(ys) };
}

export function getTerrainAt(board: Board, x: number, y: number): TerrainType {
  return board.terrain[cellKey(x, y)] ?? 'normal';
}

export function isWithinBoard(board: Board, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < board.width && y < board.height;
}

export function isAreaWithinBoard(
  board: Board,
  pos: GridPoint,
  width: number,
  height: number
): boolean {
  return (
    pos.x >= 0 &&
    pos.y >= 0 &&
    pos.x + width <= board.width &&
    pos.y + height <= board.height
  );
}

/**
 * Retorna todos os quadrados ocupados por uma criatura de dimensões width × height
 * cuja posição (canto superior-esquerdo) é `pos`.
 */
export function getOccupiedCells(
  pos: GridPoint,
  width: number,
  height: number
): GridPoint[] {
  const cells: GridPoint[] = [];
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      cells.push({ x: pos.x + i, y: pos.y + j });
    }
  }
  return cells;
}

/**
 * Centro geométrico visual = (x + width/2, y + height/2)
 */
export function getVisualCenter(
  pos: GridPoint,
  width: number,
  height: number
): { cx: number; cy: number } {
  return {
    cx: pos.x + width / 2,
    cy: pos.y + height / 2,
  };
}

/**
 * Ponto de ancoragem frontal/direcional de uma criatura para ataques originados nela.
 * Para 1×1 retorna exatamente `pos`. Para criaturas maiores retorna a borda na direção `facing`.
 */
export function getDirectionalAnchorCell(
  pos: GridPoint,
  width: number,
  height: number,
  facing: Direction
): GridPoint {
  const vec = DIRECTION_VECTORS[facing];
  const ax =
    vec.dx < 0
      ? pos.x
      : vec.dx > 0
      ? pos.x + width - 1
      : pos.x + Math.floor((width - 1) / 2);
  const ay =
    vec.dy < 0
      ? pos.y
      : vec.dy > 0
      ? pos.y + height - 1
      : pos.y + Math.floor((height - 1) / 2);
  return { x: ax, y: ay };
}

/**
 * Verifica se uma criatura pode ocupar `candidatePos` sem sair do tabuleiro,
 * sem sobrepor terreno impassável e sem sobrepor outros personagens.
 */
export function canPlaceCharacter(
  board: Board,
  characters: Record<string, Character>,
  candidatePos: GridPoint,
  width: number,
  height: number,
  ignoreCharacterId?: string
): boolean {
  if (!isAreaWithinBoard(board, candidatePos, width, height)) {
    return false;
  }

  const candidateCells = getOccupiedCells(candidatePos, width, height);

  // Verifica terrenos impassáveis
  for (const cell of candidateCells) {
    if (getTerrainAt(board, cell.x, cell.y) === 'impassable') {
      return false;
    }
  }

  // Constrói conjunto de quadrados ocupados por outros personagens
  const occupiedByOthers = new Set<string>();
  for (const char of Object.values(characters)) {
    if (!char.position || char.id === ignoreCharacterId) continue;
    for (const c of getOccupiedCells(char.position, char.width, char.height)) {
      occupiedByOthers.add(cellKey(c.x, c.y));
    }
  }

  for (const cell of candidateCells) {
    if (occupiedByOthers.has(cellKey(cell.x, cell.y))) {
      return false;
    }
  }

  return true;
}

/**
 * Encontra o personagem posicionado no quadrado (x, y), se existir.
 */
export function getCharacterAtCell(
  characters: Record<string, Character>,
  x: number,
  y: number
): Character | null {
  for (const char of Object.values(characters)) {
    if (!char.position) continue;
    if (
      x >= char.position.x &&
      x < char.position.x + char.width &&
      y >= char.position.y &&
      y < char.position.y + char.height
    ) {
      return char;
    }
  }
  return null;
}

/**
 * Converte ângulo em radianos (referência de tela: X p/ direita, Y p/ baixo)
 * para a direção mais próxima entre as 8 direções.
 * Norte (0) corresponde ao vetor (0, -1), isto é, atan2(-1, 0) = -PI/2.
 */
export function vectorToDirection(dx: number, dy: number): Direction {
  if (dx === 0 && dy === 0) return Direction.North;
  // Ângulo a partir do Norte (0, -1) no sentido horário: atan2(dx, -dy)
  const angle = Math.atan2(dx, -dy); // [-PI, PI], 0 = Norte, PI/2 = Leste
  const normalized = ((angle + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 4);
  const index = Math.round(normalized) % 8;
  return index as Direction;
}

/**
 * Retorna ângulo em radianos no Canvas (0 = Leste, -PI/2 = Norte) para desenhar setas.
 */
export function directionToCanvasAngle(direction: Direction): number {
  return direction * (Math.PI / 4) - Math.PI / 2;
}

/**
 * Distância em quadrados entre dois pontos de acordo com a regra diagonal.
 */
export function gridDistance(
  a: GridPoint,
  b: GridPoint,
  diagonalRule: 'chebyshev' | 'alternating' = 'chebyshev'
): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if (diagonalRule === 'chebyshev') {
    return Math.max(dx, dy);
  }
  const diag = Math.min(dx, dy);
  const straight = Math.max(dx, dy) - diag;
  // 1-2-1-2: cada par de diagonais custa 3, diagonal ímpar extra custa 1
  return straight + diag + Math.floor(diag / 2);
}

/**
 * Menor distância de qualquer quadrado ocupado pela criatura até um ponto alvo.
 */
export function minDistanceFromCharacterToPoint(
  char: Character,
  target: GridPoint,
  diagonalRule: 'chebyshev' | 'alternating' = 'chebyshev'
): number {
  if (!char.position) return Infinity;
  const cells = getOccupiedCells(char.position, char.width, char.height);
  let min = Infinity;
  for (const c of cells) {
    const d = gridDistance(c, target, diagonalRule);
    if (d < min) min = d;
  }
  return min;
}
