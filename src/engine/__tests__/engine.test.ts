import { describe, expect, it } from 'vitest';
import {
  AppState,
  AreaCell,
  Attack,
  Board,
  Character,
  Direction,
  Weapon,
} from '../../types';
import {
  canPlaceCharacter,
  getDirectionalAnchorCell,
  getOccupiedCells,
  getVisualCenter,
  vectorToDirection,
} from '../geometry';
import { calculateReachableCells } from '../movement';
import { hasCellLoS, hasCreatureLoS } from '../los';
import { rotateAreaCells, rotateOffset } from '../rotation';
import { calculateAttackDamage, detectAttackImpacts } from '../combat';
import { executeCommand, redoCommand, undoCommand } from '../history';

function createBoard(
  width = 10,
  height = 10,
  terrain: Board['terrain'] = {}
): Board {
  return { id: 'b1', width, height, terrain };
}

function createChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'c1',
    name: 'Guerreiro',
    imageId: '',
    hpMax: 100,
    hpCurrent: 100,
    movement: 4,
    baseDamage: 5,
    weaponIds: [],
    position: { x: 4, y: 4 },
    facing: Direction.North,
    width: 1,
    height: 1,
    ...overrides,
  };
}

describe('Geometria e Criaturas Grandes', () => {
  it('calcula quadrados ocupados e centro visual para 3x3', () => {
    const cells = getOccupiedCells({ x: 2, y: 3 }, 3, 3);
    expect(cells).toHaveLength(9);
    expect(cells[0]).toEqual({ x: 2, y: 3 });
    expect(cells[8]).toEqual({ x: 4, y: 5 });

    const center = getVisualCenter({ x: 2, y: 3 }, 3, 3);
    expect(center).toEqual({ cx: 3.5, cy: 4.5 });
  });

  it('impede posicionamento sobre obstáculos impassáveis ou outros personagens', () => {
    const board = createBoard(10, 10, { '3,3': 'impassable' });
    const other = createChar({ id: 'c2', position: { x: 6, y: 6 }, width: 2, height: 2 });
    const chars = { c2: other };

    expect(canPlaceCharacter(board, chars, { x: 2, y: 2 }, 2, 2)).toBe(false);
    expect(canPlaceCharacter(board, chars, { x: 5, y: 5 }, 2, 2)).toBe(false);
    expect(canPlaceCharacter(board, chars, { x: 0, y: 0 }, 2, 2)).toBe(true);
  });

  it('mapeia vetores para as 8 direções corretamente', () => {
    expect(vectorToDirection(0, -10)).toBe(Direction.North);
    expect(vectorToDirection(10, -10)).toBe(Direction.NorthEast);
    expect(vectorToDirection(10, 0)).toBe(Direction.East);
    expect(vectorToDirection(10, 10)).toBe(Direction.SouthEast);
    expect(vectorToDirection(0, 10)).toBe(Direction.South);
    expect(vectorToDirection(-10, 10)).toBe(Direction.SouthWest);
    expect(vectorToDirection(-10, 0)).toBe(Direction.West);
    expect(vectorToDirection(-10, -10)).toBe(Direction.NorthWest);
  });

  it('calcula âncora direcional correta para criatura 3x3', () => {
    expect(getDirectionalAnchorCell({ x: 10, y: 6 }, 3, 3, Direction.North)).toEqual({
      x: 11,
      y: 6,
    });
    expect(getDirectionalAnchorCell({ x: 10, y: 6 }, 3, 3, Direction.West)).toEqual({
      x: 10,
      y: 7,
    });
  });
});

describe('Movimentação BFS com Terrenos e Diagonais', () => {
  it('respeita custo 2 para terreno difícil e bloqueio em impassável', () => {
    const board = createBoard(10, 10, {
      '4,3': 'difficult',
      '5,4': 'impassable',
    });
    const char = createChar({ movement: 2, position: { x: 4, y: 4 } });
    const reachable = calculateReachableCells(board, { c1: char }, char, 'chebyshev');

    // (4,3) é difícil => custo 2, então (4,2) precisaria de 3 em linha reta, mas por diagonal via (3,3) custa 2!
    expect(reachable.get('4,3')?.cost).toBe(2);
    expect(reachable.has('5,4')).toBe(false);
  });

  it('diferencia diagonal Chebyshev (1) vs Alternada (1-2-1-2)', () => {
    const board = createBoard(10, 10);
    const char = createChar({ movement: 3, position: { x: 5, y: 5 } });

    const cheb = calculateReachableCells(board, { c1: char }, char, 'chebyshev');
    const alt = calculateReachableCells(board, { c1: char }, char, 'alternating');

    // 2 passos diagonais até (7,7): Chebyshev = 2, Alternada = 1 + 2 = 3
    expect(cheb.get('7,7')?.cost).toBe(2);
    expect(alt.get('7,7')?.cost).toBe(3);
    // 3 passos diagonais até (8,8): Chebyshev = 3, Alternada = 1 + 2 + 1 = 4 (>3, fora do alcance!)
    expect(cheb.has('8,8')).toBe(true);
    expect(alt.has('8,8')).toBe(false);
  });

  it('valida toda a área width x height para criaturas grandes', () => {
    // Passagem estreita de 1 quadrado em (1,2): toda o resto da linha y=2 é parede impassável
    const board = createBoard(6, 6, {
      '0,2': 'impassable',
      '2,2': 'impassable',
      '3,2': 'impassable',
      '4,2': 'impassable',
      '5,2': 'impassable',
    });
    const small = createChar({
      id: 's1',
      width: 1,
      height: 1,
      movement: 5,
      position: { x: 1, y: 3 },
    });
    const giant = createChar({
      id: 'g1',
      width: 2,
      height: 2,
      movement: 5,
      position: { x: 1, y: 3 },
    });
    const smallReach = calculateReachableCells(board, { s1: small }, small, 'chebyshev');
    const giantReach = calculateReachableCells(board, { g1: giant }, giant, 'chebyshev');

    // Criatura 1x1 passa pela fresta (1,2) e chega em (1,0), mas criatura 2x2 é bloqueada
    expect(smallReach.has('1,0')).toBe(true);
    expect(giantReach.has('1,0')).toBe(false);
  });
});

describe('Linha de Visão (Bresenham Conservadora e Criaturas Grandes)', () => {
  it('bloqueia em terreno impassável, mas permite terreno difícil', () => {
    const board = createBoard(10, 10, {
      '3,1': 'impassable',
      '3,4': 'difficult',
    });

    expect(hasCellLoS(board, { x: 1, y: 1 }, { x: 5, y: 1 })).toBe(false);
    expect(hasCellLoS(board, { x: 1, y: 4 }, { x: 5, y: 4 })).toBe(true);
  });

  it('bloqueia quando a linha atravessa dois obstáculos adjacentes em diagonal', () => {
    const board = createBoard(10, 10, {
      '2,1': 'impassable',
      '1,2': 'impassable',
    });
    expect(hasCellLoS(board, { x: 1, y: 1 }, { x: 3, y: 3 })).toBe(false);
  });

  it('aplica regra generosa qualquer-para-qualquer para criaturas grandes', () => {
    // Pilar em (2,2) bloqueia o alvo 1x1 em (4,2), mas o dragão 3x3 em (4,2)..(6,4) tem quadrados visíveis em y=4
    const board = createBoard(10, 10, {
      '2,2': 'impassable',
    });
    const archer = createChar({ id: 'a', position: { x: 0, y: 2 }, width: 1, height: 1 });
    const goblin = createChar({ id: 'g', position: { x: 4, y: 2 }, width: 1, height: 1 });
    const dragon = createChar({ id: 'd', position: { x: 4, y: 2 }, width: 3, height: 3 });

    expect(hasCreatureLoS(board, archer, goblin)).toBe(false);
    expect(hasCreatureLoS(board, archer, dragon)).toBe(true);
  });
});

describe('Rotação em 8 Direções e Deduplicação por Severidade', () => {
  it('rotaciona corretamente nas direções cardeais e diagonais', () => {
    expect(rotateOffset(0, -2, Direction.North)).toEqual({ dx: 0, dy: -2 });
    expect(rotateOffset(0, -2, Direction.East)).toEqual({ dx: 2, dy: 0 });
    expect(rotateOffset(0, -2, Direction.South)).toEqual({ dx: 0, dy: 2 });
    expect(rotateOffset(0, -2, Direction.West)).toEqual({ dx: -2, dy: 0 });
    expect(rotateOffset(0, -1, Direction.NorthEast)).toEqual({ dx: 1, dy: -1 });
  });

  it('deduplica células colidentes preservando a maior severidade (red > orange > yellow)', () => {
    // Em 45 graus (NE):
    // (0, -1) -> round(0.707)=1, round(-0.707)=-1 => (1, -1)
    // (1, -2) -> round(3*0.707)=2, round(-1*0.707)=-1
    // (1, -1) -> round(2*0.707)=1, round(0)=0
    // E se duas células mapearem para o mesmo quadrado, ex: (0, -2) -> (1, -1) e (0, -1) -> (1, -1)!
    const cells: AreaCell[] = [
      { dx: 0, dy: -1, zone: 'yellow' },
      { dx: 0, dy: -2, zone: 'red' },
    ];
    const rotated = rotateAreaCells(cells, Direction.NorthEast);
    expect(rotated).toHaveLength(1);
    expect(rotated[0]).toEqual({ dx: 1, dy: -1, zone: 'red' });
  });
});

describe('Resolução de Impacto e Criaturas Grandes', () => {
  it('aplica dano único e maior severidade para criatura 3x3 atingida em múltiplos quadrados', () => {
    const board = createBoard(15, 15);
    const attacker = createChar({ id: 'att', position: { x: 5, y: 10 }, baseDamage: 4 });
    const dragon = createChar({
      id: 'drag',
      name: 'Dragão',
      position: { x: 4, y: 5 },
      width: 3,
      height: 3,
    });
    const weapon: Weapon = {
      id: 'w1',
      name: 'Cajado',
      iconId: '',
      category: 'Cajado',
      range: 8,
      baseDamage: 3,
      attackIds: ['atk1'],
    };
    const attack: Attack = {
      id: 'atk1',
      name: 'Chama',
      description: '',
      range: 8,
      damage: 12,
      impactType: 'Fogo',
      effects: [],
      area: {
        origin: { x: 0, y: 0 },
        cells: [],
      },
    };

    expect(calculateAttackDamage(attack, weapon, attacker, 'attack_only')).toBe(12);
    expect(calculateAttackDamage(attack, weapon, attacker, 'sum_all')).toBe(19);

    const { impacts } = detectAttackImpacts({
      board,
      projectedCells: [
        { x: 4, y: 7, zone: 'yellow' },
        { x: 5, y: 7, zone: 'orange' },
      ],
      characters: { att: attacker, drag: dragon },
      attacker,
      weapon,
      attack,
      damageRule: 'attack_only',
      targetOrigin: { x: 5, y: 7 },
    });

    expect(impacts).toHaveLength(1);
    expect(impacts[0].characterId).toBe('drag');
    expect(impacts[0].hitSquares).toBe(2);
    expect(impacts[0].totalSquares).toBe(9);
    expect(impacts[0].zone).toBe('orange');
    expect(impacts[0].suggestedDamage).toBe(12);
  });
});

describe('Histórico Command Pattern (Undo / Redo)', () => {
  it('desfaz e refaz movimentações e danos preservando estado exato', () => {
    const c1 = createChar({ id: 'c1', position: { x: 1, y: 1 }, hpCurrent: 80 });
    let state: AppState = {
      version: '1.0',
      matchName: 'Teste',
      board: createBoard(),
      characters: { c1 },
      weapons: {},
      attacks: {},
      combat: { mode: 'free', turnOrder: [], activeCharacterId: null, round: 1 },
      history: { past: [], future: [] },
      settings: {
        diagonalRule: 'chebyshev',
        damageRule: 'attack_only',
        showCoordinates: true,
        showGrid: true,
        checkLoSOnAttacks: true,
      },
      lastAttack: null,
    };

    state = executeCommand(state, {
      id: 'a1',
      type: 'MOVE',
      timestamp: 1,
      description: 'Moveu Guerreiro',
      data: { characterId: 'c1', position: { x: 3, y: 4 } },
      inverse: { characterId: 'c1', position: { x: 1, y: 1 } },
    });

    state = executeCommand(state, {
      id: 'a2',
      type: 'DAMAGE',
      timestamp: 2,
      description: 'Dano 15 em Guerreiro',
      data: { characterId: 'c1', hp: 65 },
      inverse: { characterId: 'c1', hp: 80 },
    });

    expect(state.characters.c1.position).toEqual({ x: 3, y: 4 });
    expect(state.characters.c1.hpCurrent).toBe(65);

    state = undoCommand(state);
    expect(state.characters.c1.hpCurrent).toBe(80);
    expect(state.characters.c1.position).toEqual({ x: 3, y: 4 });

    state = undoCommand(state);
    expect(state.characters.c1.position).toEqual({ x: 1, y: 1 });

    state = redoCommand(state);
    expect(state.characters.c1.position).toEqual({ x: 3, y: 4 });
  });
});
