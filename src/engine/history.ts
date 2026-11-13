import {
  Action,
  AppState,
  LastResolvedAttack,
  TerrainType,
} from '../types';

function cloneLastAttack(
  value: LastResolvedAttack | null | undefined
): LastResolvedAttack | null {
  if (!value) return null;
  return {
    ...value,
    attackerPosition: value.attackerPosition
      ? { ...value.attackerPosition }
      : null,
    targetOrigin: { ...value.targetOrigin },
    cells: value.cells.map((c) => ({ ...c })),
  };
}

/**
 * Aplica os dados de uma operação (`payload`) sobre uma cópia imutável de `AppState`.
 * Funciona simetricamente para `action.data` (executar/refazer) e `action.inverse` (desfazer).
 */
export function applyCommandPayload(
  state: AppState,
  action: Action,
  direction: 'forward' | 'backward'
): AppState {
  const payload = direction === 'forward' ? action.data : action.inverse;

  switch (action.type) {
    case 'MOVE':
    case 'PLACE_CHARACTER':
    case 'REMOVE_CHARACTER': {
      const { characterId, position } = payload as {
        characterId: string;
        position: { x: number; y: number } | null;
      };
      const target = state.characters[characterId];
      if (!target) return state;
      return {
        ...state,
        characters: {
          ...state.characters,
          [characterId]: {
            ...target,
            position: position ? { x: position.x, y: position.y } : null,
          },
        },
      };
    }

    case 'ROTATE': {
      const { characterId, facing } = payload as {
        characterId: string;
        facing: number;
      };
      const target = state.characters[characterId];
      if (!target) return state;
      return {
        ...state,
        characters: {
          ...state.characters,
          [characterId]: {
            ...target,
            facing,
          },
        },
      };
    }

    case 'DAMAGE':
    case 'HEAL':
    case 'SET_HP': {
      const { characterId, hp } = payload as {
        characterId: string;
        hp: number;
      };
      const target = state.characters[characterId];
      if (!target) return state;
      const clamped = Math.max(0, Math.min(target.hpMax, hp));
      return {
        ...state,
        characters: {
          ...state.characters,
          [characterId]: {
            ...target,
            hpCurrent: clamped,
          },
        },
      };
    }

    case 'ATTACK_RESOLVE': {
      const { hpChanges, attackerFacing } = payload as {
        hpChanges: Array<{ characterId: string; hp: number }>;
        attackerId?: string;
        attackerFacing?: number;
        lastAttack?: LastResolvedAttack | null;
      };
      const updatedChars = { ...state.characters };
      if (
        payload.attackerId &&
        attackerFacing !== undefined &&
        updatedChars[payload.attackerId]
      ) {
        updatedChars[payload.attackerId] = {
          ...updatedChars[payload.attackerId],
          facing: attackerFacing,
        };
      }
      for (const item of hpChanges) {
        const ch = updatedChars[item.characterId];
        if (!ch) continue;
        updatedChars[item.characterId] = {
          ...ch,
          hpCurrent: Math.max(0, Math.min(ch.hpMax, item.hp)),
        };
      }
      // Área persistente: ao executar/refazer mostra o ataque dessa ação;
      // ao desfazer, restaura a área do ataque anterior (ou limpa se não havia).
      // Ações antigas sem `lastAttack` no payload mantêm a área atual.
      const nextLastAttack =
        payload.lastAttack !== undefined
          ? cloneLastAttack(payload.lastAttack)
          : state.lastAttack ?? null;
      return {
        ...state,
        characters: updatedChars,
        lastAttack: nextLastAttack,
      };
    }

    case 'TERRAIN_BATCH': {
      const { changes } = payload as {
        changes: Record<string, TerrainType>;
      };
      const nextTerrain = { ...state.board.terrain };
      for (const [cellKey, terrain] of Object.entries(changes)) {
        if (terrain === 'normal') {
          delete nextTerrain[cellKey];
        } else {
          nextTerrain[cellKey] = terrain;
        }
      }
      return {
        ...state,
        board: {
          ...state.board,
          terrain: nextTerrain,
        },
      };
    }

    case 'TURN_CHANGE': {
      const { activeCharacterId, round } = payload as {
        activeCharacterId: string | null;
        round: number;
      };
      return {
        ...state,
        combat: {
          ...state.combat,
          activeCharacterId,
          round,
        },
      };
    }

    default:
      return state;
  }
}

export function executeCommand(state: AppState, action: Action): AppState {
  const nextState = applyCommandPayload(state, action, 'forward');
  return {
    ...nextState,
    history: {
      past: [...state.history.past.slice(-99), action],
      future: [],
    },
  };
}

export function undoCommand(state: AppState): AppState {
  if (state.history.past.length === 0) return state;
  const last = state.history.past[state.history.past.length - 1];
  const prevPast = state.history.past.slice(0, -1);
  const reverted = applyCommandPayload(state, last, 'backward');
  return {
    ...reverted,
    history: {
      past: prevPast,
      future: [last, ...state.history.future],
    },
  };
}

export function redoCommand(state: AppState): AppState {
  if (state.history.future.length === 0) return state;
  const [next, ...restFuture] = state.history.future;
  const reapplied = applyCommandPayload(state, next, 'forward');
  return {
    ...reapplied,
    history: {
      past: [...state.history.past, next],
      future: restFuture,
    },
  };
}
