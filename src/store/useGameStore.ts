import { create } from 'zustand';
import {
  Action,
  ActiveTool,
  AppState,
  ArsenalCatalog,
  Attack,
  AttackTargetingState,
  Board,
  Character,
  CombatMode,
  Direction,
  FogMode,
  FogRangeMode,
  ImpactZone,
  LastResolvedAttack,
  SystemSettings,
  TerrainType,
  Weapon,
} from '../types';
import { EpitomeFicha } from '../epitome/epitomeTypes';
import {
  calcularFicha,
  converterFichaParaTabuleiro,
  equiparArmaDoArsenalNaFicha,
} from '../epitome/epitomeEngine';
import {
  canPlaceCharacter,
  DIRECTION_LABELS,
  getDirectionalAnchorCell,
  GridPoint,
} from '../engine/geometry';
import { rotateOffset, projectAttackOnBoard } from '../engine/rotation';
import { detectAttackImpacts } from '../engine/combat';
import { executeCommand, redoCommand, undoCommand } from '../engine/history';
import {
  checkStorageEstimate,
  deleteFicha,
  getActiveMatchRecord,
  getFicha,
  listFichas,
  loadOrSeedArsenalCatalog,
  saveArsenalCatalog,
  loadOrSeedBestiaryCatalog,
  saveBestiaryCatalog,
  saveCharacterTemplate,
  saveFicha,
  saveMatchRecord,
  saveWeaponTemplate,
  seedDefaultFichasIfEmpty,
  StorageEstimateInfo,
} from '../db/database';
import {
  BestiaryCatalog,
  BestiaryMonster,
} from '../bestiary/bestiaryTypes';
import { converterMonstroParaTabuleiro } from '../bestiary/bestiaryEngine';
import { createDefaultBestiaryCatalog } from '../data/bestiaryPresets';
import { GameMap, MapCatalog, MapStair } from '../maps/mapTypes';
import {
  boardDoMapa,
  criarMapaEmBranco,
  escadaSobUnidade,
  gerarStairId,
  listarMapas,
  normalizarCatalogoMapas,
  primeiraCelulaLivre,
  resolverChegada,
} from '../maps/mapEngine';
import {
  loadOrSeedMapCatalog,
  saveMapCatalog,
} from '../db/database';
import { initializeAllPresetEmblems } from '../utils/imageProcessor';
import {
  createBlankMatchState,
  createDefaultArsenalCatalog,
  createSampleEncounterState,
} from '../data/presets';

export type AppScreen =
  | 'home'
  | 'glossario'
  | 'glossario_armas'
  | 'glossario_monstros'
  | 'glossario_locais'
  | 'glossario_mapas'
  | 'fichas'
  | 'ficha_editor'
  | 'ficha_jogar'
  | 'tabuleiro';

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Compatibilidade com partidas guardadas antes da área persistente existir. */
/**
 * Ações de rotação geradas antigamente enchiam o Log com "girou para X" a cada
 * movimento do mouse. Removem-se do histórico ao carregar a partida; a
 * orientação atual de cada personagem é preservada.
 */
function stripRotationActions(state: AppState): AppState {
  const history = state.history;
  if (!history) return state;
  const past = history.past.filter((a) => a.type !== 'ROTATE');
  const future = history.future.filter((a) => a.type !== 'ROTATE');
  if (
    past.length === history.past.length &&
    future.length === history.future.length
  ) {
    return state;
  }
  return { ...state, history: { past, future } };
}

export function normalizeAppState(state: AppState): AppState {
  const withFog: AppState = {
    ...state,
    settings: {
      ...state.settings,
      fogMode: state.settings?.fogMode ?? 'day',
      fogRangeMode: state.settings?.fogRangeMode ?? 'global',
      fogGlobalRange: state.settings?.fogGlobalRange ?? 8,
      fogIntensity: state.settings?.fogIntensity ?? 1,
      fogLocked: state.settings?.fogLocked ?? false,
    },
  };

  const base = stripRotationActions(withFog);

  if (base.lastAttack === undefined || base.lastAttack === null) {
    return { ...base, lastAttack: base.lastAttack ?? null };
  }
  return {
    ...base,
    lastAttack: {
      ...base.lastAttack,
      attackerPosition: base.lastAttack.attackerPosition
        ? { ...base.lastAttack.attackerPosition }
        : null,
      targetOrigin: { ...base.lastAttack.targetOrigin },
      cells: Array.isArray(base.lastAttack.cells)
        ? base.lastAttack.cells.map((c) => ({ ...c }))
        : [],
    },
  };
}

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

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(
  matchId: string,
  state: AppState,
  onStorageChecked?: (info: StorageEstimateInfo) => void
) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await saveMatchRecord(matchId, state.matchName, state);
      if (onStorageChecked) {
        const est = await checkStorageEstimate();
        onStorageChecked(est);
      }
    } catch (err) {
      console.error('Erro ao salvar estado no IndexedDB:', err);
    }
  }, 220);
}

export interface SpawnFichaOptions {
  width?: number;
  height?: number;
  metrosPorQuadrado?: number;
  placeOnBoard?: boolean;
  updateExisting?: boolean;
}

export interface GameStore {
  initialized: boolean;
  activeScreen: AppScreen;
  activeMatchId: string;
  appState: AppState;

  // Grimório, Glossário & Fichas (Spiritual-Epitome)
  arsenalCatalog: ArsenalCatalog;
  /** Bestiário do Glossário (Glossário -> Monstros) */
  bestiaryCatalog: BestiaryCatalog;
  /** Mapas do Tabuleiro (Glossário -> Locais -> Mapas) */
  mapCatalog: MapCatalog;
  /** Mapa atualmente carregado no tabuleiro */
  activeMapId: string | null;
  fichasList: EpitomeFicha[];
  editingFichaId: string | null;
  playingFichaIds: string[];
  quickSheetFichaId: string | null;
  spawnFichaModal: { open: boolean; preselectFichaId: string | null };
  systemGuideModalOpen: boolean;

  // UI & Interação do Tabuleiro
  selectedCharacterId: string | null;
  activeTool: ActiveTool;
  movementModeCharacterId: string | null;
  attackTargeting: AttackTargetingState | null;

  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  leftTab: 'characters' | 'initiative' | 'history';
  showZoneLegend: boolean;

  // Câmera
  cameraZoomPercent: number;
  cameraResetNonce: number;
  zoomStepRequest: { factor: number; nonce: number } | null;

  // Modais do Tabuleiro
  characterModal: { open: boolean; editCharacterId: string | null };
  arsenalModal: {
    open: boolean;
    focusWeaponId: string | null;
    equipToCharacterId: string | null;
  };
  attackEditorModal: {
    open: boolean;
    weaponId: string | null;
    editAttackId: string | null;
  };
  matchesModal: {
    open: boolean;
    initialTab: 'matches' | 'templates' | 'export';
  };
  settingsModalOpen: boolean;

  // Storage & Notificações
  storageEstimate: StorageEstimateInfo;
  toastMessage: string | null;

  // Navegação e Grimório
  setActiveScreen: (screen: AppScreen) => void;
  openFichaEditor: (fichaId: string | null) => void;
  startJogarFichas: (ids: string[]) => void;
  setQuickSheetFichaId: (fichaId: string | null) => void;
  openSpawnFichaModal: (fichaId?: string | null) => void;
  closeSpawnFichaModal: () => void;
  setSystemGuideModalOpen: (open: boolean) => void;
  refreshFichas: () => Promise<void>;
  refreshArsenal: () => Promise<void>;

  // Bestiário (Glossário -> Monstros)
  refreshBestiary: () => Promise<void>;
  upsertMonster: (monster: BestiaryMonster) => void;
  duplicateMonster: (monsterId: string) => string | null;
  deleteMonster: (monsterId: string) => void;
  importBestiary: (monsters: BestiaryMonster[]) => Promise<number>;
  summonMonsterOnBoard: (monsterId: string) => Promise<string | null>;

  // Mapas & Escadas (Glossário -> Locais -> Mapas)
  refreshMaps: () => Promise<void>;
  upsertMap: (map: GameMap) => void;
  deleteMap: (mapId: string) => void;
  duplicateMap: (mapId: string) => string | null;
  setDefaultMap: (mapId: string) => void;
  switchMap: (
    mapId: string,
    opts?: {
      characterId?: string | null;
      arrivalStairId?: string | null;
      silent?: boolean;
    }
  ) => boolean;
  syncActiveMapFromBoard: () => void;

  saveFichaRecord: (
    ficha: EpitomeFicha,
    syncLinkedBoardChars?: boolean
  ) => Promise<EpitomeFicha>;
  deleteFichaRecord: (fichaId: string) => Promise<void>;
  spawnOrSyncFichaOnBoard: (
    fichaId: string,
    opts?: SpawnFichaOptions
  ) => Promise<string | null>;
  adjustCharacterEpitomeResource: (
    characterId: string,
    resource: 'estamina' | 'raciocinio',
    delta: number
  ) => Promise<void>;
  sortInitiativeByAgility: () => void;

  // Inicialização e Partidas
  initApp: () => Promise<void>;
  loadMatchState: (
    matchId: string,
    name: string,
    newState: AppState
  ) => Promise<void>;
  createNewMatch: (
    name: string,
    width: number,
    height: number,
    useSample?: boolean
  ) => Promise<void>;
  setMatchName: (name: string) => void;
  showToast: (msg: string) => void;
  refreshStorageEstimate: () => Promise<void>;

  // Painéis, Ferramentas e Câmera
  setSelectedCharacter: (id: string | null) => void;
  setActiveTool: (tool: ActiveTool) => void;
  enterMovementMode: (characterId: string | null) => void;
  cancelActiveModes: () => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setLeftTab: (tab: 'characters' | 'initiative' | 'history') => void;
  setShowZoneLegend: (show: boolean) => void;
  setCameraZoomPercent: (pct: number) => void;
  triggerCameraReset: () => void;
  triggerCameraZoomStep: (factor: number) => void;

  // Modais
  openCharacterModal: (editCharacterId?: string | null) => void;
  closeCharacterModal: () => void;
  openArsenalModal: (
    focusWeaponId?: string | null,
    equipToCharacterId?: string | null
  ) => void;
  closeArsenalModal: () => void;
  openAttackEditorModal: (
    weaponId: string,
    editAttackId?: string | null
  ) => void;
  closeAttackEditorModal: () => void;
  openMatchesModal: (tab?: 'matches' | 'templates' | 'export') => void;
  closeMatchesModal: () => void;
  setSettingsModalOpen: (open: boolean) => void;

  // Configurações e Tabuleiro
  updateSettings: (partial: Partial<SystemSettings>) => void;
  setFogMode: (mode: FogMode) => void;
  setFogRangeMode: (mode: FogRangeMode) => void;
  setFogGlobalRange: (range: number) => void;
  setFogIntensity: (intensity: number) => void;
  setCharacterVisionRange: (characterId: string, range: number | null) => void;
  resizeBoard: (width: number, height: number) => void;
  applyTerrainChanges: (changes: Record<string, TerrainType>) => void;

  // Gerenciamento de Personagens
  upsertCharacter: (char: Character) => void;
  duplicateCharacter: (characterId: string) => void;
  deleteCharacter: (characterId: string) => void;
  placeCharacter: (characterId: string, pos: GridPoint) => boolean;
  autoPlaceCharacter: (characterId: string) => boolean;
  removeCharacterFromBoard: (characterId: string) => void;
  moveCharacter: (characterId: string, to: GridPoint) => boolean;
  rotateCharacter: (characterId: string, facing: Direction) => void;
  applyDamage: (characterId: string, amount: number) => void;
  applyHeal: (characterId: string, amount: number) => void;
  setCharacterHpDirect: (characterId: string, hp: number) => void;
  toggleEquipWeapon: (characterId: string, weaponId: string) => void;
  saveCharacterAsTemplate: (characterId: string) => Promise<void>;

  // Gerenciamento de Armas e Ataques
  upsertWeapon: (weapon: Weapon) => void;
  duplicateWeapon: (weaponId: string) => void;
  deleteWeapon: (weaponId: string) => void;
  upsertAttack: (attack: Attack, linkToWeaponId?: string | null) => void;
  deleteAttack: (attackId: string, fromWeaponId?: string) => void;
  saveWeaponAsTemplate: (weaponId: string) => Promise<void>;

  // Combate e Resolução de Ataques
  startAttackTargeting: (
    attackerId: string,
    weaponId: string,
    attackId: string
  ) => void;
  updateAttackDirection: (direction: Direction) => void;
  updateAttackOrigin: (origin: GridPoint) => void;
  setAttackAnchorToAttacker: (anchor: boolean) => void;
  toggleAttackCellOverride: (
    x: number,
    y: number,
    zoneOrRemove: ImpactZone | 'remove' | 'clear'
  ) => void;
  setTargetDamageAdjustment: (
    characterId: string,
    finalDamage: number,
    ignored: boolean
  ) => void;
  confirmAttackResolution: (autoDefault?: boolean) => void;
  clearLastResolvedAttack: () => void;

  // Turnos, Iniciativa e Histórico
  setCombatMode: (mode: CombatMode) => void;
  setTurnOrder: (order: string[]) => void;
  addCharacterToInitiative: (characterId: string) => void;
  removeCharacterFromInitiative: (characterId: string) => void;
  setActiveTurnCharacter: (characterId: string | null) => void;
  nextTurn: () => void;
  newRound: () => void;
  undo: () => void;
  redo: () => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  const persistCurrent = (nextAppState: AppState) => {
    const matchId = get().activeMatchId;
    schedulePersist(matchId, nextAppState, (est) => {
      set({ storageEstimate: est });
    });
    // Mantém o mapa ativo sincronizado (dimensões, terreno e posições)
    get().syncActiveMapFromBoard();
  };

  /** Sincroniza `vidaAtual` do Tabuleiro de volta para fichas vinculadas em IndexedDB */
  const syncBoardHpToFichas = async (
    nextState: AppState,
    changedCharacterIds: string[]
  ) => {
    let anyUpdated = false;
    for (const cid of changedCharacterIds) {
      const ch = nextState.characters[cid];
      if (!ch || !ch.fichaId) continue;
      const ficha = await getFicha(ch.fichaId);
      if (!ficha) continue;
      if (ficha._estado.vidaAtual !== ch.hpCurrent) {
        await saveFicha({
          ...ficha,
          _estado: {
            ...ficha._estado,
            vidaAtual: ch.hpCurrent,
          },
        });
        anyUpdated = true;
      }
    }
    if (anyUpdated) {
      const fichas = await listFichas();
      set({ fichasList: fichas });
    }
  };

  return {
    initialized: false,
    activeScreen: 'home',
    activeMatchId: 'match_default_001',
    appState: createSampleEncounterState(),

    arsenalCatalog: createDefaultArsenalCatalog(),
    bestiaryCatalog: createDefaultBestiaryCatalog(),
    mapCatalog: { maps: {}, defaultMapId: null },
    activeMapId: null,
    fichasList: [],
    editingFichaId: null,
    playingFichaIds: [],
    quickSheetFichaId: null,
    spawnFichaModal: { open: false, preselectFichaId: null },
    systemGuideModalOpen: false,

    selectedCharacterId: 'char_lyra',
    activeTool: 'select',
    movementModeCharacterId: null,
    attackTargeting: null,

    leftPanelOpen: true,
    rightPanelOpen: true,
    leftTab: 'characters',
    showZoneLegend: true,

    cameraZoomPercent: 100,
    cameraResetNonce: 0,
    zoomStepRequest: null,

    characterModal: { open: false, editCharacterId: null },
    arsenalModal: {
      open: false,
      focusWeaponId: null,
      equipToCharacterId: null,
    },
    attackEditorModal: { open: false, weaponId: null, editAttackId: null },
    matchesModal: { open: false, initialTab: 'matches' },
    settingsModalOpen: false,

    storageEstimate: { usage: 0, quota: 0, percent: 0, warning: false },
    toastMessage: null,

    // === Navegação e Fichas (Spiritual-Epitome) ===
    setActiveScreen: (screen) => {
      set({
        activeScreen: screen,
        cameraResetNonce:
          screen === 'tabuleiro'
            ? get().cameraResetNonce + 1
            : get().cameraResetNonce,
      });
    },

    openFichaEditor: (fichaId) => {
      set({
        editingFichaId: fichaId,
        activeScreen: 'ficha_editor',
      });
    },

    startJogarFichas: (ids) => {
      if (!ids.length) return;
      set({
        playingFichaIds: ids.slice(0, 2),
        activeScreen: 'ficha_jogar',
      });
    },

    setQuickSheetFichaId: (fichaId) => set({ quickSheetFichaId: fichaId }),

    openSpawnFichaModal: (fichaId = null) =>
      set({ spawnFichaModal: { open: true, preselectFichaId: fichaId } }),

    closeSpawnFichaModal: () =>
      set({ spawnFichaModal: { open: false, preselectFichaId: null } }),

    setSystemGuideModalOpen: (open) => set({ systemGuideModalOpen: open }),

    refreshFichas: async () => {
      const [fichas, arsenal] = await Promise.all([
        listFichas(),
        loadOrSeedArsenalCatalog(get().appState),
      ]);
      const prev = get().appState;
      const mergedState: AppState = {
        ...prev,
        weapons: { ...arsenal.weapons, ...prev.weapons },
        attacks: { ...arsenal.attacks, ...prev.attacks },
      };
      set({
        fichasList: fichas,
        arsenalCatalog: arsenal,
        appState: mergedState,
      });
    },

    refreshArsenal: async () => {
      const arsenal = await loadOrSeedArsenalCatalog(get().appState);
      const prev = get().appState;
      const mergedState: AppState = {
        ...prev,
        weapons: { ...arsenal.weapons, ...prev.weapons },
        attacks: { ...arsenal.attacks, ...prev.attacks },
      };
      set({ arsenalCatalog: arsenal, appState: mergedState });
    },

    // ===== Bestiário (Glossário -> Monstros) =====
    refreshBestiary: async () => {
      const bestiary = await loadOrSeedBestiaryCatalog();
      set({ bestiaryCatalog: bestiary });
    },

    upsertMonster: (monster) => {
      const prevBestiary = get().bestiaryCatalog;
      const agora = Date.now();
      const existente = prevBestiary.monsters[monster.id];
      const normalizado: BestiaryMonster = {
        ...monster,
        criadoEm: existente ? existente.criadoEm : monster.criadoEm || agora,
        atualizadoEm: agora,
      };
      const nextCatalog: BestiaryCatalog = {
        monsters: {
          ...prevBestiary.monsters,
          [monster.id]: normalizado,
        },
      };
      set({ bestiaryCatalog: nextCatalog });
      saveBestiaryCatalog(nextCatalog).catch((e) =>
        console.error('Erro ao salvar bestiário:', e)
      );
    },

    duplicateMonster: (monsterId) => {
      const prevBestiary = get().bestiaryCatalog;
      const origem = prevBestiary.monsters[monsterId];
      if (!origem) return null;

      const agora = Date.now();
      const novoId = `mon_${agora}_${Math.random().toString(36).slice(2, 7)}`;
      const copia: BestiaryMonster = {
        ...origem,
        id: novoId,
        nome: `${origem.nome} (Cópia)`,
        criadoEm: agora,
        atualizadoEm: agora,
        habilidades: {
          fisico: { ...origem.habilidades.fisico },
          magico: { ...origem.habilidades.magico },
          extras: { ...origem.habilidades.extras },
        },
        regioes: [...origem.regioes],
        presas: [...origem.presas],
        elementos: [...origem.elementos],
        itensExtraiveis: origem.itensExtraiveis.map((i) => ({ ...i })),
        ajustes: origem.ajustes ? { ...origem.ajustes } : undefined,
      };

      const nextCatalog: BestiaryCatalog = {
        monsters: { ...prevBestiary.monsters, [novoId]: copia },
      };
      set({ bestiaryCatalog: nextCatalog });
      saveBestiaryCatalog(nextCatalog).catch((e) =>
        console.error('Erro ao salvar bestiário:', e)
      );
      return novoId;
    },

    deleteMonster: (monsterId) => {
      const prevBestiary = get().bestiaryCatalog;
      if (!prevBestiary.monsters[monsterId]) return;
      const monsters = { ...prevBestiary.monsters };
      delete monsters[monsterId];
      const nextCatalog: BestiaryCatalog = { monsters };
      set({ bestiaryCatalog: nextCatalog });
      saveBestiaryCatalog(nextCatalog).catch((e) =>
        console.error('Erro ao salvar bestiário:', e)
      );
    },

    importBestiary: async (monsters) => {
      const prevBestiary = get().bestiaryCatalog;
      const merged = { ...prevBestiary.monsters };
      let count = 0;
      for (const mon of monsters) {
        if (!mon || !mon.id) continue;
        merged[mon.id] = mon;
        count += 1;
      }
      const nextCatalog: BestiaryCatalog = { monsters: merged };
      set({ bestiaryCatalog: nextCatalog });
      await saveBestiaryCatalog(nextCatalog);
      return count;
    },

    summonMonsterOnBoard: async (monsterId) => {
      const monstro = get().bestiaryCatalog.monsters[monsterId];
      if (!monstro) {
        get().showToast('Monstro não encontrado no Bestiário.');
        return null;
      }

      const prev = get().appState;
      const bundle = converterMonstroParaTabuleiro(monstro);

      const nextWeapons = { ...prev.weapons };
      const nextAttacks = { ...prev.attacks };
      for (const atk of bundle.attacks) nextAttacks[atk.id] = atk;
      for (const wp of bundle.weapons) nextWeapons[wp.id] = wp;

      const nextState: AppState = {
        ...prev,
        characters: {
          ...prev.characters,
          [bundle.character.id]: bundle.character,
        },
        weapons: nextWeapons,
        attacks: nextAttacks,
      };

      set({ appState: nextState, selectedCharacterId: bundle.character.id });
      persistCurrent(nextState);

      const colocado = get().autoPlaceCharacter(bundle.character.id);
      get().showToast(
        colocado
          ? `${monstro.nome} invocado (${bundle.perfil.faixaAmeaca}) — ${bundle.perfil.vida} PV, ${bundle.perfil.movimento} de movimento.`
          : `${monstro.nome} adicionado à reserva (tabuleiro sem espaço livre).`
      );
      return bundle.character.id;
    },

    // ===== Mapas & Escadas (Glossário -> Locais -> Mapas) =====
    refreshMaps: async () => {
      const catalog = await loadOrSeedMapCatalog(
        get().appState.board,
        get().appState.matchName
      );
      const activeMapId =
        get().activeMapId && catalog.maps[get().activeMapId as string]
          ? get().activeMapId
          : get().appState.board.id && catalog.maps[get().appState.board.id]
          ? get().appState.board.id
          : catalog.defaultMapId ?? Object.keys(catalog.maps)[0] ?? null;

      set({ mapCatalog: catalog, activeMapId });
    },

    upsertMap: (mapa) => {
      const prevCatalog = get().mapCatalog;
      const existente = prevCatalog.maps[mapa.id];
      const normalizado: GameMap = {
        ...mapa,
        criadoEm: existente ? existente.criadoEm : mapa.criadoEm || Date.now(),
        atualizadoEm: Date.now(),
      };
      const nextCatalog: MapCatalog = {
        ...prevCatalog,
        maps: { ...prevCatalog.maps, [mapa.id]: normalizado },
        defaultMapId: prevCatalog.defaultMapId ?? mapa.id,
      };
      set({ mapCatalog: nextCatalog });
      saveMapCatalog(nextCatalog).catch((e) =>
        console.error('Erro ao salvar mapas:', e)
      );

      // Se o mapa editado é o mapa ativo, refletir terreno/dimensões no tabuleiro
      if (get().activeMapId === mapa.id) {
        const prevState = get().appState;
        const board = prevState.board;
        const dimsMudaram =
          board.width !== normalizado.largura ||
          board.height !== normalizado.altura;
        const terrenoMudou =
          JSON.stringify(board.terrain) !== JSON.stringify(normalizado.terrain);

        const presetMudou =
          prevState.settings.fogMode !== normalizado.fog.mode ||
          prevState.settings.fogGlobalRange !== normalizado.fog.range ||
          prevState.settings.fogLocked !== normalizado.fog.locked;

        if (dimsMudaram || terrenoMudou || presetMudou) {
          const novoBoard: Board = {
            id: normalizado.id,
            width: normalizado.largura,
            height: normalizado.altura,
            terrain: { ...normalizado.terrain },
          };
          const personagens = { ...prevState.characters };
          for (const [cid, ch] of Object.entries(personagens)) {
            if (
              ch.position &&
              (ch.position.x >= novoBoard.width ||
                ch.position.y >= novoBoard.height)
            ) {
              personagens[cid] = { ...ch, position: null };
            }
          }
          const proximoEstado: AppState = {
            ...prevState,
            board: novoBoard,
            characters: personagens,
            settings: {
              ...prevState.settings,
              fogMode: normalizado.fog.mode,
              fogGlobalRange: normalizado.fog.range,
              fogLocked: normalizado.fog.locked,
            },
            lastAttack: null,
          };
          set({ appState: proximoEstado });
          persistCurrent(proximoEstado);
        }
      }
    },

    deleteMap: (mapId) => {
      const prevCatalog = get().mapCatalog;
      if (!prevCatalog.maps[mapId]) return;

      const maps = { ...prevCatalog.maps };
      delete maps[mapId];

      // Limpa ligações de escadas que apontavam para o mapa removido
      for (const [id, mapa] of Object.entries(maps)) {
        if (!mapa.stairs.some((st) => st.targetMapId === mapId)) continue;
        maps[id] = {
          ...mapa,
          stairs: mapa.stairs.map((st) =>
            st.targetMapId === mapId
              ? { ...st, targetMapId: null, targetStairId: null }
              : st
          ),
        };
      }

      const nextCatalog: MapCatalog = {
        maps,
        defaultMapId:
          prevCatalog.defaultMapId === mapId
            ? Object.keys(maps)[0] ?? null
            : prevCatalog.defaultMapId,
      };

      set({
        mapCatalog: nextCatalog,
        activeMapId: get().activeMapId === mapId ? null : get().activeMapId,
      });
      saveMapCatalog(nextCatalog).catch((e) =>
        console.error('Erro ao salvar mapas:', e)
      );
    },

    duplicateMap: (mapId) => {
      const prevCatalog = get().mapCatalog;
      const origem = prevCatalog.maps[mapId];
      if (!origem) return null;

      const novoId = `map_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const copia: GameMap = {
        ...origem,
        id: novoId,
        nome: `${origem.nome} (Cópia)`,
        terrain: { ...origem.terrain },
        fog: { ...origem.fog },
        stairs: origem.stairs.map((st) => ({
          ...st,
          id: gerarStairId(),
          targetMapId: null,
          targetStairId: null,
        })),
        placements: {},
        criadoEm: Date.now(),
        atualizadoEm: Date.now(),
      };

      const nextCatalog: MapCatalog = {
        ...prevCatalog,
        maps: { ...prevCatalog.maps, [novoId]: copia },
      };
      set({ mapCatalog: nextCatalog });
      saveMapCatalog(nextCatalog).catch((e) =>
        console.error('Erro ao salvar mapas:', e)
      );
      return novoId;
    },

    setDefaultMap: (mapId) => {
      const prevCatalog = get().mapCatalog;
      if (!prevCatalog.maps[mapId]) return;
      const nextCatalog: MapCatalog = { ...prevCatalog, defaultMapId: mapId };
      set({ mapCatalog: nextCatalog });
      saveMapCatalog(nextCatalog).catch((e) =>
        console.error('Erro ao salvar mapas:', e)
      );
    },

    switchMap: (mapId, opts = {}) => {
      const catalog = get().mapCatalog;
      const destino = catalog.maps[mapId];
      if (!destino) {
        get().showToast('Mapa de destino não encontrado.');
        return false;
      }

      const prev = get().appState;
      const origemId = get().activeMapId;
      if (origemId === mapId) return true;

      // 1) Guarda o estado do tabuleiro atual no mapa de origem
      const nextMaps = { ...catalog.maps };
      if (origemId && nextMaps[origemId]) {
        const atual = nextMaps[origemId];
        const placements: Record<string, { x: number; y: number }> = {};
        for (const ch of Object.values(prev.characters)) {
          if (ch.position) placements[ch.id] = { ...ch.position };
        }
        nextMaps[origemId] = {
          ...atual,
          largura: prev.board.width,
          altura: prev.board.height,
          terrain: { ...prev.board.terrain },
          placements,
          atualizadoEm: Date.now(),
        };
      }

      // 2) Novo tabuleiro a partir do mapa de destino
      const novoBoard = boardDoMapa(destino);

      // 3) Reposiciona as unidades conforme as posições guardadas no destino
      const novosPersonagens: Record<string, Character> = {};
      for (const [cid, ch] of Object.entries(prev.characters)) {
        const guardada = destino.placements?.[cid] ?? null;
        let pos: GridPoint | null = guardada;
        if (pos) {
          const livre = canPlaceCharacter(
            novoBoard,
            novosPersonagens as Record<string, Character>,
            pos,
            ch.width,
            ch.height,
            cid
          );
          if (!livre) pos = null;
        }
        novosPersonagens[cid] = { ...ch, position: pos };
      }

      // 4) Unidade que usou a escada chega à escada de chegada
      let personagemChegou: Character | null = null;
      if (opts.characterId) {
        const ch = novosPersonagens[opts.characterId];
        if (ch) {
          const alvo = resolverChegada(
            destino,
            origemId,
            opts.arrivalStairId ?? null
          );
          let pos: GridPoint | null = null;
          if (alvo) {
            if (
              canPlaceCharacter(
                novoBoard,
                novosPersonagens,
                alvo,
                ch.width,
                ch.height,
                ch.id
              )
            ) {
              pos = alvo;
            } else {
              pos = primeiraCelulaLivre(novoBoard, novosPersonagens, ch, alvo);
            }
          } else {
            pos = primeiraCelulaLivre(novoBoard, novosPersonagens, ch, {
              x: 0,
              y: 0,
            });
          }
          novosPersonagens[ch.id] = { ...ch, position: pos };
          personagemChegou = novosPersonagens[ch.id];
        }
      }

      // 5) Preset de visão do mapa (trancado no modo de jogo, se configurado)
      const novoEstado: AppState = {
        ...prev,
        board: novoBoard,
        characters: novosPersonagens,
        settings: {
          ...prev.settings,
          fogMode: destino.fog.mode,
          fogGlobalRange: destino.fog.range,
          fogLocked: destino.fog.locked,
        },
        lastAttack: null,
      };

      set({
        appState: novoEstado,
        activeMapId: mapId,
        mapCatalog: { ...catalog, maps: nextMaps },
        attackTargeting: null,
        movementModeCharacterId: null,
        selectedCharacterId: personagemChegou
          ? personagemChegou.id
          : get().selectedCharacterId,
      });

      persistCurrent(novoEstado);
      saveMapCatalog({ ...catalog, maps: nextMaps }).catch((e) =>
        console.error('Erro ao salvar mapas:', e)
      );

      if (!opts.silent) {
        const unidade = opts.characterId
          ? prev.characters[opts.characterId]?.name
          : null;
        get().showToast(
          unidade
            ? `${unidade} passou para "${destino.nome}".`
            : `Mapa ativo: "${destino.nome}".`
        );
      }
      return true;
    },

    syncActiveMapFromBoard: () => {
      const mapId = get().activeMapId;
      const catalog = get().mapCatalog;
      if (!mapId || !catalog.maps[mapId]) return;

      const prev = get().appState;
      const atual = catalog.maps[mapId];
      const placements: Record<string, { x: number; y: number }> = {};
      for (const ch of Object.values(prev.characters)) {
        if (ch.position) placements[ch.id] = { ...ch.position };
      }

      const atualizado: GameMap = {
        ...atual,
        largura: prev.board.width,
        altura: prev.board.height,
        terrain: { ...prev.board.terrain },
        placements,
        atualizadoEm: Date.now(),
      };
      if (
        atual.largura === atualizado.largura &&
        atual.altura === atualizado.altura &&
        JSON.stringify(atual.terrain) === JSON.stringify(atualizado.terrain)
      ) {
        return;
      }

      const nextCatalog: MapCatalog = {
        ...catalog,
        maps: { ...catalog.maps, [mapId]: atualizado },
      };
      set({ mapCatalog: nextCatalog });
      saveMapCatalog(nextCatalog).catch((e) =>
        console.error('Erro ao salvar mapas:', e)
      );
    },

    saveFichaRecord: async (ficha, syncLinkedBoardChars = true) => {
      const prevFicha = get().fichasList.find((f) => f.id === ficha.id) || null;
      const saved = await saveFicha(ficha);
      const fichas = await listFichas();
      set({ fichasList: fichas });

      if (syncLinkedBoardChars) {
        const prev = get().appState;
        const arsenal = get().arsenalCatalog;
        const linkedEntries = Object.values(prev.characters).filter(
          (c) => c.fichaId === saved.id
        );
        if (linkedEntries.length > 0) {
          const nextChars = { ...prev.characters };
          const nextWeapons = { ...arsenal.weapons, ...prev.weapons };
          const nextAttacks = { ...arsenal.attacks, ...prev.attacks };

          const managedMochilaSet = new Set<string>([
            ...(prevFicha?.mochilaArmasIds || []),
            ...(saved.mochilaArmasIds || []),
            ...(prevFicha?.armaEquipadaId ? [prevFicha.armaEquipadaId] : []),
            ...(saved.armaEquipadaId ? [saved.armaEquipadaId] : []),
          ]);

          for (const existing of linkedEntries) {
            const bundle = converterFichaParaTabuleiro(saved, {
              existingCharacterId: existing.id,
              width: existing.width,
              height: existing.height,
              arsenalCatalog: arsenal,
            });
            for (const atk of bundle.attacks) {
              nextAttacks[atk.id] = atk;
            }
            for (const wp of bundle.weapons) {
              nextWeapons[wp.id] = wp;
            }
            // Mantém armas extras atribuídas diretamente no Tabuleiro, mas substitui armas geridas pela Mochila
            const bundleIds = new Set(bundle.weapons.map((w) => w.id));
            const customWeaponIds = existing.weaponIds.filter(
              (wid) =>
                !wid.startsWith('wp_ep_') &&
                !managedMochilaSet.has(wid) &&
                !bundleIds.has(wid)
            );
            nextChars[existing.id] = {
              ...bundle.character,
              position: existing.position,
              facing: existing.facing,
              imageId:
                saved.avatarImageId ||
                existing.imageId ||
                bundle.character.imageId,
              weaponIds: [
                ...bundle.weapons.map((w) => w.id),
                ...customWeaponIds,
              ],
            };
          }

          const nextState: AppState = {
            ...prev,
            characters: nextChars,
            weapons: nextWeapons,
            attacks: nextAttacks,
          };
          set({ appState: nextState });
          persistCurrent(nextState);
        }
      }

      return saved;
    },

    deleteFichaRecord: async (fichaId) => {
      await deleteFicha(fichaId);
      const fichas = await listFichas();
      set({ fichasList: fichas });
    },

    spawnOrSyncFichaOnBoard: async (fichaId, opts = {}) => {
      const ficha = await getFicha(fichaId);
      if (!ficha) {
        get().showToast('Ficha não encontrada no banco local.');
        return null;
      }

      const prev = get().appState;
      const arsenal = get().arsenalCatalog;
      const existingLinked =
        opts.updateExisting !== false
          ? Object.values(prev.characters).find((c) => c.fichaId === ficha.id)
          : undefined;

      const charId = existingLinked?.id || uid('char_ep');
      const bundle = converterFichaParaTabuleiro(ficha, {
        existingCharacterId: charId,
        width: opts.width ?? existingLinked?.width ?? 1,
        height: opts.height ?? existingLinked?.height ?? 1,
        metrosPorQuadrado: opts.metrosPorQuadrado ?? 5,
        arsenalCatalog: arsenal,
      });

      const nextWeapons = { ...arsenal.weapons, ...prev.weapons };
      const nextAttacks = { ...arsenal.attacks, ...prev.attacks };
      for (const atk of bundle.attacks) {
        nextAttacks[atk.id] = atk;
      }
      for (const wp of bundle.weapons) {
        nextWeapons[wp.id] = wp;
      }

      const mochilaSet = new Set(ficha.mochilaArmasIds || []);
      const bundleIds = new Set(bundle.weapons.map((w) => w.id));
      const preservedCustomWeapons = existingLinked
        ? existingLinked.weaponIds.filter(
            (wid) =>
              !wid.startsWith('wp_ep_') &&
              !mochilaSet.has(wid) &&
              !bundleIds.has(wid)
          )
        : [];

      const mergedChar: Character = {
        ...bundle.character,
        position: existingLinked ? existingLinked.position : null,
        facing: existingLinked ? existingLinked.facing : Direction.East,
        weaponIds: [
          ...bundle.weapons.map((w) => w.id),
          ...preservedCustomWeapons,
        ],
      };

      const nextState: AppState = {
        ...prev,
        characters: {
          ...prev.characters,
          [charId]: mergedChar,
        },
        weapons: nextWeapons,
        attacks: nextAttacks,
      };

      set({
        appState: nextState,
        selectedCharacterId: charId,
      });
      persistCurrent(nextState);

      if ((opts.placeOnBoard ?? true) && !mergedChar.position) {
        get().autoPlaceCharacter(charId);
      }

      get().showToast(
        existingLinked
          ? `Ficha "${mergedChar.name}" sincronizada no Tabuleiro!`
          : `"${mergedChar.name}" enviado ao Tabuleiro com armas e magias!`
      );
      return charId;
    },

    adjustCharacterEpitomeResource: async (characterId, resource, delta) => {
      const ch = get().appState.characters[characterId];
      if (!ch || !ch.fichaId) return;
      const ficha = await getFicha(ch.fichaId);
      if (!ficha) return;

      const stats = calcularFicha(ficha);
      const nextEstado = { ...ficha._estado };

      if (resource === 'estamina') {
        if (delta < 0) {
          // Respeita o limite de gasto por ação do Spiritual-Epitome
          const gasto = Math.min(Math.abs(delta), stats.estaminaMaxGasto);
          nextEstado.estaminaAtual = Math.max(0, stats.estaminaAtual - gasto);
        } else {
          nextEstado.estaminaAtual = Math.min(
            stats.estaminaTotal,
            stats.estaminaAtual + delta
          );
        }
      } else if (resource === 'raciocinio') {
        nextEstado.racAtual = Math.max(
          0,
          Math.min(stats.racTotal, stats.racAtual + delta)
        );
      }

      await get().saveFichaRecord(
        {
          ...ficha,
          _estado: nextEstado,
        },
        true
      );
    },

    sortInitiativeByAgility: () => {
      const prev = get().appState;
      const candidates =
        prev.combat.turnOrder.length > 0
          ? prev.combat.turnOrder
              .map((id) => prev.characters[id])
              .filter((c): c is Character => Boolean(c))
          : Object.values(prev.characters).filter((c) => c.position !== null);

      if (candidates.length === 0) {
        get().showToast('Posicione ou adicione unidades para ordenar a iniciativa.');
        return;
      }

      const sortedIds = [...candidates]
        .sort((a, b) => {
          const agiA = a.epitomeSummary?.agilidadeCombate ?? a.movement;
          const agiB = b.epitomeSummary?.agilidadeCombate ?? b.movement;
          if (agiB !== agiA) return agiB - agiA;
          return b.movement - a.movement;
        })
        .map((c) => c.id);

      const next: AppState = {
        ...prev,
        combat: {
          ...prev.combat,
          mode: 'turns',
          turnOrder: sortedIds,
          activeCharacterId: sortedIds[0] ?? null,
        },
      };
      set({ appState: next, selectedCharacterId: sortedIds[0] ?? null });
      persistCurrent(next);
      get().showToast('Iniciativa ordenada por Agilidade de Combate!');
    },

    // === Inicialização e Partidas ===
    initApp: async () => {
      await initializeAllPresetEmblems();
      await seedDefaultFichasIfEmpty();
      const [saved, fichas, est] = await Promise.all([
        getActiveMatchRecord(),
        listFichas(),
        checkStorageEstimate(),
      ]);

      const arsenal = await loadOrSeedArsenalCatalog(saved ? saved.state : null);
      const bestiary = await loadOrSeedBestiaryCatalog();
      const boardParaMapas = saved ? saved.state.board : createSampleEncounterState().board;
      const mapsCatalog = await loadOrSeedMapCatalog(
        boardParaMapas,
        saved ? saved.state.matchName : 'Ruínas Superiores'
      );

      if (saved) {
        const baseNorm = normalizeAppState(saved.state);
        const normalized: AppState = {
          ...baseNorm,
          weapons: { ...arsenal.weapons, ...baseNorm.weapons },
          attacks: { ...arsenal.attacks, ...baseNorm.attacks },
        };
        const firstCharId =
          normalized.combat.activeCharacterId ||
          Object.keys(normalized.characters)[0] ||
          null;
        const activeMapId =
          normalized.board.id && mapsCatalog.maps[normalized.board.id]
            ? normalized.board.id
            : mapsCatalog.defaultMapId ?? Object.keys(mapsCatalog.maps)[0] ?? null;

        // O mapa ativo manda no trancamento da visão (predefinição do mestre)
        const mapaAtivoInicial = activeMapId ? mapsCatalog.maps[activeMapId] : null;
        const estadoInicial: AppState = mapaAtivoInicial?.fog.locked
          ? {
              ...normalized,
              settings: {
                ...normalized.settings,
                fogMode: mapaAtivoInicial.fog.mode,
                fogGlobalRange: mapaAtivoInicial.fog.range,
                fogLocked: true,
              },
            }
          : normalized;

        set({
          initialized: true,
          activeMatchId: saved.id,
          appState: estadoInicial,
          arsenalCatalog: arsenal,
          bestiaryCatalog: bestiary,
          mapCatalog: mapsCatalog,
          activeMapId,
          fichasList: fichas,
          selectedCharacterId: firstCharId,
          storageEstimate: est,
        });
      } else {
        const sampleBase = createSampleEncounterState();
        const sample: AppState = {
          ...sampleBase,
          weapons: { ...arsenal.weapons, ...sampleBase.weapons },
          attacks: { ...arsenal.attacks, ...sampleBase.attacks },
        };
        const defaultId = 'match_default_001';
        await saveMatchRecord(defaultId, sample.matchName, sample);
        set({
          initialized: true,
          activeMatchId: defaultId,
          appState: sample,
          arsenalCatalog: arsenal,
          bestiaryCatalog: bestiary,
          mapCatalog: mapsCatalog,
          activeMapId:
            mapsCatalog.maps[sample.board.id]
              ? sample.board.id
              : mapsCatalog.defaultMapId,

          fichasList: fichas,
          selectedCharacterId: 'char_lyra',
          storageEstimate: est,
        });
      }
    },

    loadMatchState: async (matchId, name, newState) => {
      const arsenal = get().arsenalCatalog;
      const stateWithTitle: AppState = normalizeAppState({
        ...newState,
        matchName: name,
        weapons: { ...arsenal.weapons, ...newState.weapons },
        attacks: { ...arsenal.attacks, ...newState.attacks },
      });
      await saveMatchRecord(matchId, name, stateWithTitle);
      const est = await checkStorageEstimate();
      const firstId =
        stateWithTitle.combat.activeCharacterId ||
        Object.keys(stateWithTitle.characters)[0] ||
        null;
      set({
        activeMatchId: matchId,
        appState: stateWithTitle,
        selectedCharacterId: firstId,
        movementModeCharacterId: null,
        attackTargeting: null,
        activeTool: 'select',
        cameraResetNonce: get().cameraResetNonce + 1,
        storageEstimate: est,
      });
    },

    createNewMatch: async (name, width, height, useSample = false) => {
      const id = uid('match');
      const base = useSample
        ? { ...createSampleEncounterState(), matchName: name }
        : createBlankMatchState(name, width, height);
      await get().loadMatchState(id, name, base);
      get().showToast(`Partida "${name}" carregada.`);
    },

    setMatchName: (name) => {
      const next: AppState = { ...get().appState, matchName: name };
      set({ appState: next });
      persistCurrent(next);
    },

    showToast: (msg) => {
      set({ toastMessage: msg });
      setTimeout(() => {
        if (get().toastMessage === msg) {
          set({ toastMessage: null });
        }
      }, 3200);
    },

    refreshStorageEstimate: async () => {
      const est = await checkStorageEstimate();
      set({ storageEstimate: est });
    },

    // === UI & Câmera ===
    setSelectedCharacter: (id) => {
      set({
        selectedCharacterId: id,
        movementModeCharacterId: null,
        rightPanelOpen: id ? true : get().rightPanelOpen,
      });
    },

    setActiveTool: (tool) => {
      set({
        activeTool: tool,
        movementModeCharacterId: null,
        attackTargeting: null,
      });
    },

    enterMovementMode: (characterId) => {
      if (!characterId) {
        set({ movementModeCharacterId: null });
        return;
      }
      const ch = get().appState.characters[characterId];
      if (!ch || !ch.position) return;
      set({
        selectedCharacterId: characterId,
        movementModeCharacterId: characterId,
        attackTargeting: null,
        activeTool: 'select',
      });
    },

    cancelActiveModes: () => {
      const { movementModeCharacterId, attackTargeting, activeTool } = get();
      if (attackTargeting) {
        set({ attackTargeting: null });
        return;
      }
      if (movementModeCharacterId) {
        set({ movementModeCharacterId: null });
        return;
      }
      if (activeTool !== 'select') {
        set({ activeTool: 'select' });
        return;
      }
      set({ selectedCharacterId: null });
    },

    toggleLeftPanel: () => set({ leftPanelOpen: !get().leftPanelOpen }),
    toggleRightPanel: () => set({ rightPanelOpen: !get().rightPanelOpen }),
    setLeftTab: (tab) => set({ leftTab: tab, leftPanelOpen: true }),
    setShowZoneLegend: (show) => set({ showZoneLegend: show }),
    setCameraZoomPercent: (pct) => set({ cameraZoomPercent: Math.round(pct) }),
    triggerCameraReset: () =>
      set({ cameraResetNonce: get().cameraResetNonce + 1 }),
    triggerCameraZoomStep: (factor) =>
      set({
        zoomStepRequest: {
          factor,
          nonce: (get().zoomStepRequest?.nonce ?? 0) + 1,
        },
      }),

    // === Modais ===
    openCharacterModal: (editCharacterId = null) =>
      set({ characterModal: { open: true, editCharacterId } }),
    closeCharacterModal: () =>
      set({ characterModal: { open: false, editCharacterId: null } }),

    openArsenalModal: (focusWeaponId = null, equipToCharacterId = null) =>
      set({
        arsenalModal: { open: true, focusWeaponId, equipToCharacterId },
      }),
    closeArsenalModal: () =>
      set({
        arsenalModal: {
          open: false,
          focusWeaponId: null,
          equipToCharacterId: null,
        },
      }),

    openAttackEditorModal: (weaponId, editAttackId = null) =>
      set({
        attackEditorModal: { open: true, weaponId, editAttackId },
      }),
    closeAttackEditorModal: () =>
      set({
        attackEditorModal: { open: false, weaponId: null, editAttackId: null },
      }),

    openMatchesModal: (initialTab = 'matches') =>
      set({ matchesModal: { open: true, initialTab } }),
    closeMatchesModal: () =>
      set({ matchesModal: { open: false, initialTab: 'matches' } }),

    setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),

    // === Configurações e Tabuleiro ===
    updateSettings: (partial) => {
      const prev = get().appState;
      const next: AppState = {
        ...prev,
        settings: { ...prev.settings, ...partial },
      };
      set({ appState: next });
      persistCurrent(next);
    },

    // === Névoa de Visão (Exploração) — apenas visualização, não altera dados ===
    setFogMode: (mode) => {
      const prev = get().appState;
      if (prev.settings.fogLocked) {
        get().showToast(
          'A visão deste mapa vem da predefinição do mapa. Altera-a em Glossário → Locais → Mapas.'
        );
        return;
      }
      const next: AppState = {
        ...prev,
        settings: { ...prev.settings, fogMode: mode },
      };
      set({ appState: next });
      persistCurrent(next);
      get().showToast(
        mode === 'exploration'
          ? 'Modo Exploração ativo — visão limitada à unidade selecionada.'
          : 'Modo Dia ativo — mapa totalmente visível.'
      );
    },

    setFogRangeMode: (mode) => {
      const prev = get().appState;
      const next: AppState = {
        ...prev,
        settings: { ...prev.settings, fogRangeMode: mode },
      };
      set({ appState: next });
      persistCurrent(next);
    },

    setFogGlobalRange: (range) => {
      const prev = get().appState;
      if (prev.settings.fogLocked) return;
      const value = Math.max(1, Math.min(40, Math.round(range) || 8));
      const next: AppState = {
        ...prev,
        settings: { ...prev.settings, fogGlobalRange: value },
      };
      set({ appState: next });
      persistCurrent(next);
    },

    setFogIntensity: (intensity) => {
      const prev = get().appState;
      const value = Math.max(0.35, Math.min(1, Number(intensity) || 1));
      const next: AppState = {
        ...prev,
        settings: { ...prev.settings, fogIntensity: value },
      };
      set({ appState: next });
      persistCurrent(next);
    },

    setCharacterVisionRange: (characterId, range) => {
      const prev = get().appState;
      const ch = prev.characters[characterId];
      if (!ch) return;

      const valor =
        range === null || !Number.isFinite(Number(range))
          ? null
          : Math.max(1, Math.min(40, Math.round(Number(range))));

      const next: AppState = {
        ...prev,
        characters: {
          ...prev.characters,
          [characterId]: { ...ch, visionRange: valor },
        },
      };
      set({ appState: next });
      persistCurrent(next);
    },

    resizeBoard: (width, height) => {
      const w = Math.max(4, Math.min(80, Math.round(width)));
      const h = Math.max(4, Math.min(80, Math.round(height)));
      const prev = get().appState;

      const nextChars: Record<string, Character> = {};
      for (const [id, ch] of Object.entries(prev.characters)) {
        if (
          ch.position &&
          (ch.position.x + ch.width > w || ch.position.y + ch.height > h)
        ) {
          nextChars[id] = { ...ch, position: null };
        } else {
          nextChars[id] = ch;
        }
      }

      const nextTerrain: Record<string, TerrainType> = {};
      for (const [k, t] of Object.entries(prev.board.terrain)) {
        const [xs, ys] = k.split(',');
        const x = Number(xs);
        const y = Number(ys);
        if (x >= 0 && y >= 0 && x < w && y < h) {
          nextTerrain[k] = t;
        }
      }

      let nextLastAttack = cloneLastAttack(prev.lastAttack ?? null);
      if (nextLastAttack) {
        const insideCells = nextLastAttack.cells.filter(
          (c) => c.x >= 0 && c.y >= 0 && c.x < w && c.y < h
        );
        const originInside =
          nextLastAttack.targetOrigin.x >= 0 &&
          nextLastAttack.targetOrigin.x < w &&
          nextLastAttack.targetOrigin.y >= 0 &&
          nextLastAttack.targetOrigin.y < h;
        nextLastAttack =
          insideCells.length > 0 && originInside
            ? { ...nextLastAttack, cells: insideCells }
            : null;
      }

      const next: AppState = {
        ...prev,
        board: { ...prev.board, width: w, height: h, terrain: nextTerrain },
        characters: nextChars,
        lastAttack: nextLastAttack,
      };
      set({ appState: next });
      persistCurrent(next);
    },

    applyTerrainChanges: (changes) => {
      const prev = get().appState;
      const inverseChanges: Record<string, TerrainType> = {};
      let diffCount = 0;

      for (const [k, nextType] of Object.entries(changes)) {
        const currentType = prev.board.terrain[k] ?? 'normal';
        if (currentType === nextType) continue;
        if (nextType === 'impassable') {
          const [xs, ys] = k.split(',');
          const cx = Number(xs);
          const cy = Number(ys);
          let occupied = false;
          for (const ch of Object.values(prev.characters)) {
            if (!ch.position) continue;
            if (
              cx >= ch.position.x &&
              cx < ch.position.x + ch.width &&
              cy >= ch.position.y &&
              cy < ch.position.y + ch.height
            ) {
              occupied = true;
              break;
            }
          }
          if (occupied) continue;
        }
        inverseChanges[k] = currentType;
        diffCount++;
      }

      if (diffCount === 0) return;

      const forwardFiltered: Record<string, TerrainType> = {};
      for (const k of Object.keys(inverseChanges)) {
        forwardFiltered[k] = changes[k];
      }

      const action: Action = {
        id: uid('act'),
        type: 'TERRAIN_BATCH',
        timestamp: Date.now(),
        description: `Terreno alterado (${diffCount} quadrado${
          diffCount > 1 ? 's' : ''
        })`,
        data: { changes: forwardFiltered },
        inverse: { changes: inverseChanges },
      };

      const next = executeCommand(prev, action);
      set({ appState: next });
      persistCurrent(next);
    },

    // === Personagens ===
    upsertCharacter: (char) => {
      const prev = get().appState;
      let finalPos = char.position;
      if (
        finalPos &&
        !canPlaceCharacter(
          prev.board,
          prev.characters,
          finalPos,
          char.width,
          char.height,
          char.id
        )
      ) {
        finalPos = null;
      }

      const normalized: Character = {
        ...char,
        hpCurrent: Math.max(0, Math.min(char.hpMax, char.hpCurrent)),
        position: finalPos,
      };

      const next: AppState = {
        ...prev,
        characters: {
          ...prev.characters,
          [normalized.id]: normalized,
        },
      };
      set({ appState: next, selectedCharacterId: normalized.id });
      persistCurrent(next);
      if (normalized.fichaId) {
        syncBoardHpToFichas(next, [normalized.id]);
      }
    },

    duplicateCharacter: (characterId) => {
      const prev = get().appState;
      const src = prev.characters[characterId];
      if (!src) return;
      const newId = uid('char');
      let newPos: GridPoint | null = null;

      if (src.position) {
        for (let radius = 1; radius <= 4 && !newPos; radius++) {
          for (let dy = -radius; dy <= radius && !newPos; dy++) {
            for (let dx = -radius; dx <= radius && !newPos; dx++) {
              const cand = { x: src.position.x + dx, y: src.position.y + dy };
              if (
                canPlaceCharacter(
                  prev.board,
                  prev.characters,
                  cand,
                  src.width,
                  src.height
                )
              ) {
                newPos = cand;
              }
            }
          }
        }
      }

      const copy: Character = {
        ...src,
        id: newId,
        name: `${src.name} (Cópia)`,
        weaponIds: [...src.weaponIds],
        position: newPos,
        // Cópia desvincula `fichaId` para não sobrescrever o HP da ficha original
        fichaId: undefined,
      };

      const next: AppState = {
        ...prev,
        characters: { ...prev.characters, [newId]: copy },
      };
      set({ appState: next, selectedCharacterId: newId });
      persistCurrent(next);
      get().showToast(`Personagem "${copy.name}" duplicado.`);
    },

    deleteCharacter: (characterId) => {
      const prev = get().appState;
      if (!prev.characters[characterId]) return;
      const nextChars = { ...prev.characters };
      const removedName = nextChars[characterId].name;
      delete nextChars[characterId];

      const nextTurnOrder = prev.combat.turnOrder.filter(
        (id) => id !== characterId
      );
      const nextActive =
        prev.combat.activeCharacterId === characterId
          ? nextTurnOrder[0] ?? null
          : prev.combat.activeCharacterId;

      const next: AppState = {
        ...prev,
        characters: nextChars,
        combat: {
          ...prev.combat,
          turnOrder: nextTurnOrder,
          activeCharacterId: nextActive,
        },
      };
      set({
        appState: next,
        selectedCharacterId:
          get().selectedCharacterId === characterId
            ? null
            : get().selectedCharacterId,
        movementModeCharacterId:
          get().movementModeCharacterId === characterId
            ? null
            : get().movementModeCharacterId,
      });
      persistCurrent(next);
      get().showToast(`"${removedName}" excluído.`);
    },

    placeCharacter: (characterId, pos) => {
      const prev = get().appState;
      const ch = prev.characters[characterId];
      if (!ch) return false;
      if (
        !canPlaceCharacter(
          prev.board,
          prev.characters,
          pos,
          ch.width,
          ch.height,
          characterId
        )
      ) {
        return false;
      }

      const action: Action = {
        id: uid('act'),
        type: ch.position ? 'MOVE' : 'PLACE_CHARACTER',
        timestamp: Date.now(),
        description: ch.position
          ? `${ch.name} movido de (${ch.position.x},${ch.position.y}) para (${pos.x},${pos.y})`
          : `${ch.name} posicionado em (${pos.x},${pos.y})`,
        data: { characterId, position: { x: pos.x, y: pos.y } },
        inverse: {
          characterId,
          position: ch.position ? { ...ch.position } : null,
        },
      };

      const next = executeCommand(prev, action);
      set({
        appState: next,
        selectedCharacterId: characterId,
        movementModeCharacterId: null,
      });
      persistCurrent(next);

      // Escadas: ao pisar uma escada ligada, muda automaticamente de mapa
      const mapaAtivo = get().activeMapId
        ? get().mapCatalog.maps[get().activeMapId as string] ?? null
        : null;
      const escada = escadaSobUnidade(mapaAtivo, next.characters[characterId]);
      if (escada && escada.targetMapId) {
        if (get().mapCatalog.maps[escada.targetMapId]) {
          get().switchMap(escada.targetMapId as string, {
            characterId,
            arrivalStairId: escada.targetStairId,
          });
        } else {
          get().showToast(
            'Esta escada aponta para um mapa que já não existe. Liga-a novamente no Glossário → Locais → Mapas.'
          );
        }
      }
      return true;
    },

    autoPlaceCharacter: (characterId) => {
      const prev = get().appState;
      const ch = prev.characters[characterId];
      if (!ch) return false;

      for (let y = 0; y <= prev.board.height - ch.height; y++) {
        for (let x = 0; x <= prev.board.width - ch.width; x++) {
          if (
            canPlaceCharacter(
              prev.board,
              prev.characters,
              { x, y },
              ch.width,
              ch.height,
              characterId
            )
          ) {
            return get().placeCharacter(characterId, { x, y });
          }
        }
      }
      get().showToast(
        'Não há área livre suficiente no tabuleiro para esta criatura.'
      );
      return false;
    },

    removeCharacterFromBoard: (characterId) => {
      const prev = get().appState;
      const ch = prev.characters[characterId];
      if (!ch || !ch.position) return;

      const action: Action = {
        id: uid('act'),
        type: 'REMOVE_CHARACTER',
        timestamp: Date.now(),
        description: `${ch.name} removido do tabuleiro`,
        data: { characterId, position: null },
        inverse: { characterId, position: { ...ch.position } },
      };

      const next = executeCommand(prev, action);
      set({
        appState: next,
        movementModeCharacterId:
          get().movementModeCharacterId === characterId
            ? null
            : get().movementModeCharacterId,
      });
      persistCurrent(next);
    },

    moveCharacter: (characterId, to) => {
      const prev = get().appState;
      const ch = prev.characters[characterId];
      if (!ch || !ch.position) return false;
      if (ch.position.x === to.x && ch.position.y === to.y) {
        set({ movementModeCharacterId: null });
        return true;
      }
      return get().placeCharacter(characterId, to);
    },

    rotateCharacter: (characterId, facing) => {
      const prev = get().appState;
      const ch = prev.characters[characterId];
      if (!ch || ch.facing === facing) return;

      // A orientação segue o cursor (8 direções) e pode mudar dezenas de vezes
      // enquanto se move o mouse pelo tabuleiro. Não é uma jogada: fica fora
      // do histórico para não encher o Log nem poluir o Desfazer/Refazer.
      const next: AppState = {
        ...prev,
        characters: {
          ...prev.characters,
          [characterId]: { ...ch, facing },
        },
      };

      set({ appState: next });
      persistCurrent(next);
    },

    applyDamage: (characterId, amount) => {
      const dmg = Math.max(0, Math.round(amount));
      if (dmg <= 0) return;
      const prev = get().appState;
      const ch = prev.characters[characterId];
      if (!ch) return;
      const newHp = Math.max(0, ch.hpCurrent - dmg);

      const action: Action = {
        id: uid('act'),
        type: 'DAMAGE',
        timestamp: Date.now(),
        description: `${ch.name} sofreu ${dmg} de dano (${ch.hpCurrent} → ${newHp} HP)`,
        data: { characterId, hp: newHp, amount: dmg },
        inverse: { characterId, hp: ch.hpCurrent },
      };

      const next = executeCommand(prev, action);
      set({ appState: next });
      persistCurrent(next);
      syncBoardHpToFichas(next, [characterId]);
    },

    applyHeal: (characterId, amount) => {
      const heal = Math.max(0, Math.round(amount));
      if (heal <= 0) return;
      const prev = get().appState;
      const ch = prev.characters[characterId];
      if (!ch) return;
      const newHp = Math.min(ch.hpMax, ch.hpCurrent + heal);

      const action: Action = {
        id: uid('act'),
        type: 'HEAL',
        timestamp: Date.now(),
        description: `${ch.name} recuperou ${heal} de vida (${ch.hpCurrent} → ${newHp} HP)`,
        data: { characterId, hp: newHp, amount: heal },
        inverse: { characterId, hp: ch.hpCurrent },
      };

      const next = executeCommand(prev, action);
      set({ appState: next });
      persistCurrent(next);
      syncBoardHpToFichas(next, [characterId]);
    },

    setCharacterHpDirect: (characterId, hp) => {
      const prev = get().appState;
      const ch = prev.characters[characterId];
      if (!ch) return;
      const clamped = Math.max(0, Math.min(ch.hpMax, Math.round(hp)));
      if (clamped === ch.hpCurrent) return;

      const action: Action = {
        id: uid('act'),
        type: 'SET_HP',
        timestamp: Date.now(),
        description: `HP de ${ch.name} ajustado (${ch.hpCurrent} → ${clamped})`,
        data: { characterId, hp: clamped },
        inverse: { characterId, hp: ch.hpCurrent },
      };

      const next = executeCommand(prev, action);
      set({ appState: next });
      persistCurrent(next);
      syncBoardHpToFichas(next, [characterId]);
    },

    toggleEquipWeapon: (characterId, weaponId) => {
      const prev = get().appState;
      const ch = prev.characters[characterId];
      if (!ch || !prev.weapons[weaponId]) return;
      const has = ch.weaponIds.includes(weaponId);
      const nextWeaponIds = has
        ? ch.weaponIds.filter((id) => id !== weaponId)
        : [...ch.weaponIds, weaponId];

      const next: AppState = {
        ...prev,
        characters: {
          ...prev.characters,
          [characterId]: { ...ch, weaponIds: nextWeaponIds },
        },
      };
      set({ appState: next });
      persistCurrent(next);
    },

    saveCharacterAsTemplate: async (characterId) => {
      const ch = get().appState.characters[characterId];
      if (!ch) return;
      const { id: _id, position: _pos, ...rest } = ch;
      await saveCharacterTemplate({
        id: uid('ctpl'),
        name: ch.name,
        createdAt: Date.now(),
        character: rest,
      });
      get().showToast(`Modelo "${ch.name}" salvo na biblioteca!`);
    },

    // === Armas e Ataques (Sincronizados com o Arsenal Global do Glossário) ===
    upsertWeapon: (weapon) => {
      const prev = get().appState;
      const prevArsenal = get().arsenalCatalog;
      const isArsenalWp = !weapon.id.startsWith('wp_ep_');

      const nextArsenal: ArsenalCatalog = isArsenalWp
        ? {
            weapons: { ...prevArsenal.weapons, [weapon.id]: weapon },
            attacks: { ...prevArsenal.attacks },
          }
        : prevArsenal;

      const next: AppState = {
        ...prev,
        weapons: { ...prev.weapons, [weapon.id]: weapon },
      };
      set({ appState: next, arsenalCatalog: nextArsenal });
      persistCurrent(next);

      if (isArsenalWp) {
        saveArsenalCatalog(nextArsenal).catch((e) =>
          console.error('Erro ao salvar Arsenal no Glossário:', e)
        );
        // Sincroniza fichas que tenham esta arma equipada na Mochila
        const affectedFichas = get().fichasList.filter(
          (f) => f.armaEquipadaId === weapon.id
        );
        if (affectedFichas.length > 0) {
          Promise.all(
            affectedFichas.map((f) =>
              saveFicha(equiparArmaDoArsenalNaFicha(f, weapon))
            )
          )
            .then(() => listFichas())
            .then((fichas) => set({ fichasList: fichas }))
            .catch(() => {});
        }
      }
    },

    duplicateWeapon: (weaponId) => {
      const prev = get().appState;
      const prevArsenal = get().arsenalCatalog;
      const src = prevArsenal.weapons[weaponId] || prev.weapons[weaponId];
      if (!src) return;

      const nextAttacks = { ...prev.attacks };
      const nextArsenalAttacks = { ...prevArsenal.attacks };
      const clonedAttackIds: string[] = [];
      for (const atkId of src.attackIds) {
        const origAtk = prevArsenal.attacks[atkId] || prev.attacks[atkId];
        if (!origAtk) continue;
        const newAtkId = uid('atk');
        const clonedAtk: Attack = {
          ...origAtk,
          id: newAtkId,
          area: {
            origin: { ...origAtk.area.origin },
            cells: origAtk.area.cells.map((c) => ({ ...c })),
          },
          effects: [...origAtk.effects],
        };
        nextAttacks[newAtkId] = clonedAtk;
        nextArsenalAttacks[newAtkId] = clonedAtk;
        clonedAttackIds.push(newAtkId);
      }

      const newWeaponId = uid('wp');
      const copy: Weapon = {
        ...src,
        id: newWeaponId,
        name: `${src.name} (Cópia)`,
        attackIds: clonedAttackIds,
      };

      const nextArsenal: ArsenalCatalog = {
        weapons: { ...prevArsenal.weapons, [newWeaponId]: copy },
        attacks: nextArsenalAttacks,
      };

      const next: AppState = {
        ...prev,
        weapons: { ...prev.weapons, [newWeaponId]: copy },
        attacks: nextAttacks,
      };
      set({ appState: next, arsenalCatalog: nextArsenal });
      persistCurrent(next);
      saveArsenalCatalog(nextArsenal).catch((e) =>
        console.error('Erro ao salvar cópia no Arsenal:', e)
      );
      get().showToast(`Arma "${copy.name}" duplicada no Arsenal.`);
    },

    deleteWeapon: (weaponId) => {
      const prev = get().appState;
      const prevArsenal = get().arsenalCatalog;
      const targetWp = prevArsenal.weapons[weaponId] || prev.weapons[weaponId];
      if (!targetWp) return;

      const removedName = targetWp.name;
      const nextWeapons = { ...prev.weapons };
      delete nextWeapons[weaponId];

      const nextArsenalWeapons = { ...prevArsenal.weapons };
      delete nextArsenalWeapons[weaponId];
      const nextArsenal: ArsenalCatalog = {
        weapons: nextArsenalWeapons,
        attacks: { ...prevArsenal.attacks },
      };

      const nextChars: Record<string, Character> = {};
      for (const [id, ch] of Object.entries(prev.characters)) {
        nextChars[id] = {
          ...ch,
          weaponIds: ch.weaponIds.filter((wid) => wid !== weaponId),
        };
      }

      const next: AppState = {
        ...prev,
        weapons: nextWeapons,
        characters: nextChars,
      };
      set({ appState: next, arsenalCatalog: nextArsenal });
      persistCurrent(next);
      saveArsenalCatalog(nextArsenal).catch((e) =>
        console.error('Erro ao remover arma do Arsenal:', e)
      );

      // Remove a arma excluída das Mochilas das Fichas
      const affectedFichas = get().fichasList.filter(
        (f) =>
          f.mochilaArmasIds.includes(weaponId) || f.armaEquipadaId === weaponId
      );
      if (affectedFichas.length > 0) {
        Promise.all(
          affectedFichas.map((f) => {
            const filteredIds = f.mochilaArmasIds.filter(
              (id) => id !== weaponId
            );
            const cleaned =
              f.armaEquipadaId === weaponId
                ? {
                    ...equiparArmaDoArsenalNaFicha(f, null),
                    mochilaArmasIds: filteredIds,
                  }
                : { ...f, mochilaArmasIds: filteredIds };
            return saveFicha(cleaned);
          })
        )
          .then(() => listFichas())
          .then((fichas) => set({ fichasList: fichas }))
          .catch(() => {});
      }

      get().showToast(`Arma "${removedName}" excluída do Arsenal.`);
    },

    upsertAttack: (attack, linkToWeaponId = null) => {
      const prev = get().appState;
      const prevArsenal = get().arsenalCatalog;
      const nextWeapons = { ...prev.weapons };
      const nextArsenalWeapons = { ...prevArsenal.weapons };

      if (linkToWeaponId) {
        const wp =
          nextArsenalWeapons[linkToWeaponId] || nextWeapons[linkToWeaponId];
        if (wp) {
          const updatedWp: Weapon = wp.attackIds.includes(attack.id)
            ? wp
            : { ...wp, attackIds: [...wp.attackIds, attack.id] };
          nextWeapons[linkToWeaponId] = updatedWp;
          if (!linkToWeaponId.startsWith('wp_ep_')) {
            nextArsenalWeapons[linkToWeaponId] = updatedWp;
          }
        }
      }

      const isArsenalAtk = !attack.id.startsWith('atk_ep_');
      const nextArsenal: ArsenalCatalog = {
        weapons: nextArsenalWeapons,
        attacks: isArsenalAtk
          ? { ...prevArsenal.attacks, [attack.id]: attack }
          : prevArsenal.attacks,
      };

      const next: AppState = {
        ...prev,
        attacks: { ...prev.attacks, [attack.id]: attack },
        weapons: nextWeapons,
      };
      set({ appState: next, arsenalCatalog: nextArsenal });
      persistCurrent(next);
      if (isArsenalAtk) {
        saveArsenalCatalog(nextArsenal).catch((e) =>
          console.error('Erro ao salvar ataque no Arsenal:', e)
        );
      }
    },

    deleteAttack: (attackId, fromWeaponId) => {
      const prev = get().appState;
      const prevArsenal = get().arsenalCatalog;
      const nextWeapons = { ...prev.weapons };
      const nextArsenalWeapons = { ...prevArsenal.weapons };

      if (fromWeaponId) {
        if (nextWeapons[fromWeaponId]) {
          nextWeapons[fromWeaponId] = {
            ...nextWeapons[fromWeaponId],
            attackIds: nextWeapons[fromWeaponId].attackIds.filter(
              (id) => id !== attackId
            ),
          };
        }
        if (nextArsenalWeapons[fromWeaponId]) {
          nextArsenalWeapons[fromWeaponId] = {
            ...nextArsenalWeapons[fromWeaponId],
            attackIds: nextArsenalWeapons[fromWeaponId].attackIds.filter(
              (id) => id !== attackId
            ),
          };
        }
      } else {
        for (const [wid, wp] of Object.entries(nextWeapons)) {
          nextWeapons[wid] = {
            ...wp,
            attackIds: wp.attackIds.filter((id) => id !== attackId),
          };
        }
        for (const [wid, wp] of Object.entries(nextArsenalWeapons)) {
          nextArsenalWeapons[wid] = {
            ...wp,
            attackIds: wp.attackIds.filter((id) => id !== attackId),
          };
        }
      }

      const stillReferencedInBoard = Object.values(nextWeapons).some((wp) =>
        wp.attackIds.includes(attackId)
      );
      const stillReferencedInArsenal = Object.values(nextArsenalWeapons).some(
        (wp) => wp.attackIds.includes(attackId)
      );

      const nextAttacks = { ...prev.attacks };
      if (!stillReferencedInBoard) {
        delete nextAttacks[attackId];
      }

      const nextArsenalAttacks = { ...prevArsenal.attacks };
      if (!stillReferencedInArsenal) {
        delete nextArsenalAttacks[attackId];
      }

      const nextArsenal: ArsenalCatalog = {
        weapons: nextArsenalWeapons,
        attacks: nextArsenalAttacks,
      };

      const next: AppState = {
        ...prev,
        weapons: nextWeapons,
        attacks: nextAttacks,
      };
      set({ appState: next, arsenalCatalog: nextArsenal });
      persistCurrent(next);
      saveArsenalCatalog(nextArsenal).catch((e) =>
        console.error('Erro ao excluir ataque no Arsenal:', e)
      );
    },

    saveWeaponAsTemplate: async (weaponId) => {
      const prev = get().appState;
      const wp = prev.weapons[weaponId];
      if (!wp) return;
      const { id: _id, ...restWeapon } = wp;
      const linkedAttacks = wp.attackIds
        .map((aid) => prev.attacks[aid])
        .filter((a): a is Attack => Boolean(a));

      await saveWeaponTemplate({
        id: uid('wtpl'),
        name: wp.name,
        createdAt: Date.now(),
        weapon: restWeapon,
        attacks: linkedAttacks,
      });
      get().showToast(`Modelo de arma "${wp.name}" salvo!`);
    },

    // === Mira e Resolução de Ataques ===
    startAttackTargeting: (attackerId, weaponId, attackId) => {
      const prev = get().appState;
      const attacker = prev.characters[attackerId];
      const attack = prev.attacks[attackId];
      if (!attacker || !attacker.position || !attack) {
        get().showToast('Posicione o personagem no tabuleiro antes de atacar.');
        return;
      }

      const direction = attacker.facing;
      const anchorCell = getDirectionalAnchorCell(
        attacker.position,
        attacker.width,
        attacker.height,
        direction
      );

      const hasOffsetOrigin =
        attack.area.origin.x !== 0 || attack.area.origin.y !== 0;
      const hasZeroCell = attack.area.cells.some(
        (c) => c.dx === 0 && c.dy === 0
      );
      const isRangedTargeted =
        hasOffsetOrigin || (attack.range > 1 && hasZeroCell);

      let initialOrigin = anchorCell;
      if (hasOffsetOrigin) {
        const rot = rotateOffset(
          attack.area.origin.x,
          attack.area.origin.y,
          direction
        );
        initialOrigin = {
          x: Math.max(
            0,
            Math.min(prev.board.width - 1, anchorCell.x + rot.dx)
          ),
          y: Math.max(
            0,
            Math.min(prev.board.height - 1, anchorCell.y + rot.dy)
          ),
        };
      } else if (isRangedTargeted) {
        const rot = rotateOffset(0, -Math.min(attack.range, 3), direction);
        initialOrigin = {
          x: Math.max(
            0,
            Math.min(prev.board.width - 1, anchorCell.x + rot.dx)
          ),
          y: Math.max(
            0,
            Math.min(prev.board.height - 1, anchorCell.y + rot.dy)
          ),
        };
      }

      set({
        selectedCharacterId: attackerId,
        movementModeCharacterId: null,
        activeTool: 'select',
        rightPanelOpen: true,
        attackTargeting: {
          attackerId,
          weaponId,
          attackId,
          direction,
          targetOrigin: initialOrigin,
          anchorToAttacker: !isRangedTargeted,
          manualOverrides: {},
          damageAdjustments: {},
        },
      });
    },

    updateAttackDirection: (direction) => {
      const targeting = get().attackTargeting;
      if (!targeting) return;
      const attacker = get().appState.characters[targeting.attackerId];
      if (!attacker || !attacker.position) return;

      let nextOrigin = targeting.targetOrigin;
      if (targeting.anchorToAttacker) {
        nextOrigin = getDirectionalAnchorCell(
          attacker.position,
          attacker.width,
          attacker.height,
          direction
        );
      }

      set({
        attackTargeting: {
          ...targeting,
          direction,
          targetOrigin: nextOrigin,
          manualOverrides: {},
        },
      });
    },

    updateAttackOrigin: (origin) => {
      const targeting = get().attackTargeting;
      if (!targeting) return;
      const { board } = get().appState;
      const clamped = {
        x: Math.max(0, Math.min(board.width - 1, origin.x)),
        y: Math.max(0, Math.min(board.height - 1, origin.y)),
      };
      set({
        attackTargeting: {
          ...targeting,
          targetOrigin: clamped,
          anchorToAttacker: false,
        },
      });
    },

    setAttackAnchorToAttacker: (anchor) => {
      const targeting = get().attackTargeting;
      if (!targeting) return;
      const attacker = get().appState.characters[targeting.attackerId];
      let nextOrigin = targeting.targetOrigin;
      if (anchor && attacker?.position) {
        nextOrigin = getDirectionalAnchorCell(
          attacker.position,
          attacker.width,
          attacker.height,
          targeting.direction
        );
      }
      set({
        attackTargeting: {
          ...targeting,
          anchorToAttacker: anchor,
          targetOrigin: nextOrigin,
        },
      });
    },

    toggleAttackCellOverride: (x, y, zoneOrRemove) => {
      const targeting = get().attackTargeting;
      if (!targeting) return;
      const key = `${x},${y}`;
      const nextOverrides = { ...targeting.manualOverrides };
      if (zoneOrRemove === 'clear') {
        delete nextOverrides[key];
      } else {
        nextOverrides[key] = zoneOrRemove;
      }
      set({
        attackTargeting: {
          ...targeting,
          manualOverrides: nextOverrides,
        },
      });
    },

    setTargetDamageAdjustment: (characterId, finalDamage, ignored) => {
      const targeting = get().attackTargeting;
      if (!targeting) return;
      set({
        attackTargeting: {
          ...targeting,
          damageAdjustments: {
            ...targeting.damageAdjustments,
            [characterId]: {
              finalDamage: Math.max(0, Math.round(finalDamage)),
              ignored,
            },
          },
        },
      });
    },

    confirmAttackResolution: (autoDefault = false) => {
      const targeting = get().attackTargeting;
      if (!targeting) return;
      const prev = get().appState;
      const attacker = prev.characters[targeting.attackerId];
      const weapon = prev.weapons[targeting.weaponId] ?? null;
      const attack = prev.attacks[targeting.attackId];
      if (!attacker || !attack) {
        set({ attackTargeting: null });
        return;
      }

      const projected = projectAttackOnBoard(
        attack.area,
        targeting.targetOrigin,
        targeting.direction,
        prev.board,
        targeting.manualOverrides
      );

      const { impacts } = detectAttackImpacts({
        board: prev.board,
        projectedCells: projected,
        characters: prev.characters,
        attacker,
        weapon,
        attack,
        damageRule: prev.settings.damageRule,
        targetOrigin: targeting.targetOrigin,
        damageAdjustments: autoDefault ? {} : targeting.damageAdjustments,
      });

      const forwardHpChanges: Array<{ characterId: string; hp: number }> = [];
      const inverseHpChanges: Array<{ characterId: string; hp: number }> = [];
      const summaryNames: string[] = [];

      for (const imp of impacts) {
        if (imp.ignored) continue;
        const dmg = autoDefault ? imp.suggestedDamage : imp.finalDamage;
        const ch = prev.characters[imp.characterId];
        if (!ch) continue;
        const newHp = Math.max(0, ch.hpCurrent - dmg);
        forwardHpChanges.push({ characterId: ch.id, hp: newHp });
        inverseHpChanges.push({ characterId: ch.id, hp: ch.hpCurrent });
        summaryNames.push(`${ch.name} (-${dmg})`);
      }

      const resolvedGhost: LastResolvedAttack = {
        attackerId: attacker.id,
        attackerName: attacker.name,
        attackerPosition: attacker.position
          ? { ...attacker.position }
          : null,
        attackerWidth: attacker.width,
        attackerHeight: attacker.height,
        weaponId: weapon?.id ?? targeting.weaponId ?? null,
        weaponName: weapon?.name ?? null,
        attackId: attack.id,
        attackName: attack.name,
        direction: targeting.direction,
        targetOrigin: { ...targeting.targetOrigin },
        cells: projected.map((c) => ({ ...c })),
        resolvedAt: Date.now(),
      };

      const attackDirection = DIRECTION_LABELS[targeting.direction];
      const action: Action = {
        id: uid('act'),
        type: 'ATTACK_RESOLVE',
        timestamp: Date.now(),
        description:
          summaryNames.length > 0
            ? `${attacker.name} usou "${attack.name}" em direção a ${attackDirection} → ${summaryNames.join(', ')}`
            : `${attacker.name} usou "${attack.name}" em direção a ${attackDirection} (nenhum alvo atingido)`,
        data: {
          attackerId: attacker.id,
          attackerFacing: targeting.direction,
          hpChanges: forwardHpChanges,
          lastAttack: resolvedGhost,
        },
        inverse: {
          attackerId: attacker.id,
          attackerFacing: attacker.facing,
          hpChanges: inverseHpChanges,
          lastAttack: cloneLastAttack(prev.lastAttack ?? null),
        },
      };

      const next = executeCommand(prev, action);
      set({
        appState: next,
        attackTargeting: null,
      });
      persistCurrent(next);
      if (forwardHpChanges.length > 0) {
        syncBoardHpToFichas(
          next,
          forwardHpChanges.map((item) => item.characterId)
        );
      }
      get().showToast(
        summaryNames.length > 0
          ? `Ataque resolvido: ${summaryNames.join(', ')}`
          : `Ataque "${attack.name}" executado.`
      );
    },

    clearLastResolvedAttack: () => {
      const prev = get().appState;
      if (!prev.lastAttack) return;
      const next: AppState = { ...prev, lastAttack: null };
      set({ appState: next });
      persistCurrent(next);
    },

    // === Combate, Iniciativa e Histórico ===
    setCombatMode: (mode) => {
      const prev = get().appState;
      let turnOrder = [...prev.combat.turnOrder];
      if (mode === 'turns' && turnOrder.length === 0) {
        turnOrder = Object.values(prev.characters)
          .filter((c) => c.position !== null)
          .map((c) => c.id);
      }
      const activeCharacterId =
        mode === 'turns'
          ? prev.combat.activeCharacterId ?? turnOrder[0] ?? null
          : prev.combat.activeCharacterId;

      const next: AppState = {
        ...prev,
        combat: {
          ...prev.combat,
          mode,
          turnOrder,
          activeCharacterId,
        },
      };
      set({ appState: next });
      persistCurrent(next);
    },

    setTurnOrder: (order) => {
      const prev = get().appState;
      const valid = order.filter((id) => Boolean(prev.characters[id]));
      const active =
        prev.combat.activeCharacterId &&
        valid.includes(prev.combat.activeCharacterId)
          ? prev.combat.activeCharacterId
          : valid[0] ?? null;

      const next: AppState = {
        ...prev,
        combat: {
          ...prev.combat,
          turnOrder: valid,
          activeCharacterId: active,
        },
      };
      set({ appState: next });
      persistCurrent(next);
    },

    addCharacterToInitiative: (characterId) => {
      const prev = get().appState;
      if (
        !prev.characters[characterId] ||
        prev.combat.turnOrder.includes(characterId)
      ) {
        return;
      }
      const nextOrder = [...prev.combat.turnOrder, characterId];
      get().setTurnOrder(nextOrder);
    },

    removeCharacterFromInitiative: (characterId) => {
      const prev = get().appState;
      get().setTurnOrder(
        prev.combat.turnOrder.filter((id) => id !== characterId)
      );
    },

    setActiveTurnCharacter: (characterId) => {
      const prev = get().appState;
      const next: AppState = {
        ...prev,
        combat: { ...prev.combat, activeCharacterId: characterId },
      };
      set({
        appState: next,
        selectedCharacterId: characterId ?? get().selectedCharacterId,
      });
      persistCurrent(next);
    },

    nextTurn: () => {
      const prev = get().appState;
      const order = prev.combat.turnOrder;
      if (order.length === 0) return;

      const currentIdx = prev.combat.activeCharacterId
        ? order.indexOf(prev.combat.activeCharacterId)
        : -1;
      const nextIdx = (currentIdx + 1) % order.length;
      const nextRound =
        currentIdx !== -1 && nextIdx === 0
          ? prev.combat.round + 1
          : prev.combat.round;
      const nextActiveId = order[nextIdx];
      const nextCharName = prev.characters[nextActiveId]?.name ?? 'Próximo';

      const action: Action = {
        id: uid('act'),
        type: 'TURN_CHANGE',
        timestamp: Date.now(),
        description: `Turno de ${nextCharName} (Rodada ${nextRound})`,
        data: { activeCharacterId: nextActiveId, round: nextRound },
        inverse: {
          activeCharacterId: prev.combat.activeCharacterId,
          round: prev.combat.round,
        },
      };

      const next = executeCommand(prev, action);
      set({
        appState: next,
        selectedCharacterId: nextActiveId,
        movementModeCharacterId: null,
        attackTargeting: null,
      });
      persistCurrent(next);
    },

    newRound: () => {
      const prev = get().appState;
      const firstId = prev.combat.turnOrder[0] ?? null;
      const nextRound = prev.combat.round + 1;

      const action: Action = {
        id: uid('act'),
        type: 'TURN_CHANGE',
        timestamp: Date.now(),
        description: `Nova Rodada iniciada (Rodada ${nextRound})`,
        data: { activeCharacterId: firstId, round: nextRound },
        inverse: {
          activeCharacterId: prev.combat.activeCharacterId,
          round: prev.combat.round,
        },
      };

      const next = executeCommand(prev, action);
      set({ appState: next });
      persistCurrent(next);
    },

    undo: () => {
      const prev = get().appState;
      if (prev.history.past.length === 0) return;
      const last = prev.history.past[prev.history.past.length - 1];
      const next = undoCommand(prev);
      set({
        appState: next,
        movementModeCharacterId: null,
        attackTargeting: null,
      });
      persistCurrent(next);
      syncBoardHpToFichas(next, Object.keys(next.characters));
      if (last) {
        // Sincronização silenciosa
      }
    },

    redo: () => {
      const prev = get().appState;
      if (prev.history.future.length === 0) return;
      const next = redoCommand(prev);
      set({
        appState: next,
        movementModeCharacterId: null,
        attackTargeting: null,
      });
      persistCurrent(next);
      syncBoardHpToFichas(next, Object.keys(next.characters));
    },
  };
});
