import { describe, expect, it } from 'vitest';
import { Action, Direction } from '../../types';
import { createBlankMatchState, createSampleEncounterState } from '../../data/presets';
import { normalizeAppState, useGameStore } from '../../store/useGameStore';

function rotationAction(characterId: string, facing: Direction): Action {
  return {
    id: `act_rot_${Math.random().toString(36).slice(2, 7)}`,
    type: 'ROTATE',
    timestamp: Date.now(),
    description: 'Aldric girou para N',
    data: { characterId, facing },
    inverse: { characterId, facing: Direction.South },
  };
}

function attackAction(): Action {
  return {
    id: 'act_atk',
    type: 'ATTACK_RESOLVE',
    timestamp: Date.now(),
    description: 'Aldric usou "Golpe de Alcance" em direção a Leste (L) → Goblin (-6)',
    data: { attackerId: 'c1', hpChanges: [] },
    inverse: { attackerId: 'c1', hpChanges: [] },
  };
}

describe('Log de Combate — mudanças de direção', () => {
  it('remove ações ROTATE antigas do histórico ao carregar a partida', () => {
    const base = createBlankMatchState('Teste', 10, 10);
    const state = {
      ...base,
      history: {
        past: [rotationAction('c1', Direction.North), attackAction()],
        future: [rotationAction('c1', Direction.East)],
      },
    };

    const normalized = normalizeAppState(state);

    expect(normalized.history.past).toHaveLength(1);
    expect(normalized.history.past[0].type).toBe('ATTACK_RESOLVE');
    expect(normalized.history.future).toHaveLength(0);
    expect(
      normalized.history.past.some((a) => a.type === 'ROTATE')
    ).toBe(false);
  });

  it('preserva a orientação atual do personagem ao limpar o histórico', () => {
    const base = createBlankMatchState('Teste', 10, 10);
    const charId = Object.keys(base.characters)[0];

    const normalized = normalizeAppState({
      ...base,
      characters: {
        ...base.characters,
        [charId]: {
          ...base.characters[charId],
          facing: Direction.West,
        },
      },
      history: {
        past: [rotationAction(charId, Direction.North)],
        future: [],
      },
    });

    expect(normalized.characters[charId].facing).toBe(Direction.West);
    expect(normalized.history.past).toHaveLength(0);
  });

  it('rotateCharacter gira o personagem sem criar entrada no histórico', () => {
    const state = createSampleEncounterState();
    const charId = Object.keys(state.characters)[0];
    useGameStore.setState({ appState: state });

    const current = state.characters[charId].facing;
    const target =
      current === Direction.NorthWest ? Direction.SouthEast : Direction.NorthWest;

    useGameStore.getState().rotateCharacter(charId, target);

    const after = useGameStore.getState().appState;
    expect(after.characters[charId].facing).toBe(target);
    expect(after.history.past).toHaveLength(state.history.past.length);
    expect(after.history.future).toHaveLength(0);
  });

  it('mantém o histórico intacto quando não há rotações registadas', () => {
    const base = createBlankMatchState('Teste', 10, 10);
    const attack = attackAction();
    const normalized = normalizeAppState({
      ...base,
      history: { past: [attack], future: [] },
    });

    expect(normalized.history.past).toBeDefined();
    expect(normalized.history.past).toHaveLength(1);
    expect(normalized.history.past[0].id).toBe(attack.id);
  });
});
