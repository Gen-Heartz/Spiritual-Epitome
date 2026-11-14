/**
 * Bestiário do Glossário — base herdada do projeto Heartz-Link.
 *
 * Mantém a mesma estrutura de fichas de monstro do Heartz-Link
 * (identidade, regiões, dieta, presas, pontos de classificação físicos e
 * mágicos, habilidades extra, atributos elementais e itens extraíveis),
 * agora traduzida para português e integrada no Grimório do Mestre.
 */

/** Pontos de Classificação — Físicos */
export interface MonsterSkillsFisico {
  /** Rapidez (Agility) */
  rapidez: number;
  /** Força (Strength) */
  forca: number;
  /** Resistência (Endurance) */
  resistencia: number;
}

/** Pontos de Classificação — Mágicos */
export interface MonsterSkillsMagico {
  /** Artesanato (Crafting) */
  artesanato: number;
  /** Impacto (Impact) */
  impacto: number;
  /** Manipulação (Manipulation) */
  manipulacao: number;
}

export interface MonsterSkills {
  fisico: MonsterSkillsFisico;
  magico: MonsterSkillsMagico;
  /** Perícias livres adicionais (ex.: Percepção, Furtividade) */
  extras: Record<string, number>;
}

export interface MonsterLootItem {
  nome: string;
  /** Comum | Incomum | Raro | Épico | Lendário */
  raridade: string;
  /** Dificuldade de extração (0–100) */
  dificuldade: number;
}

export interface BestiaryMonster {
  id: string;
  criadoEm: number;
  atualizadoEm: number;
  nome: string;
  /** Alcunha / nome conhecido */
  alias: string;
  /** Regiões / locais onde ocorre (etiquetas livres) */
  regioes: string[];
  /** Descrição da dieta */
  dieta: string;
  /** Presas (outros monstros de que se alimenta) */
  presas: string[];
  /** Descrição completa / aparência */
  descricao: string;
  /** ID da imagem no banco local (`db.images`), quando houver */
  imagemId: string | null;
  habilidades: MonsterSkills;
  /** Elementos associados (rótulos em português) */
  elementos: string[];
  itensExtraiveis: MonsterLootItem[];
  /** Ajustes manuais opcionais do mestre para o Tabuleiro */
  ajustes?: {
    largura?: number;
    altura?: number;
    vida?: number;
    movimento?: number;
  };
}

export interface BestiaryCatalog {
  monsters: Record<string, BestiaryMonster>;
}

/** Perfil tático derivado dos Pontos de Classificação. */
export interface MonsterCombatProfile {
  /** Soma de todos os pontos de classificação */
  totalPontos: number;
  /** Nível de ameaça I–V (ou 0 = inofensivo) */
  nivelAmeaca: number;
  faixaAmeaca: string;
  vida: number;
  movimento: number;
  danoFisico: number;
  danoMagico: number;
  iniciativa: number;
  largura: number;
  altura: number;
  classificacaoTamanho: string;
}

/** Resultado da conversão de um monstro para o Tabuleiro. */
export interface MonsterTacticalBundle {
  character: import('../types').Character;
  weapons: import('../types').Weapon[];
  attacks: import('../types').Attack[];
  perfil: MonsterCombatProfile;
}
