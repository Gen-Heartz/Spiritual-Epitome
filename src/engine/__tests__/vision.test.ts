import { describe, expect, it } from 'vitest';
import { Board, Character, Direction } from '../../types';
import {
  alcanceVisaoDaUnidade,
  calcularVisaoDaUnidade,
  distanciaGrid,
  FOG_DEFAULT_RANGE,
  FOG_MAX_RANGE,
  FOG_MIN_RANGE,
  linhaDeVisaoLivre,
  nevoaAtiva,
} from '../vision';

function board(
  width = 21,
  height = 21,
  terrain: Board['terrain'] = {}
): Board {
  return { id: 'b_vision', width, height, terrain };
}

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
    position: { x: 10, y: 10 },
    facing: Direction.North,
    width: 1,
    height: 1,
    ...over,
  };
}

describe('Névoa de Visão — motor', () => {
  it('usa 8 quadrados como alcance padrão e respeita os limites', () => {
    expect(FOG_DEFAULT_RANGE).toBe(8);
    expect(FOG_MIN_RANGE).toBe(1);
    expect(FOG_MAX_RANGE).toBe(40);

    expect(alcanceVisaoDaUnidade(unidade(), 'global', FOG_DEFAULT_RANGE)).toBe(8);

    // Valor individual só conta no modo individual
    const ch = unidade({ visionRange: 3 });
    expect(alcanceVisaoDaUnidade(ch, 'global', 8)).toBe(8);
    expect(alcanceVisaoDaUnidade(ch, 'individual', 8)).toBe(3);

    // Sem valor individual definido → cai no global
    expect(alcanceVisaoDaUnidade(unidade(), 'individual', 12)).toBe(12);

    // Clamping
    expect(alcanceVisaoDaUnidade(unidade({ visionRange: 999 }), 'individual', 8)).toBe(
      FOG_MAX_RANGE
    );
    expect(alcanceVisaoDaUnidade(unidade({ visionRange: 0 }), 'individual', 8)).toBe(
      FOG_MIN_RANGE
    );
  });

  it('calcula distância com as duas regras diagonais', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 3, y: 2 };
    expect(distanciaGrid(a, b, 'chebyshev')).toBe(3);
    // Alternada: max(3,2)=3 + floor((2+1)/2)=1 → 4
    expect(distanciaGrid(a, b, 'alternating')).toBe(4);
    expect(distanciaGrid(a, { x: 0, y: 0 }, 'chebyshev')).toBe(0);
  });

  it('revela até ao alcance e nada além dele', () => {
    const b = board();
    const r = calcularVisaoDaUnidade(b, unidade(), 4);

    expect(r.range).toBe(4);
    expect(r.visible.has('10,10')).toBe(true);
    expect(r.visible.has('10,6')).toBe(true); // 4 ao norte
    expect(r.visible.has('14,10')).toBe(true); // 4 a leste
    expect(r.visible.has('10,5')).toBe(false); // 5 ao norte (fora)
    expect(r.visible.has('15,10')).toBe(false);
    expect(r.visible.has('0,0')).toBe(false);

    // Área quadrada com Chebyshev: 9×9 = 81 células
    expect(r.visible.size).toBe(81);
  });

  it('bloqueia a visão em paredes (mas a parede em si é visível)', () => {
    const terrain: Board['terrain'] = {};
    for (let y = 0; y < 21; y++) terrain[`12,${y}`] = 'impassable';

    const b = board(21, 21, terrain);
    const r = calcularVisaoDaUnidade(b, unidade(), 8);

    expect(r.visible.has('10,10')).toBe(true);
    expect(r.visible.has('11,10')).toBe(true); // livre
    expect(r.visible.has('12,10')).toBe(true); // a parede é vista
    expect(r.visible.has('13,10')).toBe(false); // mas não se vê através dela
    expect(r.visible.has('18,10')).toBe(false);

    // Fora do corredor da parede continua a ver-se
    expect(r.visible.has('10,4')).toBe(true);
  });

  it('linha de visão: destino é sempre alcançável pela linha', () => {
    const b = board(11, 11, { '5,5': 'impassable' });
    expect(linhaDeVisaoLivre(b, { x: 4, y: 5 }, { x: 5, y: 5 })).toBe(true);
    expect(linhaDeVisaoLivre(b, { x: 3, y: 5 }, { x: 7, y: 5 })).toBe(false);
    // Vê o canto diagonal-adjacente entre dois obstáculos...
    const b2 = board(11, 11, { '5,4': 'impassable', '4,5': 'impassable' });
    expect(linhaDeVisaoLivre(b2, { x: 4, y: 4 }, { x: 5, y: 5 })).toBe(true);
    // ...mas não vê através dessa fenda diagonal
    expect(linhaDeVisaoLivre(b2, { x: 4, y: 4 }, { x: 6, y: 6 })).toBe(false);
  });

  it('unidades maiores que 1×1 projetam visão a partir de todo o corpo', () => {
    const b = board(21, 21);
    const grande = unidade({
      id: 'ch_big',
      width: 4,
      height: 4,
      position: { x: 8, y: 8 },
    });

    const r = calcularVisaoDaUnidade(b, grande, 2);

    expect(r.sourceCells).toHaveLength(16);
    // Todo o corpo é visível mesmo com alcance reduzido
    for (let x = 8; x < 12; x++) {
      for (let y = 8; y < 12; y++) {
        expect(r.visible.has(`${x},${y}`)).toBe(true);
      }
    }
    // A visão estende-se a partir da borda do corpo (12+2)
    expect(r.visible.has('13,9')).toBe(true);
    expect(r.visible.has('15,9')).toBe(false);
  });

  it('marca a orla da visão e ignora unidades sem posição', () => {
    const b = board();
    const r = calcularVisaoDaUnidade(b, unidade(), 2);
    expect(r.edge.size).toBeGreaterThan(0);
    // A orla nunca está dentro da área visível
    for (const k of r.edge) expect(r.visible.has(k)).toBe(false);

    const semPosicao = calcularVisaoDaUnidade(
      b,
      unidade({ position: null }),
      5
    );
    expect(semPosicao.visible.size).toBe(0);
    expect(semPosicao.edge.size).toBe(0);
  });

  it('só considera a névoa ativa no modo de exploração', () => {
    expect(nevoaAtiva({ fogMode: 'day' })).toBe(false);
    expect(nevoaAtiva({ fogMode: 'exploration' })).toBe(true);
    expect(nevoaAtiva({})).toBe(false);
  });

  it('não altera o estado do tabuleiro (funções puras)', () => {
    const b = board(21, 21, { '12,10': 'impassable' });
    const antes = JSON.stringify(b);
    const ch = unidade();
    const chAntes = JSON.stringify(ch);

    calcularVisaoDaUnidade(b, ch, 8);
    linhaDeVisaoLivre(b, { x: 10, y: 10 }, { x: 15, y: 10 });

    expect(JSON.stringify(b)).toBe(antes);
    expect(JSON.stringify(ch)).toBe(chAntes);
  });
});
