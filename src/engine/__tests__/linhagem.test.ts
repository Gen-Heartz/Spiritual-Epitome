import { describe, expect, it } from 'vitest';
import { calcularFicha, criarFichaEmBranco, normalizarFicha } from '../../epitome/epitomeEngine';
import { FACETAS, ORDEM_TRIBOS, TRIBOS } from '../../epitome/linhagemCatalogo';
import {
  alternarHabilidadeLinhagem,
  calcularPontosLinhagem,
  mudarRaizLinhagem,
  obterHabilidadeExterna,
  situacaoHabilidadeLinhagem,
  vincularEnergiaPorPericia,
} from '../../epitome/linhagemEngine';
import type { LinhagemDefinida, PericiaKey } from '../../epitome/epitomeTypes';

const fichaPungente = (nivel = 1) => normalizarFicha({ linhagem: 'pungente', nivel, _pericias: { integracao: 2 } });

describe('Árvore de Linhagem', () => {
  it('inclui as cinco tribos e as duas facetas, cada uma com IDs de habilidade únicos', () => {
    expect(ORDEM_TRIBOS).toEqual(['pungente', 'erudita', 'agraco', 'desperta', 'espectro']);
    expect(ORDEM_TRIBOS.map((id) => TRIBOS[id].habilidades.length)).toEqual([7, 8, 6, 8, 8]);
    expect(FACETAS.material.habilidades).toHaveLength(9);
    expect(FACETAS.efetiva.habilidades).toHaveLength(21);
    for (const ramo of [...Object.values(TRIBOS), ...Object.values(FACETAS)]) {
      expect(new Set(ramo.habilidades.map((h) => h.id)).size).toBe(ramo.habilidades.length);
    }
  });

  it('mantém a linhagem e os demais dados de fichas antigas', () => {
    const antiga = normalizarFicha({
      id: 'personagem-antigo',
      nome: 'Andarilho',
      linhagem: 'agraco',
      tribo: 'Filhos do Crepúsculo',
      _pericias: { integracao: 3 },
      _slots: { 'int-1': 'Escudo' },
    });
    expect(antiga).toMatchObject({
      id: 'personagem-antigo',
      linhagem: 'agraco',
      tribo: 'Filhos do Crepúsculo',
      _pericias: { integracao: 3 },
      _slots: { 'int-1': 'Escudo' },
      _arvoreLinhagem: { aprendidas: [], energiasPorPericia: {}, habilidadeExterna: null },
    });
  });

  it('concede três pontos por nível a partir do primeiro e preserva o nível zero ao salvar', () => {
    expect(calcularPontosLinhagem(criarFichaEmBranco()).total).toBe(3);
    for (const [nivel, total] of [[0, 0], [1, 3], [2, 6], [7, 21]]) {
      const ficha = normalizarFicha(JSON.parse(JSON.stringify(fichaPungente(nivel))));
      expect(ficha.nivel).toBe(nivel);
      expect(calcularPontosLinhagem(ficha)).toEqual({ total, gastos: 0, disponiveis: total, excedente: 0 });
    }
    const nivelZero = fichaPungente(0);
    expect(alternarHabilidadeLinhagem(nivelZero, 'pungente', 'empatia')).toBe(nivelZero);
  });

  it('gasta e reembolsa um ponto por habilidade da raiz ou das facetas, sem alterar perícias ou bônus', () => {
    const ficha = fichaPungente();
    const vazia = criarFichaEmBranco();
    expect(alternarHabilidadeLinhagem(vazia, 'material', 'fixar')).toBe(vazia);
    let atual = alternarHabilidadeLinhagem(ficha, 'pungente', 'empatia');
    atual = alternarHabilidadeLinhagem(atual, 'material', 'fixar');
    atual = alternarHabilidadeLinhagem(atual, 'efetiva', 'sensacao');
    expect(atual._arvoreLinhagem.aprendidas).toEqual(['pungente:empatia', 'material:fixar', 'efetiva:sensacao']);
    expect(calcularFicha(atual)).toEqual(calcularFicha(ficha));
    expect(calcularPontosLinhagem(atual)).toEqual({ total: 3, gastos: 3, disponiveis: 0, excedente: 0 });
    expect(alternarHabilidadeLinhagem(atual, 'material', 'residual')).toBe(atual);
    expect(alternarHabilidadeLinhagem(atual, 'efetiva', 'empatia')).toBe(atual);
    const reembolsada = alternarHabilidadeLinhagem(atual, 'material', 'fixar');
    expect(reembolsada._arvoreLinhagem.aprendidas).toEqual(['pungente:empatia', 'efetiva:sensacao']);
    expect(calcularPontosLinhagem(reembolsada).disponiveis).toBe(1);
    expect(calcularPontosLinhagem({ ...atual, nivel: 2 }).disponiveis).toBe(3);
  });

  it('exige um vínculo válido e saldo de três pontos para aprender uma técnica externa', () => {
    const ficha = fichaPungente();
    expect(alternarHabilidadeLinhagem(ficha, 'erudita', 'leitura-astral')).toBe(ficha);
    expect(vincularEnergiaPorPericia(ficha, 'pungente', 'integracao')).toBe(ficha);
    expect(vincularEnergiaPorPericia(ficha, 'erudita', 'invalida' as PericiaKey)).toBe(ficha);
    expect(vincularEnergiaPorPericia(ficha, 'outra' as LinhagemDefinida, 'integracao')).toBe(ficha);

    const vinculada = vincularEnergiaPorPericia(ficha, 'erudita', 'integracao');
    expect(vinculada.linhagem).toBe('pungente');
    expect(vinculada._pericias).toEqual(ficha._pericias);
    expect(vinculada._arvoreLinhagem.energiasPorPericia).toEqual({ erudita: 'integracao' });
    expect(calcularPontosLinhagem(vinculada).disponiveis).toBe(3);
    const doisPontos = alternarHabilidadeLinhagem(vinculada, 'material', 'fixar');
    expect(situacaoHabilidadeLinhagem(doisPontos, 'erudita', 'leitura-astral')).toMatchObject({ custo: 3, bloqueio: 'sem-saldo' });
    expect(alternarHabilidadeLinhagem(doisPontos, 'erudita', 'leitura-astral')).toBe(doisPontos);

    const treinada = alternarHabilidadeLinhagem(vinculada, 'erudita', 'leitura-astral');
    expect(treinada._arvoreLinhagem.habilidadeExterna).toBe('erudita:leitura-astral');
    expect(calcularPontosLinhagem(treinada)).toEqual({ total: 3, gastos: 3, disponiveis: 0, excedente: 0 });
    expect(calcularFicha(treinada)).toEqual(calcularFicha(ficha));
  });

  it('limita a uma externa por personagem inclusive com vários vínculos e saldo suficiente', () => {
    const erudita = vincularEnergiaPorPericia(fichaPungente(3), 'erudita', 'integracao');
    const duasEnergias = vincularEnergiaPorPericia(erudita, 'desperta', 'sensibilidade');
    const comExterna = alternarHabilidadeLinhagem(duasEnergias, 'erudita', 'leitura-astral');
    expect(calcularPontosLinhagem(comExterna).disponiveis).toBe(6);
    expect(situacaoHabilidadeLinhagem(comExterna, 'desperta', 'amplificacao-sensorial').bloqueio).toBe('limite-externa');
    expect(alternarHabilidadeLinhagem(comExterna, 'desperta', 'amplificacao-sensorial')).toBe(comExterna);
    expect(alternarHabilidadeLinhagem(comExterna, 'erudita', 'invocacao-espiritual')).toBe(comExterna);

    const liberada = alternarHabilidadeLinhagem(comExterna, 'erudita', 'leitura-astral');
    expect(calcularPontosLinhagem(liberada).disponiveis).toBe(9);
    const proxima = alternarHabilidadeLinhagem(liberada, 'desperta', 'amplificacao-sensorial');
    expect(obterHabilidadeExterna(proxima)?.chave).toBe('desperta:amplificacao-sensorial');
    expect(calcularPontosLinhagem(proxima).disponiveis).toBe(6);
  });

  it('reatribui a perícia sem cobrar e devolve os pontos se a energia da técnica for desvinculada', () => {
    const externa = alternarHabilidadeLinhagem(
      vincularEnergiaPorPericia(fichaPungente(), 'erudita', 'integracao'), 'erudita', 'leitura-astral'
    );
    const atualizada = vincularEnergiaPorPericia(externa, 'erudita', 'foco');
    expect(atualizada._arvoreLinhagem.energiasPorPericia.erudita).toBe('foco');
    expect(obterHabilidadeExterna(atualizada)?.chave).toBe('erudita:leitura-astral');
    expect(calcularPontosLinhagem(atualizada).disponiveis).toBe(0);
    const desvinculada = vincularEnergiaPorPericia(atualizada, 'erudita', null);
    expect(desvinculada._arvoreLinhagem.energiasPorPericia).toEqual({});
    expect(desvinculada._arvoreLinhagem.habilidadeExterna).toBeNull();
    expect(calcularPontosLinhagem(desvinculada).disponiveis).toBe(3);
    const revinculada = vincularEnergiaPorPericia(desvinculada, 'erudita', 'foco');
    expect(situacaoHabilidadeLinhagem(revinculada, 'erudita', 'leitura-astral').aprendida).toBe(false);
  });

  it('migra backups da árvore antiga sem ativar várias técnicas externas nem descartar marcas', () => {
    const ficha = normalizarFicha({
      linhagem: 'pungente',
      nivel: 1,
      _arvoreLinhagem: {
        aprendidas: ['pungente:empatia', 'erudita:leitura-astral', 'material:fixar', 'material:fixar', 'erudita:invocacao-espiritual', 'desperta:amplificacao-sensorial', 'invalido', 1],
        energiasPorPericia: { erudita: 'integracao', desperta: 'sensibilidade', agraco: 'constructor', espectro: 1, outra: 'foco' },
      },
    });
    expect(ficha._arvoreLinhagem).toEqual({
      aprendidas: ['pungente:empatia', 'material:fixar', 'erudita:invocacao-espiritual', 'desperta:amplificacao-sensorial'],
      habilidadeExterna: 'erudita:leitura-astral',
      energiasPorPericia: { erudita: 'integracao', desperta: 'sensibilidade' },
    });
    expect(calcularPontosLinhagem(ficha)).toEqual({ total: 3, gastos: 5, disponiveis: 0, excedente: 2 });
    expect(normalizarFicha(JSON.parse(JSON.stringify(ficha)))._arvoreLinhagem).toEqual(ficha._arvoreLinhagem);
    const retirada = alternarHabilidadeLinhagem(ficha, 'erudita', 'leitura-astral');
    const recarregada = normalizarFicha(JSON.parse(JSON.stringify(retirada)));
    expect(obterHabilidadeExterna(recarregada)).toBeNull();
    expect(calcularPontosLinhagem(recarregada).disponiveis).toBe(1);
  });

  it('mantém o progresso se o nível cair, bloqueando novas compras até haver saldo', () => {
    const antes = alternarHabilidadeLinhagem(
      vincularEnergiaPorPericia(fichaPungente(2), 'erudita', 'foco'), 'erudita', 'leitura-astral'
    );
    const comQuatroGastos = alternarHabilidadeLinhagem(antes, 'pungente', 'empatia');
    const menosNivel = normalizarFicha({ ...comQuatroGastos, nivel: 1 });
    expect(calcularPontosLinhagem(menosNivel)).toEqual({ total: 3, gastos: 4, disponiveis: 0, excedente: 1 });
    expect(alternarHabilidadeLinhagem(menosNivel, 'efetiva', 'atracao')).toBe(menosNivel);
    const devolvida = alternarHabilidadeLinhagem(menosNivel, 'pungente', 'empatia');
    expect(calcularPontosLinhagem(devolvida)).toEqual({ total: 3, gastos: 3, disponiveis: 0, excedente: 0 });
  });

  it('arquiva a raiz anterior ao trocar e cobra como própria a técnica que se torna inata', () => {
    const propria = alternarHabilidadeLinhagem(fichaPungente(2), 'pungente', 'empatia');
    const vinculada = vincularEnergiaPorPericia(propria, 'erudita', 'integracao');
    const treinada = alternarHabilidadeLinhagem(vinculada, 'erudita', 'leitura-astral');
    const trocada = mudarRaizLinhagem(treinada, 'erudita');
    expect(trocada._arvoreLinhagem.aprendidas).toEqual(['pungente:empatia', 'erudita:leitura-astral']);
    expect(trocada._arvoreLinhagem.habilidadeExterna).toBeNull();
    expect(calcularPontosLinhagem(trocada).gastos).toBe(1);
    const comVinculo = vincularEnergiaPorPericia(trocada, 'pungente', 'empatia');
    expect(situacaoHabilidadeLinhagem(comVinculo, 'pungente', 'empatia')).toMatchObject({ aprendida: false, custo: 3 });
    const deVolta = mudarRaizLinhagem(comVinculo, 'pungente');
    expect(situacaoHabilidadeLinhagem(deVolta, 'pungente', 'empatia').aprendida).toBe(true);
    expect(situacaoHabilidadeLinhagem(deVolta, 'erudita', 'leitura-astral').aprendida).toBe(false);
    expect(calcularPontosLinhagem(deVolta).gastos).toBe(1);
  });

  it('trata dados malformados e impede que backups definam uma externa inválida', () => {
    expect(normalizarFicha({ linhagem: 'constructor', _arvoreLinhagem: [] }).linhagem).toBe('');
    expect(normalizarFicha({ _arvoreLinhagem: { aprendidas: 'material:fixar', energiasPorPericia: 42 } })._arvoreLinhagem)
      .toEqual({ aprendidas: [], energiasPorPericia: {}, habilidadeExterna: null });
    for (const chave of ['material:fixar', 'desperta:amplificacao-sensorial', 'erudita:invalida', ['erudita:leitura-astral']]) {
      const ficha = normalizarFicha({
        linhagem: 'pungente',
        _arvoreLinhagem: { habilidadeExterna: chave, energiasPorPericia: { erudita: 'integracao' } },
      });
      expect(ficha._arvoreLinhagem.habilidadeExterna).toBeNull();
    }
  });
});
