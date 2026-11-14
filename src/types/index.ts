import { ArmaTipoKey, EpitomeTacticalSummary } from '../epitome/epitomeTypes';

// === Enums ===

export enum Direction {
  North     = 0,
  NorthEast = 1,
  East      = 2,
  SouthEast = 3,
  South     = 4,
  SouthWest = 5,
  West      = 6,
  NorthWest = 7,
}

export type TerrainType = 'normal' | 'impassable' | 'difficult';

export type ImpactZone = 'red' | 'orange' | 'yellow';

export type CombatMode = 'free' | 'turns';

export type DiagonalRule = 'chebyshev' | 'alternating';

export type DamageRule = 'attack_only' | 'sum_all';

// === Entidades ===

export interface Character {
  id: string;
  name: string;
  imageId: string;
  hpMax: number;
  hpCurrent: number;
  movement: number;
  baseDamage: number;
  weaponIds: string[];
  position: { x: number; y: number } | null;
  facing: Direction;
  width: number;
  height: number;
  /** ID da ficha Spiritual-Epitome vinculada, quando criado/importado das Fichas */
  fichaId?: string;
  /** Resumo vivo dos recursos e atributos de combate/magia do Spiritual-Epitome */
  epitomeSummary?: EpitomeTacticalSummary;
}

export interface Weapon {
  id: string;
  name: string;
  iconId: string;
  category: string;
  range: number;
  baseDamage: number;
  attackIds: string[];
  /** Porte da arma no sistema Spiritual-Epitome (Curta, Média, Longa, Mágica) */
  epitomeTipo?: Exclude<ArmaTipoKey, ''>;
  /** Descrição / propriedades especiais da arma no Glossário */
  description?: string;
}

export interface ArsenalCatalog {
  weapons: Record<string, Weapon>;
  attacks: Record<string, Attack>;
}

export interface Attack {
  id: string;
  name: string;
  description: string;
  range: number;
  damage: number;
  area: AttackArea;
  impactType: string;
  effects: Effect[];
}

export interface AttackArea {
  origin: { x: number; y: number };
  cells: AreaCell[];
}

export interface AreaCell {
  dx: number;
  dy: number;
  zone: ImpactZone;
}

export interface Effect {
  id: string;
  name: string;
  description: string;
  duration: number;
}

// === Tabuleiro ===

export interface Board {
  id: string;
  width: number;
  height: number;
  terrain: Record<string, TerrainType>; // chave: "x,y"
}

// === Combate ===

export interface CombatSession {
  mode: CombatMode;
  turnOrder: string[];
  activeCharacterId: string | null;
  round: number;
}

// === Histórico (Command Pattern) ===

export type ActionType =
  | 'MOVE'
  | 'ROTATE'
  | 'DAMAGE'
  | 'HEAL'
  | 'SET_HP'
  | 'ATTACK_RESOLVE'
  | 'PLACE_CHARACTER'
  | 'REMOVE_CHARACTER'
  | 'TERRAIN_BATCH'
  | 'TURN_CHANGE';

export interface Action {
  id: string;
  type: ActionType;
  timestamp: number;
  description: string;
  data: Record<string, any>;
  inverse: Record<string, any>;
}

export interface ActionHistory {
  past: Action[];
  future: Action[];
}

// === Configurações do Sistema ===

export interface SystemSettings {
  diagonalRule: DiagonalRule;
  damageRule: DamageRule;
  showCoordinates: boolean;
  showGrid: boolean;
  checkLoSOnAttacks: boolean;
}

// === Último Ataque Resolvido (área persistente no grid) ===

/**
 * Registo do último ataque já confirmado/resolvido.
 * A sua área continua desenhada no tabuleiro até outro ataque
 * (de qualquer personagem) ser confirmado, momento em que é substituída.
 * Guarda snapshots (nomes/posição) para continuar legível mesmo que
 * o atacante se mova, seja removido ou editado depois.
 */
export interface LastResolvedAttack {
  attackerId: string;
  attackerName: string;
  /** Posição (canto sup. esq.) do atacante no momento da resolução. */
  attackerPosition: { x: number; y: number } | null;
  attackerWidth: number;
  attackerHeight: number;
  weaponId: string | null;
  weaponName: string | null;
  attackId: string;
  attackName: string;
  direction: Direction;
  targetOrigin: { x: number; y: number };
  /** Quadrados finais no tabuleiro (já com rotação + ajustes manuais). */
  cells: ProjectedAreaCell[];
  resolvedAt: number;
}

// === Estado Raiz ===

export interface AppState {
  version: string;
  matchName: string;
  board: Board;
  characters: Record<string, Character>;
  weapons: Record<string, Weapon>;
  attacks: Record<string, Attack>;
  combat: CombatSession;
  history: ActionHistory;
  settings: SystemSettings;
  /** Área do último ataque confirmado — visível até ao próximo ataque. */
  lastAttack: LastResolvedAttack | null;
}

// === Tipos Auxiliares de UI e Resolução ===

export type ActiveTool =
  | 'select'
  | 'terrain_normal'
  | 'terrain_difficult'
  | 'terrain_impassable'
  | 'los_ruler';

export interface ReachableCell {
  x: number;
  y: number;
  cost: number;
  path: Array<{ x: number; y: number }>;
}

export interface ProjectedAreaCell {
  x: number;
  y: number;
  zone: ImpactZone;
}

export interface TargetImpactEntry {
  characterId: string;
  characterName: string;
  width: number;
  height: number;
  zone: ImpactZone;
  hitSquares: number;
  totalSquares: number;
  suggestedDamage: number;
  finalDamage: number;
  ignored: boolean;
  isAttacker: boolean;
  hasLoS: boolean;
}

export interface AttackTargetingState {
  attackerId: string;
  weaponId: string;
  attackId: string;
  direction: Direction;
  targetOrigin: { x: number; y: number };
  anchorToAttacker: boolean;
  manualOverrides: Record<string, ImpactZone | 'remove'>; // chave "x,y" no tabuleiro
  damageAdjustments: Record<string, { finalDamage: number; ignored: boolean }>;
}

// === Persistência e Exportação ===

export interface StoredImage {
  id: string;
  blob: Blob;
  mimeType: string;
  createdAt: number;
}

export interface ExportedImage {
  id: string;
  dataUrl: string;
  mimeType: string;
}

export interface ExportedMatchJSON {
  version: string;
  exportedAt: string;
  matchName?: string;
  board: Board;
  characters: Character[];
  weapons: Weapon[];
  attacks: Attack[];
  images: ExportedImage[];
  combat: CombatSession;
  settings?: SystemSettings;
  lastAttack?: LastResolvedAttack | null;
  /** Bestiário do Glossário (Glossário -> Monstros), quando incluído na exportação */
  bestiary?: import('../bestiary/bestiaryTypes').BestiaryMonster[];
}

export interface SavedMatchRecord {
  id: string;
  name: string;
  updatedAt: number;
  state: AppState;
}

export interface CharacterTemplateRecord {
  id: string;
  name: string;
  createdAt: number;
  character: Omit<Character, 'id' | 'position'>;
}

export interface WeaponTemplateRecord {
  id: string;
  name: string;
  createdAt: number;
  weapon: Omit<Weapon, 'id'>;
  attacks: Attack[];
}
