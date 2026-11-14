import { describe, expect, it } from 'vitest';
import {
  calcularPerfilCombate,
  converterMonstroParaTabuleiro,
  criarMonstroEmBranco,
  elementoInfo,
  importarBestiarioHeartzLink,
  listarMonstros,
  listarRegioes,
  normalizarMonstro,
} from '../../bestiary/bestiaryEngine';
import { createDefaultBestiaryCatalog } from '../../data/bestiaryPresets';

describe('Bestiário do Glossário — base Heartz-Link', () => {
  it('semeia as 11 criaturas originais do Heartz-Link', () => {
    const catalog = createDefaultBestiaryCatalog();
    const nomes = listarMonstros(catalog).map((m) => m.nome);

    expect(nomes).toHaveLength(11);
    expect(nomes).toEqual(
      [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    );
    expect(nomes).toContain('Raposa');
    expect(nomes).toContain('Armadura Viva');
    expect(nomes).toContain('Louva-deus Gigante');
    expect(listarRegioes(catalog)).toContain('Verlas Ruinas');
  });

  it('converte a ficha legada em inglês para o formato em português', () => {
    const legado = {
      id: 'mon_legado_1',
      createdAt: '2026-04-19T08:08:57.978Z',
      updatedAt: '2026-04-19T17:50:52.011Z',
      name: 'Raposa',
      alias: 'raposa-vermelha',
      regions: ['Verlas Ruinas'],
      diet: 'Herbivora',
      prey: ['Coelho'],
      appearance: 'Pelagem vermelha.',
      image: 'data:image/jpeg;base64,AAAA',
      skills: {
        physical: { agility: 12, strength: 8, endurance: 4 },
        magical: { crafting: 4, impact: 6, manipulation: 5 },
        extra: { 'Olfato Apurado': 3 },
      },
      elements: ['Blood', 'Earth'],
      extractableItems: [
        { name: 'Pelagem Vermelha', rarity: 'Incomum', difficulty: 12 },
        { name: 'Núcleo', rarity: 'Lendario', difficulty: 30 },
      ],
    };

    const m = normalizarMonstro(legado);

    expect(m.nome).toBe('Raposa');
    expect(m.regioes).toEqual(['Verlas Ruinas']);
    expect(m.presas).toEqual(['Coelho']);
    expect(m.descricao).toBe('Pelagem vermelha.');
    expect(m.dieta).toBe('Herbívoro');
    expect(m.habilidades.fisico).toEqual({
      rapidez: 12,
      forca: 8,
      resistencia: 4,
    });
    expect(m.habilidades.extras).toEqual({ 'Olfato Apurado': 3 });
    expect(m.elementos).toEqual(['Sangue', 'Terra']);
    expect(m.itensExtraiveis[0].nome).toBe('Pelagem Vermelha');
    expect(m.itensExtraiveis[1].raridade).toBe('Lendário');
    expect(m.imagemId).toBeNull();
    expect(m.criadoEm).toBe(Date.parse('2026-04-19T08:08:57.978Z'));
  });

  it('deriva Vida, Movimento, Danos e tamanho dos Pontos de Classificação', () => {
    const raposa = normalizarMonstro({
      name: 'Raposa',
      skills: {
        physical: { agility: 12, strength: 8, endurance: 4 },
        magical: { crafting: 4, impact: 6, manipulation: 5 },
      },
    });

    const perfil = calcularPerfilCombate(raposa);
    expect(perfil.totalPontos).toBe(39);
    expect(perfil.nivelAmeaca).toBe(2);
    expect(perfil.vida).toBe(22); // 10 + Resistência 4 × 3
    expect(perfil.movimento).toBe(5); // 2 + round(12 / 4)
    expect(perfil.danoFisico).toBe(6); // round(8 × 0.6) + 1
    expect(perfil.danoMagico).toBe(4); // round((6 + 5) × 0.4)
    expect(perfil.largura).toBe(1);
    expect(perfil.altura).toBe(1);

    const armadura = normalizarMonstro({
      name: 'Armadura Viva',
      skills: {
        physical: { agility: 7, strength: 14, endurance: 18 },
        magical: { crafting: 3, impact: 3, manipulation: 12 },
      },
    });
    const pArmadura = calcularPerfilCombate(armadura);
    expect(pArmadura.vida).toBe(64);
    expect(pArmadura.nivelAmeaca).toBe(3);
    expect(pArmadura.largura).toBe(3);
    expect(pArmadura.altura).toBe(3);
  });

  it('respeita ajustes manuais do mestre sobre os valores derivados', () => {
    const base = criarMonstroEmBranco('Colosso');
    base.habilidades.fisico.resistencia = 20;
    const ajustado = {
      ...base,
      ajustes: { vida: 999, movimento: 9, largura: 4, altura: 4 },
    };
    const perfil = calcularPerfilCombate(ajustado);
    expect(perfil.vida).toBe(999);
    expect(perfil.movimento).toBe(9);
    expect(perfil.largura).toBe(4);
  });

  it('gera token, arma e ataques naturais para o Tabuleiro', () => {
    const lobo = normalizarMonstro({
      id: 'mon_teste_lobo',
      name: 'Lobo Sombrio',
      skills: {
        physical: { agility: 10, strength: 12, endurance: 10 },
        magical: { crafting: 0, impact: 6, manipulation: 2 },
      },
      elements: ['Dark'],
    });

    const bundle = converterMonstroParaTabuleiro(lobo);
    const perfil = calcularPerfilCombate(lobo);

    expect(bundle.character.id).toBe('char_mon_mon_teste_lobo');
    expect(bundle.character.hpMax).toBe(perfil.vida);
    expect(bundle.character.hpCurrent).toBe(perfil.vida);
    expect(bundle.character.movement).toBe(perfil.movimento);
    expect(bundle.weapons).toHaveLength(1);
    expect(bundle.weapons[0].id).toBe('wp_mon_mon_teste_lobo');
    expect(bundle.character.weaponIds).toEqual([bundle.weapons[0].id]);

    // Golpe natural + descarga elemental (tem dano mágico > 0)
    const nomes = bundle.attacks.map((a) => a.name);
    expect(nomes).toContain('Golpe Natural');
    expect(nomes.some((n) => n.startsWith('Descarga de'))).toBe(true);
    expect(bundle.weapons[0].attackIds).toEqual(
      bundle.attacks.map((a) => a.id)
    );
    // A descarga usa o elemento traduzido
    const descarga = bundle.attacks.find((a) => a.name.startsWith('Descarga'));
    expect(descarga?.impactType).toBe('Sombrio');
    expect(bundle.attacks.every((a) => a.area.cells.length > 0)).toBe(true);
  });

  it('importa um export completo do Heartz-Link', () => {
    const exportHeartz = {
      __heartzlink: true,
      version: 1,
      data: {
        heartzlink_monsters: [
          {
            id: 'mon_hl_x',
            name: 'Rato Gigante',
            skills: {
              physical: { agility: 6, strength: 8, endurance: 6 },
              magical: { crafting: 0, impact: 2, manipulation: 0 },
            },
            elements: ['Metal'],
            extractableItems: [{ name: 'Carne Dura', rarity: 'Comum', difficulty: 5 }],
          },
          {
            id: 'mon_hl_y',
            name: 'Coelho',
            image: 'data:image/jpeg;base64,ZZZ',
          },
        ],
      },
    };

    const { catalog, total, ignoradosComImagem } =
      importarBestiarioHeartzLink(exportHeartz);

    expect(total).toBe(2);
    expect(ignoradosComImagem).toBe(1);
    expect(catalog.monsters['mon_hl_x'].nome).toBe('Rato Gigante');
    expect(catalog.monsters['mon_hl_x'].elementos).toEqual(['Metal']);
    expect(catalog.monsters['mon_hl_y'].imagemId).toBeNull();
  });

  it('reconhece as grafias legadas e atuais dos elementos', () => {
    expect(elementoInfo('Blood')?.id).toBe('Sangue');
    expect(elementoInfo('sangue')?.id).toBe('Sangue');
    expect(elementoInfo('earth')?.id).toBe('Terra');
    expect(elementoInfo('Elemento Inexistente')).toBeNull();
  });
});
