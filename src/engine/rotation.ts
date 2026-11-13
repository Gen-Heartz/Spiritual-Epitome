import {
  AreaCell,
  AttackArea,
  Board,
  Direction,
  ImpactZone,
  ProjectedAreaCell,
} from '../types';
import { cellKey, GridPoint, isWithinBoard } from './geometry';

export const ZONE_SEVERITY: Record<ImpactZone, number> = {
  red: 3,
  orange: 2,
  yellow: 1,
};

export function pickHigherSeverityZone(a: ImpactZone, b: ImpactZone): ImpactZone {
  return ZONE_SEVERITY[a] >= ZONE_SEVERITY[b] ? a : b;
}

/**
 * Rotaciona um único deslocamento (dx, dy) pela direção especificada (Parte 12.2 Etapa A):
 * dx' = round(dx · cos θ − dy · sin θ)
 * dy' = round(dx · sin θ + dy · cos θ)
 */
export function rotateOffset(
  dx: number,
  dy: number,
  direction: Direction
): { dx: number; dy: number } {
  const theta = direction * (Math.PI / 4);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  // `|| 0` normaliza -0 para 0
  const rx = Math.round(dx * cos - dy * sin) || 0;
  const ry = Math.round(dx * sin + dy * cos) || 0;
  return { dx: rx, dy: ry };
}

/**
 * Parte 12.2 — Rotaciona todas as células de uma área de ataque para uma das 8 direções
 * e aplica deduplicação (Etapa B) mantendo a zona de maior severidade: vermelho > laranja > amarelo.
 */
export function rotateAreaCells(
  cells: AreaCell[],
  direction: Direction
): AreaCell[] {
  const deduped = new Map<string, AreaCell>();

  for (const cell of cells) {
    const { dx, dy } = rotateOffset(cell.dx, cell.dy, direction);
    const key = cellKey(dx, dy);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, { dx, dy, zone: cell.zone });
    } else {
      deduped.set(key, {
        dx,
        dy,
        zone: pickHigherSeverityZone(existing.zone, cell.zone),
      });
    }
  }

  return Array.from(deduped.values());
}

/**
 * Projeta uma área de ataque no tabuleiro a partir de `targetOrigin`, rotacionada em `direction`,
 * aplicando também ajustes manuais opcionais do mestre (Etapa C).
 */
export function projectAttackOnBoard(
  area: AttackArea,
  targetOrigin: GridPoint,
  direction: Direction,
  board: Board,
  manualOverrides?: Record<string, ImpactZone | 'remove'>
): ProjectedAreaCell[] {
  const rotatedCells = rotateAreaCells(area.cells, direction);
  const cellMap = new Map<string, ProjectedAreaCell>();

  for (const cell of rotatedCells) {
    const x = targetOrigin.x + cell.dx;
    const y = targetOrigin.y + cell.dy;
    if (!isWithinBoard(board, x, y)) continue;
    const key = cellKey(x, y);
    cellMap.set(key, { x, y, zone: cell.zone });
  }

  if (manualOverrides) {
    for (const [key, override] of Object.entries(manualOverrides)) {
      if (override === 'remove') {
        cellMap.delete(key);
      } else {
        const [xs, ys] = key.split(',');
        const x = Number(xs);
        const y = Number(ys);
        if (isWithinBoard(board, x, y)) {
          cellMap.set(key, { x, y, zone: override });
        }
      }
    }
  }

  return Array.from(cellMap.values());
}

// === Geradores geométricos para o Editor Visual de Ataques (Parte 10.6) ===

export function generateLineCells(
  from: GridPoint,
  to: GridPoint,
  zone: ImpactZone,
  includeStart = false
): AreaCell[] {
  const cells: AreaCell[] = [];
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - x);
  const dy = Math.abs(to.y - y);
  const sx = x < to.x ? 1 : -1;
  const sy = y < to.y ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (includeStart || !(x === from.x && y === from.y)) {
      cells.push({ dx: x, dy: y, zone });
    }
    if (x === to.x && y === to.y) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return cells;
}

/**
 * Gera um cone apontando para Norte (base padrão do editor, dy negativo) ou para o cursor `target`.
 */
export function generateConeCells(
  origin: GridPoint,
  target: GridPoint,
  zone: ImpactZone
): AreaCell[] {
  const vx = target.x - origin.x;
  const vy = target.y - origin.y;
  const length = Math.round(Math.hypot(vx, vy));
  if (length === 0) return [];

  const angle = Math.atan2(vy, vx);
  const halfSpread = Math.PI / 6; // cone de 60 graus
  const cells: AreaCell[] = [];

  for (let y = origin.y - length; y <= origin.y + length; y++) {
    for (let x = origin.x - length; x <= origin.x + length; x++) {
      if (x === origin.x && y === origin.y) continue;
      const dx = x - origin.x;
      const dy = y - origin.y;
      const dist = Math.hypot(dx, dy);
      if (dist > length + 0.35) continue;
      let diff = Math.atan2(dy, dx) - angle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      if (Math.abs(diff) <= halfSpread + 0.08) {
        cells.push({ dx: x, dy: y, zone });
      }
    }
  }

  return cells;
}

export function generateCrossCells(
  center: GridPoint,
  armLength: number,
  zone: ImpactZone,
  includeCenter = true
): AreaCell[] {
  const cells: AreaCell[] = [];
  if (includeCenter) {
    cells.push({ dx: center.x, dy: center.y, zone });
  }
  for (let i = 1; i <= armLength; i++) {
    cells.push({ dx: center.x, dy: center.y - i, zone });
    cells.push({ dx: center.x + i, dy: center.y, zone });
    cells.push({ dx: center.x, dy: center.y + i, zone });
    cells.push({ dx: center.x - i, dy: center.y, zone });
  }
  return cells;
}

export function generateRectangleCells(
  a: GridPoint,
  b: GridPoint,
  zone: ImpactZone
): AreaCell[] {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const cells: AreaCell[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      cells.push({ dx: x, dy: y, zone });
    }
  }
  return cells;
}

export function generateCircleCells(
  center: GridPoint,
  radius: number,
  zone: ImpactZone
): AreaCell[] {
  const cells: AreaCell[] = [];
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      const dist = Math.hypot(x - center.x, y - center.y);
      if (dist <= radius + 0.35) {
        cells.push({ dx: x, dy: y, zone });
      }
    }
  }
  return cells;
}
