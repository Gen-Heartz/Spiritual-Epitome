import { describe, expect, it } from 'vitest';
import { atribuirAndares } from '../../store/useGameStore';
import { createSampleEncounterState } from '../../data/presets';
import { normalizarCatalogoMapas } from '../mapEngine';

function catalogo() {
  return normalizarCatalogoMapas({
    maps: [
      {
        id: 'andar_superior',
        nome: 'Ruínas',
        largura: 20,
        altura: 15,
        placements: { char_lyra: { x: 2, y: 4 } },
        stairs: [
          { id: 's1', x: 17, y: 13, direction: 'down', targetMapId: 'andar_inferior' },
        ],
      },
      {
        id: 'andar_inferior',
        nome: 'Cripta',
        largura: 16,
        altura: 12,
        placements: { char_aldric: { x: 2, y: 2 } },
        stairs: [
          { id: 's2', x: 2, y: 2, direction: 'up', targetMapId: 'andar_superior' },
        ],
      },
    ],
    folders: [{ id: 'pasta', nome: 'Andares', descricao: '' }],
  });
}

describe('Andares — atribuição de unidades aos mapas', () => {
  it('mantém o andar já guardado na unidade', () => {
    const base = createSampleEncounterState();
    const primeiro = Object.values(base.characters)[0];
    const state = {
      ...base,
      characters: {
        ...base.characters,
        [primeiro.id]: { ...primeiro, mapId: 'andar_inferior' },
      },
    };
    const out = atribuirAndares(state, catalogo(), 'andar_superior');
    expect(out.characters[primeiro.id].mapId).toBe('andar_inferior');
  });

  it('herda o andar ativo quando a unidade tem posição e não tem andar', () => {
    const base = createSampleEncounterState();
    const comPosicao = Object.values(base.characters).find((c) => c.position);
    expect(comPosicao).toBeTruthy();
    const state = {
      ...base,
      characters: {
        [comPosicao!.id]: { ...comPosicao!, mapId: null },
      },
    };
    const out = atribuirAndares(state, catalogo(), 'andar_superior');
    expect(out.characters[comPosicao!.id].mapId).toBe('andar_superior');
  });

  it('descobre o andar pela colocação guardada quando está na reserva', () => {
    const base = createSampleEncounterState();
    const unidade = Object.values(base.characters)[0];
    const state = {
      ...base,
      characters: {
        [unidade.id]: { ...unidade, position: null, mapId: undefined },
      },
    };
    const out = atribuirAndares(state, catalogo(), 'andar_superior');
    expect(out.characters[unidade.id].mapId).toBe('andar_inferior');
  });

  it('ignora andares que já não existem', () => {
    const base = createSampleEncounterState();
    // Unidade sem colocação guardada em nenhum mapa
    const unidade = Object.values(base.characters).find(
      (c) => c.id !== 'char_lyra' && c.id !== 'char_aldric'
    )!;
    const state = {
      ...base,
      characters: {
        [unidade.id]: { ...unidade, position: null, mapId: 'mapa_apagado' },
      },
    };
    const out = atribuirAndares(state, catalogo(), 'andar_superior');
    expect(out.characters[unidade.id].mapId).toBe('andar_superior');
  });

  it('não altera outras propriedades das unidades', () => {
    const base = createSampleEncounterState();
    const unidade = Object.values(base.characters)[0];
    const out = atribuirAndares(base, catalogo(), 'andar_superior');
    expect(out.characters[unidade.id].hpCurrent).toBe(unidade.hpCurrent);
    expect(out.characters[unidade.id].name).toBe(unidade.name);
    expect(out.board).toEqual(base.board);
  });
});
