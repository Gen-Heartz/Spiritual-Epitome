export type LinhagemKey =
  | ''
  | 'pungente'
  | 'erudita'
  | 'agraco'
  | 'desperta'
  | 'espectro';

export type ArmaTipoKey = '' | 'Curta' | 'Media' | 'Longa' | 'Magica';

export type CircSimbolo = '' | 'X' | 'O' | 'Q';

export type AnguloMagicoStr =
  | '180'
  | '120'
  | '90'
  | '60'
  | '45'
  | '30'
  | '15'
  | '0';

export type PericiaKey =
  | 'atletismo'
  | 'vigor'
  | 'tolerancia'
  | 'analise'
  | 'foco'
  | 'concentracao'
  | 'canalizacao'
  | 'integracao'
  | 'ancoragem'
  | 'prontidao'
  | 'investigacao'
  | 'sensibilidade'
  | 'sensacao'
  | 'persuasao'
  | 'empatia'
  | 'agilidade'
  | 'forca'
  | 'manualidade';

export type SlotKey =
  | 'int-1'
  | 'int-2'
  | 'int-3'
  | 'int-4'
  | 'ext-1'
  | 'ext-2'
  | 'ext-3'
  | 'ext-4'
  | 'ext-5'
  | 'ext-6';

export interface EpitomeEstadoRecursos {
  vidaAtual: number;
  vidaVendida: number;
  manaVendida: number;
  estaminaAtual: number;
  racAtual: number;
}

/**
 * Estrutura 100% compatível com o objeto salvo pelo GrimorioDB (`grimorio_mestre` -> store `fichas`)
 * em `Spiritual-Epitome`, preservando `_pericias`, `_slots`, `_slotCustos`, `_estado` e `_ts`.
 */
export interface EpitomeFicha {
  id: string;
  nomeJogador: string;
  nome: string;
  conceito: string;
  linhagem: LinhagemKey;
  tribo: string;
  nivel: number;
  xp: number;
  tipoArma: ArmaTipoKey;
  nomeArma: string;
  danoArma: number;
  quadSE: CircSimbolo;
  quadSD: CircSimbolo;
  quadIE: CircSimbolo;
  quadID: CircSimbolo;
  anguloDirecional: AnguloMagicoStr;
  larguraReta: number;
  bolsa: string;
  /** IDs de armas do Arsenal (Glossário -> Armas) guardadas na Zona de Armas da Mochila */
  mochilaArmasIds: string[];
  /** ID da arma da Mochila atualmente equipada pelo personagem (ou null) */
  armaEquipadaId: string | null;
  /** Emblema ou retrato customizado para o token no Tabuleiro Tático */
  avatarImageId?: string;
  _pericias: Record<PericiaKey, number>;
  _slots: Record<SlotKey, string>;
  _slotCustos: Record<SlotKey, number>;
  _estado: EpitomeEstadoRecursos;
  _ts: number;
}

export interface BonusCirculacao {
  vida: number;
  mana: number;
  estamina: number;
}

export interface CalculatedEpitomeStats {
  periciasTotais: number;
  periciasGastas: number;
  periciasRestantes: number;
  bonusCirc: BonusCirculacao;

  // Os 4 Campos (Recursos)
  vidaTotal: number;
  vidaEfetivaMax: number;
  vidaAtual: number;
  descansoCurto: number;
  descansoMedio: number;
  descansoLongo: number;

  manaTotal: number;
  manaEfetivaMax: number;
  manaCustoSlots: number;
  manaAtual: number;
  slotsDesbloqueados: Record<SlotKey, boolean>;

  estaminaTotal: number;
  estaminaAtual: number;
  estaminaMaxGasto: number;
  estaminaRecuperarPadrao: number;

  racTotal: number;
  racAtual: number;
  racRecuperarPadrao: number;

  // Combate
  danoFisico: number;
  danoMagico: number;
  deslocamento: number;
  agilidadeCombate: number;
  velocidadeMagica: number;
  densidadeMagica: number;
  deslocamentoMagia: number;
  danoArmaTotal: number;

  // Alcance Mágico
  raioCircular: number;
  areaCircular: number;
  anguloNum: number;
  alcanceDirecional: number;
}

/**
 * Resumo dos atributos Spiritual-Epitome acoplado a uma unidade no Tabuleiro Tático,
 * permitindo consultar e gastar Mana, Estamina e Raciocínio em tempo real, além de
 * ordenar iniciativa por Agilidade de Combate.
 */
export interface EpitomeTacticalSummary {
  fichaId: string;
  nivel: number;
  linhagem: LinhagemKey;
  tribo: string;
  agilidadeCombate: number;
  danoFisico: number;
  danoMagico: number;
  danoArmaTotal: number;
  /** Bônus de perícia Manualidade × 3 somado ao usar armas do Arsenal */
  manualidadeBonusArma: number;
  velocidadeMagica: number;
  densidadeMagica: number;
  deslocamentoMagia: number;
  manaTotal: number;
  manaAtual: number;
  estaminaTotal: number;
  estaminaAtual: number;
  estaminaMaxGasto: number;
  estaminaRecuperarPadrao: number;
  racTotal: number;
  racAtual: number;
  racRecuperarPadrao: number;
  raioCircular: number;
  anguloDirecional: AnguloMagicoStr;
  alcanceDirecional: number;
  larguraReta: number;
  slotsAtivos: Array<{ slot: SlotKey; nome: string; custo: number }>;
}
