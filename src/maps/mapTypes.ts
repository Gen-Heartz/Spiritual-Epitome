import { FogMode, TerrainType } from '../types';

/** Sentido da escada: desce para um nível inferior ou sobe para um superior. */
export type StairDirection = 'up' | 'down';

/** Escada colocada numa célula do mapa e ligada a outro mapa. */
export interface MapStair {
  id: string;
  x: number;
  y: number;
  direction: StairDirection;
  label: string;
  /** Mapa de destino (`null` = ainda não ligada) */
  targetMapId: string | null;
  /** Escada de chegada no mapa de destino (opcional) */
  targetStairId: string | null;
}

/** Predefinição de visão do mapa, aplicada automaticamente no modo de jogo. */
export interface MapFogPreset {
  mode: FogMode;
  /** Alcance de visão em quadrados quando em exploração */
  range: number;
  /** Se no Tabuleiro (jogo) o mestre fica impedido de alterar o modo/alcance */
  locked: boolean;
}

/** Um mapa do tabuleiro (documento independente, editável no Glossário). */
export interface GameMap {
  id: string;
  nome: string;
  descricao: string;
  largura: number;
  altura: number;
  terrain: Record<string, TerrainType>;
  stairs: MapStair[];
  fog: MapFogPreset;
  /** Posições das unidades guardadas neste mapa, por id de personagem */
  placements: Record<string, { x: number; y: number }>;
  criadoEm: number;
  atualizadoEm: number;
}

export interface MapCatalog {
  maps: Record<string, GameMap>;
  /** Mapa usado por omissão quando a partida não referencia nenhum */
  defaultMapId: string | null;
}

export const MAP_MIN_SIZE = 4;
export const MAP_MAX_SIZE = 60;
export const MAP_DEFAULT_WIDTH = 20;
export const MAP_DEFAULT_HEIGHT = 15;
export const MAP_DEFAULT_FOG_RANGE = 8;
