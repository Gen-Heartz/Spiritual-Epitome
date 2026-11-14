import { BestiaryCatalog } from '../bestiary/bestiaryTypes';
import { normalizarMonstro } from '../bestiary/bestiaryEngine';

/**
 * Bestiário inicial — extraído do projeto Heartz-Link
 * (`HeartzLink_Save_20260703_0406.json`, `heartzlink_monsters`).
 *
 * Mantém nomes, alcunhas, dietas, presas, elementos e itens extraíveis
 * originais. As imagens base64 do export não são transportadas; os Pontos de
 * Classificação que estavam a 0 no original mantêm-se a 0 e podem ser
 * preenchidos no editor do Glossário.
 */
const MONSTROS_HEARTZ_LINK = [
  {
    id: 'mon_hl_coelho',
    name: 'Coelho',
    alias: 'coelhinho',
    regions: ['Verlas Ruinas'],
    diet: 'Come Planta',
    prey: [],
    skills: {
      physical: { agility: 0, strength: 0, endurance: 0 },
      magical: { crafting: 0, impact: 0, manipulation: 0 },
    },
    elements: [],
    extractableItems: [
      { name: 'Carne Fofa', rarity: 'Comum', difficulty: 3 },
      { name: 'Perna de Coelho', rarity: 'Epico', difficulty: 18 },
    ],
  },
  {
    id: 'mon_hl_coelho_sangue',
    name: 'Coelho de Sangue',
    alias: 'coelho-sangue',
    regions: [],
    diet: 'Carnivoro',
    prey: ['Coelho'],
    skills: {
      physical: { agility: 0, strength: 0, endurance: 0 },
      magical: { crafting: 0, impact: 0, manipulation: 0 },
    },
    elements: ['Blood'],
    extractableItems: [
      { name: 'Carne Ensanguentada', rarity: 'Raro', difficulty: 12 },
      { name: 'Pé Vermelho', rarity: 'Epico', difficulty: 23 },
    ],
  },
  {
    id: 'mon_hl_rato',
    name: 'Rato',
    alias: 'ratinho',
    regions: ['Verlas Ruinas'],
    diet: 'Herbivoro',
    prey: ['Coelho'],
    skills: {
      physical: { agility: 0, strength: 0, endurance: 0 },
      magical: { crafting: 0, impact: 0, manipulation: 0 },
    },
    elements: [],
    extractableItems: [
      { name: 'Carne Fedida', rarity: 'Comum', difficulty: 3 },
      { name: 'Calda Elastica', rarity: 'Incomum', difficulty: 12 },
    ],
  },
  {
    id: 'mon_hl_rato_gigante',
    name: 'Rato Gigante',
    alias: 'mega-rato',
    regions: ['Verlas Ruinas'],
    diet: 'Carnivoro',
    prey: ['Rato', 'Coelho', 'Coelho de Sangue'],
    skills: {
      physical: { agility: 6, strength: 8, endurance: 6 },
      magical: { crafting: 0, impact: 2, manipulation: 0 },
    },
    elements: [],
    extractableItems: [
      { name: 'Carne Dura', rarity: 'Comum', difficulty: 5 },
      { name: 'Calda Elastica Gigante', rarity: 'Raro', difficulty: 12 },
      { name: 'Gigantismo (Núcleo)', rarity: 'Epico', difficulty: 23 },
    ],
  },
  {
    id: 'mon_hl_raposa',
    name: 'Raposa',
    alias: 'raposa-vermelha',
    regions: ['Verlas Ruinas'],
    diet: 'Herbivora',
    prey: ['Coelho', 'Rato'],
    skills: {
      physical: { agility: 12, strength: 8, endurance: 4 },
      magical: { crafting: 4, impact: 6, manipulation: 5 },
    },
    elements: [],
    extractableItems: [
      { name: 'Carne Fibrosa', rarity: 'Comum', difficulty: 6 },
      { name: 'Pelagem Vermelha', rarity: 'Incomum', difficulty: 12 },
      { name: 'Presas', rarity: 'Incomum', difficulty: 8 },
    ],
  },
  {
    id: 'mon_hl_raposa_alfa',
    name: 'Raposa Alfa',
    alias: 'raposa-lider',
    regions: [],
    diet: 'Carnivora',
    prey: ['Coelho', 'Rato', 'Coelho de Sangue'],
    skills: {
      physical: { agility: 14, strength: 10, endurance: 6 },
      magical: { crafting: 3, impact: 5, manipulation: 6 },
    },
    elements: [],
    extractableItems: [
      { name: 'Carne Fibrosa', rarity: 'Comum', difficulty: 8 },
      { name: 'Grande Pelagem Vermelha', rarity: 'Incomum', difficulty: 12 },
      { name: 'Olfatologia (Núcleo)', rarity: 'Raro', difficulty: 18 },
    ],
  },
  {
    id: 'mon_hl_camundongo_enferrujado',
    name: 'Camundongo Enferrujado',
    alias: 'rato-ferrugem',
    regions: ['Verlas Ruinas'],
    diet: 'Carnivoro',
    prey: ['Rato'],
    skills: {
      physical: { agility: 8, strength: 5, endurance: 9 },
      magical: { crafting: 2, impact: 2, manipulation: 0 },
    },
    elements: ['Metal'],
    extractableItems: [
      { name: 'Carne Acida', rarity: 'Comum', difficulty: 6 },
      { name: 'Escamas de Ferro', rarity: 'Raro', difficulty: 16 },
    ],
  },
  {
    id: 'mon_hl_camundongo_terra',
    name: 'Camundongo de Terra',
    alias: 'rato-terra',
    regions: ['Verlas Ruinas'],
    diet: 'Herbivoro',
    prey: [],
    skills: {
      physical: { agility: 16, strength: 6, endurance: 8 },
      magical: { crafting: 8, impact: 4, manipulation: 2 },
    },
    elements: ['Earth'],
    extractableItems: [
      { name: 'Carne Terrosa', rarity: 'Comum', difficulty: 8 },
      { name: 'Armadura de Terra (Semi-Nucleo)', rarity: 'Epico', difficulty: 18 },
    ],
  },
  {
    id: 'mon_hl_tartaruga_rochosa',
    name: 'Tartaruga Rochosa',
    alias: 'tartaruga-montanha',
    regions: ['Verlas Ruinas'],
    diet: 'Herbivora',
    prey: [],
    skills: {
      physical: { agility: 2, strength: 9, endurance: 16 },
      magical: { crafting: 4, impact: 3, manipulation: 1 },
    },
    elements: ['Earth'],
    extractableItems: [
      { name: 'Carne Mole', rarity: 'Comum', difficulty: 4 },
      { name: 'Casco de Terra', rarity: 'Incomum', difficulty: 10 },
      { name: 'Invasão da Montanha (Semi-Núcleo)', rarity: 'Epico', difficulty: 19 },
    ],
  },
  {
    id: 'mon_hl_armadura_viva',
    name: 'Armadura Viva',
    alias: 'guerreiro-fantasma',
    regions: ['Verlas Ruinas'],
    diet: '',
    prey: [],
    skills: {
      physical: { agility: 7, strength: 14, endurance: 18 },
      magical: { crafting: 3, impact: 3, manipulation: 12 },
    },
    elements: ['Metal'],
    extractableItems: [
      { name: 'Pedaço de Armadura', rarity: 'Raro', difficulty: 14 },
      { name: 'Força de Vontade (Núcleo)', rarity: 'Lendario', difficulty: 32 },
    ],
  },
  {
    id: 'mon_hl_louva_deus',
    name: 'Louva-deus Gigante',
    alias: 'Foice-de-deus',
    regions: [],
    diet: 'Carnivoro',
    prey: [],
    skills: {
      physical: { agility: 12, strength: 14, endurance: 16 },
      magical: { crafting: 2, impact: 4, manipulation: 2 },
    },
    elements: ['Plant'],
    extractableItems: [],
  },
];

/** Data fixa para as sementes (não faz o catálogo parecer "novo" a cada boot). */
const DATA_SEMENTE = Date.parse('2026-07-03T04:06:00.000Z');

export function createDefaultBestiaryCatalog(): BestiaryCatalog {
  const monsters: BestiaryCatalog['monsters'] = {};
  for (const raw of MONSTROS_HEARTZ_LINK) {
    const normalizado = normalizarMonstro(raw);
    monsters[normalizado.id] = {
      ...normalizado,
      criadoEm: DATA_SEMENTE,
      atualizadoEm: DATA_SEMENTE,
    };
  }
  return { monsters };
}
