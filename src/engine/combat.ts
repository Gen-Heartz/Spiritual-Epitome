import {
  Attack,
  Board,
  Character,
  DamageRule,
  ImpactZone,
  ProjectedAreaCell,
  TargetImpactEntry,
  Weapon,
} from '../types';
import { cellKey, getOccupiedCells, GridPoint } from './geometry';
import { hasCreatureLoS, hasCreatureToCellLoS } from './los';
import { pickHigherSeverityZone } from './rotation';

import { inferEpitomeTipoFromWeapon } from '../epitome/epitomeEngine';

/**
 * Parte 10.3 — Relação entre danos:
 * Modo Padrão: Dano do ataque = valor final (somando Manualidade×3 e Dano Físico/Mágico quando
 * um personagem do Spiritual-Epitome utiliza uma arma independente do Arsenal).
 * Modo Soma (opcional): Dano do ataque + Dano base da arma + Dano base do personagem
 */
export function calculateAttackDamage(
  attack: Attack,
  weapon: Weapon | null,
  attacker: Character,
  damageRule: DamageRule
): number {
  const isStandaloneArsenalWeapon =
    Boolean(weapon) && !weapon!.id.startsWith('wp_ep_');

  if (attacker.epitomeSummary && isStandaloneArsenalWeapon && weapon) {
    const summary = attacker.epitomeSummary;
    const manualidadeBonus = summary.manualidadeBonusArma ?? 0;
    const porte = inferEpitomeTipoFromWeapon(weapon);
    const attrBonus =
      porte === 'Magica' ? summary.danoMagico : summary.danoFisico;

    if (damageRule === 'sum_all') {
      return attack.damage + weapon.baseDamage + attrBonus + manualidadeBonus;
    }
    return attack.damage + attrBonus + manualidadeBonus;
  }

  if (damageRule === 'sum_all') {
    return (
      attack.damage + (weapon ? weapon.baseDamage : 0) + attacker.baseDamage
    );
  }
  return attack.damage;
}

/**
 * Parte 13.2 e 13.3 — Identificação de personagens atingidos e resolução para criaturas grandes:
 * - Uma criatura é atingida se pelo menos 1 de seus quadrados estiver dentro da área de impacto.
 * - A zona de impacto aplicada é a de maior severidade entre todos os seus quadrados atingidos
 *   (vermelho > laranja > amarelo).
 * - O dano sugerido é aplicado uma única vez, independente de quantos quadrados foram atingidos.
 * - O mestre pode ajustar dano individualmente ou ignorar qualquer alvo.
 */
export function detectAttackImpacts(params: {
  board: Board;
  projectedCells: ProjectedAreaCell[];
  characters: Record<string, Character>;
  attacker: Character;
  weapon: Weapon | null;
  attack: Attack;
  damageRule: DamageRule;
  targetOrigin: GridPoint;
  damageAdjustments?: Record<string, { finalDamage: number; ignored: boolean }>;
}): {
  originHasLoS: boolean;
  impacts: TargetImpactEntry[];
} {
  const {
    board,
    projectedCells,
    characters,
    attacker,
    weapon,
    attack,
    damageRule,
    targetOrigin,
    damageAdjustments = {},
  } = params;

  const originHasLoS = hasCreatureToCellLoS(board, attacker, targetOrigin);
  const baseSuggestedDamage = calculateAttackDamage(
    attack,
    weapon,
    attacker,
    damageRule
  );

  // Mapa rápido dos quadrados de impacto no tabuleiro
  const areaByCell = new Map<string, ImpactZone>();
  for (const cell of projectedCells) {
    areaByCell.set(cellKey(cell.x, cell.y), cell.zone);
  }

  const impacts: TargetImpactEntry[] = [];

  for (const char of Object.values(characters)) {
    if (!char.position) continue;

    const occupied = getOccupiedCells(char.position, char.width, char.height);
    let hitSquares = 0;
    let highestZone: ImpactZone | null = null;

    for (const sq of occupied) {
      const zone = areaByCell.get(cellKey(sq.x, sq.y));
      if (zone) {
        hitSquares += 1;
        highestZone = highestZone
          ? pickHigherSeverityZone(highestZone, zone)
          : zone;
      }
    }

    if (hitSquares > 0 && highestZone) {
      const isAttacker = char.id === attacker.id;
      const custom = damageAdjustments[char.id];
      const creatureHasLoS = isAttacker
        ? true
        : hasCreatureLoS(board, attacker, char);

      impacts.push({
        characterId: char.id,
        characterName: char.name,
        width: char.width,
        height: char.height,
        zone: highestZone,
        hitSquares,
        totalSquares: occupied.length,
        suggestedDamage: baseSuggestedDamage,
        finalDamage:
          custom !== undefined ? custom.finalDamage : baseSuggestedDamage,
        ignored: custom !== undefined ? custom.ignored : isAttacker,
        isAttacker,
        hasLoS: originHasLoS || creatureHasLoS,
      });
    }
  }

  return {
    originHasLoS,
    impacts,
  };
}
