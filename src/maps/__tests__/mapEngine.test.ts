import { describe, expect, it } from 'vitest';
import { Board, Character, Direction } from '../../types';
import {
  boardDoMapa,
  celulaTemEscada,
  chaveCelula,
  criarMapaEmBranco,
  escadaNaCelula,
  escadaSobUnidade,
  escadasLigadas,
  escadasOrfas,
  listarMapas,
  normalizarCatalogoMapas,
  normalizarMapa,
  primeiraCelulaLivre,
  resolverChegada,
  rotuloDirecao,
  simboloDirecao,
} from '../mapEngine';
import {
  GameMap,
  MAP_DEFAULT_HEIGHT,
  MAP_DEFAULT_WIDTH,
  MAP_MAX_SIZE,
  MAP_MIN_SIZE,
  MapStair,
} from '../mapTypes';

function unidade(over: Partial<Character> = {}): Character {
  return {
    id: 'ch_1',
    name: 'Explorador',
    imageId: '',
    hpMax: 20,
    hpCurrent: 20,
    movement: 5,
    baseDamage: 3,
    weaponIds: [],
    position: { x: 0, y: 0 },
    facing: Direction.North,
    width: 1,
    height: 1,
    ...over,
  };
}

function escada(over: Partial<MapStair> = {}): MapStair {
  return {
    id: 'st_1',
    x: 2,
    y: 3,
    direction: 'down',
    label: 'Escada',
    targetMapId: null,
    targetStairId: null,
    ...over,
  };
}

function mapa(over: Partial<GameMap> = {}): GameMap {
  return { ...criarMapaEmBranco('Teste', 10, 8), ...over };
}

describe('Mapas — modelo e normalização', () => {
  it('cria mapa em branco com dimensões por omissão e névoa desbloqueada', () => {
    const m = criarMapaEmBranco();
    expect(m.largura).toBe(MAP_DEFAULT_WIDTH);
    expect(m.altura).toBe(MAP_DEFAULT_HEIGHT);
    expect(m.terrain).toEqual({});
    expect(m.stairs).toEqual([]);
    expect(m.fog.mode).toBe('day');
    expect(m.fog.locked).toBe(false);
  });

  it('limita dimensões ao intervalo permitido', () => {
    const pequeno = normalizarMapa({ largura: -50, altura: 2 });
    expect(pequeno.largura).toBe(MAP_MIN_SIZE);
    expect(pequeno.altura).toBe(MAP_MIN_SIZE);

    const enorme = normalizarMapa({ largura: 9999, altura: 9999 });
    expect(enorme.largura).toBe(MAP_MAX_SIZE);
    expect(enorme.altura).toBe(MAP_MAX_SIZE);
  });

  it('descarta terreno, escadas e posições fora dos limites', () => {
    const m = normalizarMapa({
      largura: 10,
      altura: 10,
      terrain: {
        '3,3': 'impassable',
        '9,9': 'difficult',
        '40,40': 'impassable',
        '2,2': 'normal',
      },
      stairs: [
        escada({ id: 'a', x: 4, y: 4 }),
        escada({ id: 'b', x: 30, y: 4 }),
      ],
      placements: { ch_1: { x: 5, y: 5 }, ch_2: { x: 99, y: 5 } },
    });

    expect(m.terrain[chaveCelula(3, 3)]).toBe('impassable');
    expect(m.terrain[chaveCelula(9, 9)]).toBe('difficult');
    expect(m.terrain[chaveCelula(40, 40)]).toBeUndefined();
    // 'normal' não é guardado (é o estado por omissão do quadrado)
    expect(m.terrain[chaveCelula(2, 2)]).toBeUndefined();

    expect(m.stairs.map((s) => s.id)).toEqual(['a']);
    expect(m.placements.ch_1).toEqual({ x: 5, y: 5 });
    expect(m.placements.ch_2).toBeUndefined();
  });

  it('normaliza o preset de névoa (modo, alcance e bloqueio)', () => {
    const expl = normalizarMapa({ fog: { mode: 'exploration', range: 999, locked: true } });
    expect(expl.fog.mode).toBe('exploration');
    expect(expl.fog.range).toBe(40);
    expect(expl.fog.locked).toBe(true);

    const dia = normalizarMapa({ fog: { mode: 'lunar' as any, range: 0 } });
    expect(dia.fog.mode).toBe('day');
    expect(dia.fog.range).toBe(8);
    expect(dia.fog.locked).toBe(false);
  });

  it('normaliza catálogo e escolhe um default válido', () => {
    const cat = normalizarCatalogoMapas({
      maps: [
        { id: 'm_b', nome: 'Beta', largura: 10, altura: 10 },
        { id: 'm_a', nome: 'Alfa', largura: 10, altura: 10 },
      ],
      defaultMapId: 'm_inexistente',
    });
    expect(Object.keys(cat.maps).sort()).toEqual(['m_a', 'm_b']);
    expect(cat.defaultMapId).toBe('m_b');
    expect(listarMapas(cat).map((m) => m.nome)).toEqual(['Alfa', 'Beta']);
  });

  it('converte GameMap em Board para o tabuleiro', () => {
    const m = mapa({ id: 'm_x', largura: 6, altura: 5, terrain: { '1,1': 'difficult' } });
    const b: Board = boardDoMapa(m);
    expect(b).toEqual({ id: 'm_x', width: 6, height: 5, terrain: { '1,1': 'difficult' } });
  });
});

describe('Escadas — colocação e ligações', () => {
  it('encontra escada na célula e sob unidades maiores que 1×1', () => {
    const m = mapa({
      stairs: [escada({ id: 's1', x: 4, y: 4, direction: 'up' })],
    });

    expect(escadaNaCelula(m, 4, 4)?.id).toBe('s1');
    expect(escadaNaCelula(m, 5, 4)).toBeNull();
    expect(celulaTemEscada(m, 4, 4)).toBe(true);

    const grande = unidade({ position: { x: 3, y: 3 }, width: 3, height: 2 });
    expect(escadaSobUnidade(m, grande)?.id).toBe('s1');

    const fora = unidade({ position: { x: 0, y: 0 } });
    expect(escadaSobUnidade(m, fora)).toBeNull();
  });

  it('separa escadas ligadas das órfãs', () => {
    const m = mapa({
      stairs: [
        escada({ id: 'ligada', targetMapId: 'm_destino' }),
        escada({ id: 'sem_liga', targetMapId: null }),
        escada({ id: 'removida', targetMapId: 'm_inexistente' }),
      ],
    });
    const cat = normalizarCatalogoMapas({
      maps: [mapa({ id: 'm_origem' }), mapa({ id: 'm_destino' })],
    });

    expect(escadasLigadas(m).map((s) => s.id)).toEqual(['ligada', 'removida']);
    expect(escadasOrfas(m, cat).map((s) => s.id)).toEqual([
      'sem_liga',
      'removida',
    ]);
  });

  it('etiqueta e símbolo de direção', () => {
    expect(rotuloDirecao('up')).toBe('Subida');
    expect(rotuloDirecao('down')).toBe('Descida');
    expect(simboloDirecao('up')).toBe('▲');
    expect(simboloDirecao('down')).toBe('▼');
  });
});

describe('Escadas — resolução da chegada', () => {
  const destino = mapa({
    id: 'm_destino',
    stairs: [
      escada({ id: 'd1', x: 1, y: 1, targetMapId: 'm_outro' }),
      escada({ id: 'd2', x: 8, y: 6, targetMapId: 'm_origem' }),
      escada({ id: 'd3', x: 5, y: 2, targetMapId: null }),
    ],
  });

  it('priora a escada explicitamente indicada', () => {
    expect(resolverChegada(destino, 'm_origem', 'd3')).toEqual({ x: 5, y: 2 });
  });

  it('usa a escada que aponta de volta para o mapa de origem', () => {
    expect(resolverChegada(destino, 'm_origem', null)).toEqual({ x: 8, y: 6 });
  });

  it('recorre à primeira escada quando não há retorno', () => {
    expect(resolverChegada(destino, 'm_desconhecido', null)).toEqual({ x: 1, y: 1 });
  });

  it('devolve null quando o mapa não tem escadas', () => {
    expect(resolverChegada(mapa(), 'm_origem', null)).toBeNull();
  });
});

describe('primeiraCelulaLivre — ocupação', () => {
  const board: Board = { id: 'b', width: 8, height: 8, terrain: {} };

  it('devolve a própria origem quando está livre', () => {
    expect(primeiraCelulaLivre(board, {}, unidade(), { x: 3, y: 3 })).toEqual({
      x: 3,
      y: 3,
    });
  });

  it('salta células ocupadas e sai da espiral', () => {
    const ocupante = unidade({ id: 'ch_2', position: { x: 2, y: 2 } });
    const chars = { ch_2: ocupante };
    const livre = primeiraCelulaLivre(board, chars, unidade(), { x: 2, y: 2 });
    expect(livre).not.toBeNull();
    expect(livre).not.toEqual({ x: 2, y: 2 });
  });

  it('evita terreno intransponível', () => {
    const muro: Board = {
      id: 'b2',
      width: 6,
      height: 6,
      terrain: { [chaveCelula(0, 0)]: 'impassable' },
    };
    const livre = primeiraCelulaLivre(muro, {}, unidade(), { x: 0, y: 0 });
    expect(livre).not.toEqual({ x: 0, y: 0 });
  });

  it('considera o tamanho da unidade e devolve null sem espaço', () => {
    const enorme = unidade({ width: 5, height: 5 });
    const pequeno: Board = { id: 'b3', width: 3, height: 3, terrain: {} };
    expect(primeiraCelulaLivre(pequeno, {}, enorme, { x: 0, y: 0 })).toBeNull();
  });
});
