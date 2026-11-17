import {
  AppState,
  ArsenalCatalog,
  Attack,
  Character,
  Direction,
  TerrainType,
  Weapon,
} from '../types';
import { ArmaTipoKey } from '../epitome/epitomeTypes';

export function createBlankMatchState(
  name = 'Novo Campo de Batalha',
  width = 20,
  height = 15
): AppState {
  return {
    version: '1.0',
    matchName: name,
    board: {
      id: `board_${Date.now()}`,
      width,
      height,
      terrain: {},
    },
    characters: {},
    weapons: {},
    attacks: {},
    combat: {
      mode: 'free',
      turnOrder: [],
      activeCharacterId: null,
      round: 1,
    },
    history: {
      past: [],
      future: [],
    },
    settings: {
      diagonalRule: 'chebyshev',
      damageRule: 'attack_only',
      showCoordinates: true,
      showGrid: true,
      checkLoSOnAttacks: true,
      fogMode: 'day',
      fogRangeMode: 'global',
      fogGlobalRange: 8,
      fogIntensity: 1,
      fogLocked: false,
    },
    lastAttack: null,
  };
}

/**
 * Cria um encontro tático demonstrativo ("Emboscada nas Ruínas Antigas") com
 * personagens de dimensões variadas (1×1, 2×2, 3×3), armas e ataques personalizados
 * (cones, linhas, círculos e zonas vermelho/laranja/amarelo) e terrenos variados.
 */
export function createSampleEncounterState(): AppState {
  const terrain: Record<string, TerrainType> = {
    // Pilares de pedra arruinados (impassáveis — ótimos para testar LoS e bloqueio diagonal)
    '6,4': 'impassable',
    '6,5': 'impassable',
    '7,4': 'impassable',
    '6,9': 'impassable',
    '6,10': 'impassable',
    '12,3': 'impassable',
    '13,4': 'impassable', // Par diagonal com (12,4) livre ou (12,3)+(11,4) para demonstrar quinas!
    '11,4': 'impassable',
    '12,10': 'impassable',
    '12,11': 'impassable',
    // Escombros e vegetação densa (terreno difícil — custo 2)
    '4,6': 'difficult',
    '4,7': 'difficult',
    '5,7': 'difficult',
    '8,6': 'difficult',
    '8,7': 'difficult',
    '9,7': 'difficult',
    '9,8': 'difficult',
    '10,8': 'difficult',
    '14,6': 'difficult',
    '14,7': 'difficult',
    '15,7': 'difficult',
  };

  const attacks: Record<string, Attack> = {
    atk_slash_arc: {
      id: 'atk_slash_arc',
      name: 'Corte em Arco',
      description: 'Golpe amplo horizontal à frente do guerreiro.',
      range: 1,
      damage: 14,
      impactType: 'Cortante',
      effects: [],
      area: {
        origin: { x: 0, y: 0 },
        cells: [
          { dx: 0, dy: -1, zone: 'red' },
          { dx: -1, dy: -1, zone: 'orange' },
          { dx: 1, dy: -1, zone: 'orange' },
        ],
      },
    },
    atk_thrust: {
      id: 'atk_thrust',
      name: 'Estocada Perfurante',
      description: 'Investida linear que atravessa 2 quadrados à frente.',
      range: 2,
      damage: 18,
      impactType: 'Perfurante',
      effects: [],
      area: {
        origin: { x: 0, y: 0 },
        cells: [
          { dx: 0, dy: -1, zone: 'red' },
          { dx: 0, dy: -2, zone: 'orange' },
        ],
      },
    },
    atk_pommel: {
      id: 'atk_pommel',
      name: 'Golpe de Guarda',
      description: 'Impacto contundente curto com onda lateral leve.',
      range: 1,
      damage: 9,
      impactType: 'Contundente',
      effects: [],
      area: {
        origin: { x: 0, y: 0 },
        cells: [
          { dx: 0, dy: -1, zone: 'red' },
          { dx: -1, dy: 0, zone: 'yellow' },
          { dx: 1, dy: 0, zone: 'yellow' },
        ],
      },
    },
    atk_precise_arrow: {
      id: 'atk_precise_arrow',
      name: 'Disparo Preciso',
      description: 'Flecha direta contra um único quadrado no alcance.',
      range: 9,
      damage: 16,
      impactType: 'Perfurante',
      effects: [],
      area: {
        origin: { x: 0, y: -5 },
        cells: [{ dx: 0, dy: 0, zone: 'red' }],
      },
    },
    atk_arrow_rain: {
      id: 'atk_arrow_rain',
      name: 'Chuva de Flechas',
      description: 'Saraivada em área 3×3 com centro letal e bordas de reação.',
      range: 8,
      damage: 12,
      impactType: 'Perfurante',
      effects: [],
      area: {
        origin: { x: 0, y: -5 },
        cells: [
          { dx: 0, dy: 0, zone: 'red' },
          { dx: -1, dy: 0, zone: 'orange' },
          { dx: 1, dy: 0, zone: 'orange' },
          { dx: 0, dy: -1, zone: 'orange' },
          { dx: 0, dy: 1, zone: 'orange' },
          { dx: -1, dy: -1, zone: 'yellow' },
          { dx: 1, dy: -1, zone: 'yellow' },
          { dx: -1, dy: 1, zone: 'yellow' },
          { dx: 1, dy: 1, zone: 'yellow' },
        ],
      },
    },
    atk_fireball: {
      id: 'atk_fireball',
      name: 'Esfera Piroclástica',
      description: 'Explosão flamejante com núcleo vermelho, anel laranja e brasas amarelas.',
      range: 7,
      damage: 22,
      impactType: 'Fogo',
      effects: [],
      area: {
        origin: { x: 0, y: -4 },
        cells: [
          { dx: 0, dy: 0, zone: 'red' },
          { dx: 0, dy: -1, zone: 'orange' },
          { dx: 1, dy: 0, zone: 'orange' },
          { dx: 0, dy: 1, zone: 'orange' },
          { dx: -1, dy: 0, zone: 'orange' },
          { dx: -1, dy: -1, zone: 'yellow' },
          { dx: 1, dy: -1, zone: 'yellow' },
          { dx: -1, dy: 1, zone: 'yellow' },
          { dx: 1, dy: 1, zone: 'yellow' },
          { dx: 0, dy: -2, zone: 'yellow' },
          { dx: 2, dy: 0, zone: 'yellow' },
          { dx: 0, dy: 2, zone: 'yellow' },
          { dx: -2, dy: 0, zone: 'yellow' },
        ],
      },
    },
    atk_arcane_beam: {
      id: 'atk_arcane_beam',
      name: 'Feixe Arcano',
      description: 'Raio concentrado em linha reta de 5 quadrados.',
      range: 5,
      damage: 19,
      impactType: 'Arcano',
      effects: [],
      area: {
        origin: { x: 0, y: 0 },
        cells: [
          { dx: 0, dy: -1, zone: 'red' },
          { dx: 0, dy: -2, zone: 'red' },
          { dx: 0, dy: -3, zone: 'red' },
          { dx: 0, dy: -4, zone: 'orange' },
          { dx: 0, dy: -5, zone: 'orange' },
        ],
      },
    },
    atk_dragon_breath: {
      id: 'atk_dragon_breath',
      name: 'Sopro Vulcânico',
      description: 'Cone devastador de chamas primordiais projetado à frente do dragão.',
      range: 5,
      damage: 28,
      impactType: 'Fogo Primordial',
      effects: [],
      area: {
        origin: { x: 0, y: 0 },
        cells: [
          { dx: 0, dy: -1, zone: 'red' },
          { dx: 0, dy: -2, zone: 'red' },
          { dx: -1, dy: -2, zone: 'orange' },
          { dx: 1, dy: -2, zone: 'orange' },
          { dx: 0, dy: -3, zone: 'red' },
          { dx: -1, dy: -3, zone: 'orange' },
          { dx: 1, dy: -3, zone: 'orange' },
          { dx: -2, dy: -3, zone: 'yellow' },
          { dx: 2, dy: -3, zone: 'yellow' },
          { dx: 0, dy: -4, zone: 'orange' },
          { dx: -1, dy: -4, zone: 'orange' },
          { dx: 1, dy: -4, zone: 'orange' },
          { dx: -2, dy: -4, zone: 'yellow' },
          { dx: 2, dy: -4, zone: 'yellow' },
        ],
      },
    },
    atk_tail_sweep: {
      id: 'atk_tail_sweep',
      name: 'Varredura de Garras',
      description: 'Golpe colossal que varre uma faixa larga à frente da fera.',
      range: 2,
      damage: 18,
      impactType: 'Cortante / Impacto',
      effects: [],
      area: {
        origin: { x: 0, y: 0 },
        cells: [
          { dx: -1, dy: -1, zone: 'red' },
          { dx: 0, dy: -1, zone: 'red' },
          { dx: 1, dy: -1, zone: 'red' },
          { dx: -2, dy: -1, zone: 'orange' },
          { dx: 2, dy: -1, zone: 'orange' },
          { dx: -1, dy: -2, zone: 'yellow' },
          { dx: 0, dy: -2, zone: 'orange' },
          { dx: 1, dy: -2, zone: 'yellow' },
        ],
      },
    },
    atk_seismic_slam: {
      id: 'atk_seismic_slam',
      name: 'Impacto Sísmico em Cruz',
      description: 'Fende o solo em quatro direções ortogonais.',
      range: 3,
      damage: 16,
      impactType: 'Sísmico',
      effects: [],
      area: {
        origin: { x: 0, y: -1 },
        cells: [
          { dx: 0, dy: 0, zone: 'red' },
          { dx: 0, dy: -1, zone: 'orange' },
          { dx: 0, dy: -2, zone: 'yellow' },
          { dx: 1, dy: 0, zone: 'orange' },
          { dx: 2, dy: 0, zone: 'yellow' },
          { dx: 0, dy: 1, zone: 'orange' },
          { dx: -1, dy: 0, zone: 'orange' },
          { dx: -2, dy: 0, zone: 'yellow' },
        ],
      },
    },
  };

  const weapons: Record<string, Weapon> = {
    wp_bastard_sword: {
      id: 'wp_bastard_sword',
      name: 'Espada Bastarda de Aço Negro',
      iconId: 'wicon_sword',
      category: 'Espada Longa',
      epitomeTipo: 'Media',
      description: 'Lâmina equilibrada para estocadas de alcance médio e cortes em arco.',
      range: 2,
      baseDamage: 4,
      attackIds: ['atk_slash_arc', 'atk_thrust', 'atk_pommel'],
    },
    wp_elven_bow: {
      id: 'wp_elven_bow',
      name: 'Arco Composto de Teixo',
      iconId: 'wicon_bow',
      category: 'Arco Longo',
      epitomeTipo: 'Longa',
      description: 'Arco recurvo de longo alcance para disparos precisos e chuva de flechas.',
      range: 9,
      baseDamage: 3,
      attackIds: ['atk_precise_arrow', 'atk_arrow_rain'],
    },
    wp_pyro_staff: {
      id: 'wp_pyro_staff',
      name: 'Cajado das Brasas Antigas',
      iconId: 'wicon_staff',
      category: 'Cajado Mágico',
      epitomeTipo: 'Magica',
      description: 'Catalisador rúnico capaz de projetar esferas piroclásticas e feixes arcanos.',
      range: 8,
      baseDamage: 5,
      attackIds: ['atk_fireball', 'atk_arcane_beam'],
    },
    wp_dragon_maw: {
      id: 'wp_dragon_maw',
      name: 'Fornalha Dracônica & Garras',
      iconId: 'wicon_claws',
      category: 'Arma Natural Colossal',
      epitomeTipo: 'Media',
      description: 'Armamento natural de fera dracônica colossal.',
      range: 5,
      baseDamage: 8,
      attackIds: ['atk_dragon_breath', 'atk_tail_sweep'],
    },
    wp_stone_maul: {
      id: 'wp_stone_maul',
      name: 'Malho Monolítico',
      iconId: 'wicon_hammer',
      category: 'Martelo Pesado',
      epitomeTipo: 'Media',
      description: 'Martelo maciço capaz de fender o chão em ondas sísmicas.',
      range: 3,
      baseDamage: 6,
      attackIds: ['atk_seismic_slam'],
    },
  };

  const characters: Record<string, Character> = {
    char_aldric: {
      id: 'char_aldric',
      name: 'Aldric, Guarda-Lâmina',
      imageId: 'preset_knight',
      hpMax: 95,
      hpCurrent: 95,
      movement: 5,
      baseDamage: 4,
      weaponIds: ['wp_bastard_sword'],
      position: { x: 4, y: 8 },
      facing: Direction.East,
      width: 1,
      height: 1,
    },
    char_lyra: {
      id: 'char_lyra',
      name: 'Lyra Passos-de-Vento',
      imageId: 'preset_archer',
      hpMax: 65,
      hpCurrent: 65,
      movement: 7,
      baseDamage: 3,
      weaponIds: ['wp_elven_bow'],
      position: { x: 2, y: 4 },
      facing: Direction.East,
      width: 1,
      height: 1,
    },
    char_maelis: {
      id: 'char_maelis',
      name: 'Maelis, Tecelão Ígneo',
      imageId: 'preset_mage',
      hpMax: 55,
      hpCurrent: 55,
      movement: 5,
      baseDamage: 5,
      weaponIds: ['wp_pyro_staff'],
      position: { x: 3, y: 11 },
      facing: Direction.NorthEast,
      width: 1,
      height: 1,
    },
    char_dragon: {
      id: 'char_dragon',
      name: 'Ignathor, Escama-Rubra',
      imageId: 'preset_dragon',
      hpMax: 240,
      hpCurrent: 240,
      movement: 6,
      baseDamage: 10,
      weaponIds: ['wp_dragon_maw'],
      position: { x: 14, y: 5 },
      facing: Direction.West,
      width: 3,
      height: 3,
    },
    char_sentinel: {
      id: 'char_sentinel',
      name: 'Sentinela Rúnica',
      imageId: 'preset_golem',
      hpMax: 135,
      hpCurrent: 135,
      movement: 4,
      baseDamage: 6,
      weaponIds: ['wp_stone_maul'],
      position: { x: 10, y: 10 },
      facing: Direction.West,
      width: 2,
      height: 2,
    },
  };

  return {
    version: '1.0',
    matchName: 'Emboscada nas Ruínas Antigas',
    board: {
      id: 'board_ruins_001',
      width: 20,
      height: 15,
      terrain,
    },
    characters,
    weapons,
    attacks,
    combat: {
      mode: 'turns',
      turnOrder: [
        'char_lyra',
        'char_aldric',
        'char_dragon',
        'char_maelis',
        'char_sentinel',
      ],
      activeCharacterId: 'char_lyra',
      round: 1,
    },
    history: {
      past: [],
      future: [],
    },
    settings: {
      diagonalRule: 'chebyshev',
      damageRule: 'attack_only',
      showCoordinates: true,
      showGrid: true,
      checkLoSOnAttacks: true,
      fogMode: 'day',
      fogRangeMode: 'global',
      fogGlobalRange: 8,
      fogIntensity: 1,
      fogLocked: false,
    },
    lastAttack: null,
  };
}

/**
 * Gera golpes táticos sugeridos para uma arma do Arsenal conforme seu Porte Spiritual-Epitome.
 */
export function gerarAtaquesSugeridosParaArma(
  weapon: Weapon,
  porteOverride?: Exclude<ArmaTipoKey, ''>
): Attack[] {
  const porte = porteOverride || weapon.epitomeTipo || 'Media';
  const base = Math.max(1, weapon.baseDamage || 4);
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  if (porte === 'Longa') {
    const r = Math.max(5, weapon.range || 7);
    return [
      {
        id: `atk_ars_${stamp}_1`,
        name: `Disparo Focado`,
        description: `Disparo preciso de longo alcance com ${weapon.name}.`,
        range: r,
        damage: base,
        impactType: 'Longo Alcance',
        effects: [],
        area: {
          origin: { x: 0, y: -Math.min(5, r) },
          cells: [
            { dx: 0, dy: 0, zone: 'red' },
            { dx: -1, dy: 0, zone: 'yellow' },
            { dx: 1, dy: 0, zone: 'yellow' },
          ],
        },
      },
      {
        id: `atk_ars_${stamp}_2`,
        name: `Tiro Perfurante`,
        description: `Disparo linear que atravessa alvos alinhados.`,
        range: Math.max(4, r - 2),
        damage: Math.max(1, base + 2),
        impactType: 'Perfurante',
        effects: [],
        area: {
          origin: { x: 0, y: 0 },
          cells: [
            { dx: 0, dy: -1, zone: 'red' },
            { dx: 0, dy: -2, zone: 'red' },
            { dx: 0, dy: -3, zone: 'orange' },
            { dx: 0, dy: -4, zone: 'orange' },
            { dx: 0, dy: -5, zone: 'yellow' },
          ],
        },
      },
    ];
  }

  if (porte === 'Magica') {
    const r = Math.max(4, weapon.range || 6);
    return [
      {
        id: `atk_ars_${stamp}_1`,
        name: `Pulso Canalizado`,
        description: `Projeção energética através de ${weapon.name}.`,
        range: r,
        damage: base,
        impactType: 'Arcano',
        effects: [],
        area: {
          origin: { x: 0, y: -Math.min(4, r) },
          cells: [
            { dx: 0, dy: 0, zone: 'red' },
            { dx: 0, dy: -1, zone: 'orange' },
            { dx: 1, dy: 0, zone: 'orange' },
            { dx: 0, dy: 1, zone: 'orange' },
            { dx: -1, dy: 0, zone: 'orange' },
          ],
        },
      },
      {
        id: `atk_ars_${stamp}_2`,
        name: `Feixe Espiritual`,
        description: `Linha concentrada de energia mágica.`,
        range: Math.max(3, r - 1),
        damage: base + 3,
        impactType: 'Arcano Linear',
        effects: [],
        area: {
          origin: { x: 0, y: 0 },
          cells: [
            { dx: 0, dy: -1, zone: 'red' },
            { dx: 0, dy: -2, zone: 'red' },
            { dx: 0, dy: -3, zone: 'orange' },
            { dx: 0, dy: -4, zone: 'yellow' },
          ],
        },
      },
    ];
  }

  if (porte === 'Curta') {
    return [
      {
        id: `atk_ars_${stamp}_1`,
        name: `Golpe Rápido`,
        description: `Estocada ágil de curta distância com ${weapon.name}.`,
        range: 1,
        damage: base,
        impactType: 'Corpo a Corpo',
        effects: [],
        area: {
          origin: { x: 0, y: 0 },
          cells: [
            { dx: 0, dy: -1, zone: 'red' },
            { dx: -1, dy: -1, zone: 'yellow' },
            { dx: 1, dy: -1, zone: 'yellow' },
          ],
        },
      },
      {
        id: `atk_ars_${stamp}_2`,
        name: `Corte Duplo`,
        description: `Sequência veloz atingindo os quadrados frontais.`,
        range: 1,
        damage: base + 3,
        impactType: 'Cortante Rápido',
        effects: [],
        area: {
          origin: { x: 0, y: 0 },
          cells: [
            { dx: 0, dy: -1, zone: 'red' },
            { dx: -1, dy: -1, zone: 'orange' },
            { dx: 1, dy: -1, zone: 'orange' },
          ],
        },
      },
    ];
  }

  // Porte Média (padrão)
  return [
    {
      id: `atk_ars_${stamp}_1`,
      name: `Golpe de Alcance`,
      description: `Investida frontal com ${weapon.name}.`,
      range: 2,
      damage: base,
      impactType: 'Alcance Médio',
      effects: [],
      area: {
        origin: { x: 0, y: 0 },
        cells: [
          { dx: 0, dy: -1, zone: 'red' },
          { dx: 0, dy: -2, zone: 'orange' },
        ],
      },
    },
    {
      id: `atk_ars_${stamp}_2`,
      name: `Varredura em Arco`,
      description: `Corte amplo varrendo os flancos frontais.`,
      range: 2,
      damage: base + 3,
      impactType: 'Cortante Amplo',
      effects: [],
      area: {
        origin: { x: 0, y: 0 },
        cells: [
          { dx: 0, dy: -1, zone: 'red' },
          { dx: -1, dy: -1, zone: 'orange' },
          { dx: 1, dy: -1, zone: 'orange' },
          { dx: 0, dy: -2, zone: 'yellow' },
        ],
      },
    },
  ];
}

/**
 * Catálogo inicial independente de armas do Glossário (Arsenal Global),
 * desvinculado de personagens específicos para livre edição e seleção nas Mochilas.
 */
export function createDefaultArsenalCatalog(): ArsenalCatalog {
  const sample = createSampleEncounterState();
  const weapons: Record<string, Weapon> = {
    wp_arsenal_machado: {
      id: 'wp_arsenal_machado',
      name: 'Machado Ancestral Uru’Khan',
      iconId: 'wicon_hammer',
      category: 'Machado de Guerra',
      epitomeTipo: 'Media',
      description: 'Machado tribal pesado forjado nas terras geladas do Norte.',
      range: 2,
      baseDamage: 6,
      attackIds: ['atk_ars_machado_1', 'atk_ars_machado_2'],
    },
    wp_arsenal_adaga: {
      id: 'wp_arsenal_adaga',
      name: 'Adaga de Caça',
      iconId: 'wicon_sword',
      category: 'Adaga',
      epitomeTipo: 'Curta',
      description: 'Lâmina leve e silenciosa ideal para ataques precisos à queima-roupa.',
      range: 1,
      baseDamage: 5,
      attackIds: ['atk_ars_adaga_1', 'atk_ars_adaga_2'],
    },
    wp_bastard_sword: sample.weapons.wp_bastard_sword,
    wp_elven_bow: sample.weapons.wp_elven_bow,
    wp_pyro_staff: sample.weapons.wp_pyro_staff,
    wp_stone_maul: sample.weapons.wp_stone_maul,
  };

  const attacks: Record<string, Attack> = {
    atk_ars_machado_1: {
      id: 'atk_ars_machado_1',
      name: 'Golpe de Alcance',
      description: 'Impacto frontal pesado de média distância.',
      range: 2,
      damage: 6,
      impactType: 'Cortante Pesado',
      effects: [],
      area: {
        origin: { x: 0, y: 0 },
        cells: [
          { dx: 0, dy: -1, zone: 'red' },
          { dx: 0, dy: -2, zone: 'orange' },
        ],
      },
    },
    atk_ars_machado_2: {
      id: 'atk_ars_machado_2',
      name: 'Varredura Uru’Khan',
      description: 'Giro brutal que varre toda a frente do guerreiro.',
      range: 2,
      damage: 10,
      impactType: 'Cortante Amplo',
      effects: [],
      area: {
        origin: { x: 0, y: 0 },
        cells: [
          { dx: 0, dy: -1, zone: 'red' },
          { dx: -1, dy: -1, zone: 'orange' },
          { dx: 1, dy: -1, zone: 'orange' },
          { dx: 0, dy: -2, zone: 'yellow' },
        ],
      },
    },
    atk_ars_adaga_1: {
      id: 'atk_ars_adaga_1',
      name: 'Estocada Rápida',
      description: 'Golpe perfurante veloz em curta distância.',
      range: 1,
      damage: 5,
      impactType: 'Perfurante',
      effects: [],
      area: {
        origin: { x: 0, y: 0 },
        cells: [
          { dx: 0, dy: -1, zone: 'red' },
          { dx: -1, dy: -1, zone: 'yellow' },
          { dx: 1, dy: -1, zone: 'yellow' },
        ],
      },
    },
    atk_ars_adaga_2: {
      id: 'atk_ars_adaga_2',
      name: 'Corte Cruzado',
      description: 'Duplo golpe diagonal à frente.',
      range: 1,
      damage: 8,
      impactType: 'Cortante Rápido',
      effects: [],
      area: {
        origin: { x: 0, y: 0 },
        cells: [
          { dx: 0, dy: -1, zone: 'red' },
          { dx: -1, dy: -1, zone: 'orange' },
          { dx: 1, dy: -1, zone: 'orange' },
        ],
      },
    },
    atk_slash_arc: sample.attacks.atk_slash_arc,
    atk_thrust: sample.attacks.atk_thrust,
    atk_pommel: sample.attacks.atk_pommel,
    atk_precise_arrow: sample.attacks.atk_precise_arrow,
    atk_arrow_rain: sample.attacks.atk_arrow_rain,
    atk_fireball: sample.attacks.atk_fireball,
    atk_arcane_beam: sample.attacks.atk_arcane_beam,
    atk_seismic_slam: sample.attacks.atk_seismic_slam,
  };

  return { weapons, attacks };
}
