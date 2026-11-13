import { describe, expect, it } from 'vitest';
import {
  calcularBonusCirculacao,
  calcularFicha,
  converterFichaParaTabuleiro,
  criarFichaEmBranco,
  DEFAULT_SAMPLE_FICHAS,
  equiparArmaDoArsenalNaFicha,
  gerarAreaDirecionalMagica,
  normalizarFicha,
} from '../../epitome/epitomeEngine';
import { createDefaultArsenalCatalog } from '../../data/presets';
import { calculateAttackDamage } from '../combat';

describe('Spiritual-Epitome: Circulação Mágica e Fórmulas de Ficha', () => {
  it('calcula pares horizontais de Mana (O), verticais de Vida (Q) e posição de Estamina (X)', () => {
    // Par horizontal SE+SD = O -> +4 Mana; IE = X -> +2 Estamina; ID = Q -> +1 Vida
    expect(calcularBonusCirculacao('O', 'O', 'X', 'Q')).toEqual({
      vida: 1,
      mana: 4,
      estamina: 2,
    });

    // Par vertical SD+ID = Q -> +4 Vida; SE = X -> +1 Estamina; IE = O -> +1 Mana
    expect(calcularBonusCirculacao('X', 'Q', 'O', 'Q')).toEqual({
      vida: 4,
      mana: 1,
      estamina: 1,
    });
  });

  it('calcula perícias disponíveis, recursos, desbloqueio de slots e atributos de combate', () => {
    const f = criarFichaEmBranco();
    f.nivel = 4; // 6 + 4*3 = 18 pontos totais
    f._pericias.vigor = 3;
    f._pericias.atletismo = 4;
    f._pericias.tolerancia = 2;
    f._pericias.integracao = 3; // Desbloqueia int-3 e ext-4
    f._pericias.canalizacao = 3; // Desbloqueia ext-5
    f._pericias.ancoragem = 2;
    f._pericias.foco = 2;
    f._pericias.forca = 2;
    f._pericias.manualidade = 2;
    f.tipoArma = 'Curta';
    f.nomeArma = 'Sabre';
    f.danoArma = 4;
    f._slots['int-3'] = ' Pulso Interno';
    f._slotCustos['int-3'] = 2;
    f._slotCustos['int-4'] = 5; // Bloqueado (integracao < 6), NÃO deve descontar!

    const s = calcularFicha(f);
    expect(s.periciasTotais).toBe(18);
    expect(s.vidaTotal).toBe(19); // 10 + 3*3
    expect(s.deslocamento).toBe(8); // floor(2 + 4*1.5)
    expect(s.danoArmaTotal).toBe(10); // 4 + 2*3
    expect(s.slotsDesbloqueados['int-3']).toBe(true);
    expect(s.slotsDesbloqueados['int-4']).toBe(false);
    expect(s.slotsDesbloqueados['ext-4']).toBe(true);
    expect(s.slotsDesbloqueados['ext-5']).toBe(true);
    expect(s.slotsDesbloqueados['ext-6']).toBe(false);
    expect(s.manaCustoSlots).toBe(2);
    // Mana Total = ceil(5 + 2*2 + 3*0.5 + 3*0.5) = 12; Mana Atual = 12 - 2 = 10
    expect(s.manaTotal).toBe(12);
    expect(s.manaAtual).toBe(10);
  });

  it('converte fichas do Spiritual-Epitome em unidades táticas com armas, cones e slots', () => {
    const kael = normalizarFicha(DEFAULT_SAMPLE_FICHAS[1]);
    const bundle = converterFichaParaTabuleiro(kael, { metrosPorQuadrado: 5 });

    expect(bundle.character.name).toBe('Kael Andarilho');
    expect(bundle.character.fichaId).toBe(kael.id);
    expect(bundle.character.hpMax).toBe(20);
    expect(bundle.character.movement).toBe(6);
    expect(bundle.weapons.length).toBe(2); // Adaga de Caça + Canalização Espiritual
    expect(
      bundle.attacks.some((a) => a.name.includes('Projeção Direcional'))
    ).toBe(true);
    expect(
      bundle.attacks.some((a) => a.name.includes('Domínio Circular'))
    ).toBe(true);
    expect(bundle.attacks.some((a) => a.name.includes('Passo Sombrio'))).toBe(
      true
    );
  });

  it('gera feixe em linha reta quando o ângulo direcional é 0 graus', () => {
    const reta = gerarAreaDirecionalMagica(0, 5, 1);
    expect(reta).toHaveLength(5);
    expect(reta.every((c) => c.dx === 0 && c.dy < 0)).toBe(true);
  });

  it('equipa armas do Arsenal na Mochila, atualiza Combate e leva golpes ao Tabuleiro', () => {
    const arsenal = createDefaultArsenalCatalog();
    const espada = arsenal.weapons.wp_bastard_sword;
    const arco = arsenal.weapons.wp_elven_bow;

    let f = criarFichaEmBranco();
    f.nome = 'Vaelen';
    f._pericias.manualidade = 3; // +9 de Manualidade
    f._pericias.forca = 4; // Dano Físico = floor(4*1.5) = 6

    // Guarda 2 armas na mochila e equipa a Espada Bastarda
    f.mochilaArmasIds = [espada.id, arco.id];
    f = equiparArmaDoArsenalNaFicha(f, espada);

    expect(f.armaEquipadaId).toBe(espada.id);
    expect(f.tipoArma).toBe('Media');
    expect(f.nomeArma).toBe(espada.name);
    expect(f.danoArma).toBe(espada.baseDamage);

    const stats = calcularFicha(f);
    expect(stats.danoArmaTotal).toBe(espada.baseDamage + 9);

    const bundle = converterFichaParaTabuleiro(f, {
      arsenalCatalog: arsenal,
    });
    expect(bundle.character.weaponIds).toContain(espada.id);
    expect(bundle.character.weaponIds).not.toContain(arco.id);
    expect(bundle.attacks.some((a) => a.id === 'atk_slash_arc')).toBe(true);

    const slash = arsenal.attacks.atk_slash_arc;
    const effectiveDmg = calculateAttackDamage(
      slash,
      espada,
      bundle.character,
      'attack_only'
    );
    // Dano do ataque (14) + Dano Físico (6) + Manualidade×3 (9) = 29
    expect(effectiveDmg).toBe(slash.damage + stats.danoFisico + 9);
  });
});
