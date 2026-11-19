import type {
  EpitomeFicha,
  HabilidadeLinhagemId,
  LinhagemDefinida,
  LinhagemKey,
  PericiaKey,
  ProgressoLinhagem,
  RamoLinhagemKey,
} from './epitomeTypes';
import { FACETAS, ORDEM_TRIBOS, TRIBOS, isLinhagemDefinida } from './linhagemCatalogo';
import type { HabilidadeLinhagem } from './linhagemCatalogo';

export const PONTOS_LINHAGEM_POR_NIVEL = 3;
export const CUSTO_HABILIDADE_PROPRIA = 1;
export const CUSTO_HABILIDADE_EXTERNA = 3;

export const idHabilidadeLinhagem = (ramo: RamoLinhagemKey, id: string): HabilidadeLinhagemId =>
  `${ramo}:${id}`;

const RAMOS = { ...FACETAS, ...TRIBOS };
const HABILIDADES = new Map<string, HabilidadeLinhagem & { ramo: RamoLinhagemKey }>();
for (const ramo of Object.keys(RAMOS) as RamoLinhagemKey[]) {
  for (const habilidade of RAMOS[ramo].habilidades) {
    HABILIDADES.set(idHabilidadeLinhagem(ramo, habilidade.id), { ...habilidade, ramo });
  }
}

const isIdHabilidade = (id: unknown): id is HabilidadeLinhagemId =>
  typeof id === 'string' && HABILIDADES.has(id);

const comoRegistro = (valor: unknown): Record<string, unknown> =>
  valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : {};

/** Se a energia externa vira a inata, a técnica passa ao ramo próprio (1 ponto). */
function promoverHabilidadeExterna(arvore: ProgressoLinhagem, raiz: LinhagemKey): ProgressoLinhagem {
  const chave = arvore.habilidadeExterna;
  if (!chave || HABILIDADES.get(chave)?.ramo !== raiz) return arvore;
  return {
    ...arvore,
    aprendidas: arvore.aprendidas.includes(chave) ? arvore.aprendidas : [...arvore.aprendidas, chave],
    habilidadeExterna: null,
  };
}

export function normalizarArvoreLinhagem(
  raw: unknown,
  pericias: EpitomeFicha['_pericias'],
  raiz: LinhagemKey
): ProgressoLinhagem {
  const dados = comoRegistro(raw);
  const aprendidas = Array.isArray(dados.aprendidas)
    ? [...new Set(dados.aprendidas.filter(isIdHabilidade))]
    : [];
  const energiasPorPericia: ProgressoLinhagem['energiasPorPericia'] = {};
  const vinculos = comoRegistro(dados.energiasPorPericia);
  for (const tribo of ORDEM_TRIBOS) {
    const pericia = Object.hasOwn(vinculos, tribo) ? vinculos[tribo] : undefined;
    if (typeof pericia === 'string' && Object.hasOwn(pericias, pericia)) {
      energiasPorPericia[tribo] = pericia as PericiaKey;
    }
  }

  const temVinculo = (chave: HabilidadeLinhagemId) => {
    const ramo = HABILIDADES.get(chave)?.ramo;
    return isLinhagemDefinida(ramo) && Boolean(energiasPorPericia[ramo]);
  };
  // Backups anteriores não tinham um campo exclusivo de habilidade externa. Preserva
  // a primeira externa vinculada; as demais ficam arquivadas, como as de uma raiz antiga.
  const antiga = !Object.hasOwn(dados, 'habilidadeExterna');
  const candidata = antiga && raiz
    ? aprendidas.find((chave) => HABILIDADES.get(chave)?.ramo !== raiz && temVinculo(chave))
    : dados.habilidadeExterna;
  const habilidadeExterna = isIdHabilidade(candidata) && temVinculo(candidata) ? candidata : null;
  return promoverHabilidadeExterna({
    aprendidas: antiga && habilidadeExterna ? aprendidas.filter((chave) => chave !== habilidadeExterna) : aprendidas,
    energiasPorPericia,
    habilidadeExterna,
  }, raiz);
}

export function mudarRaizLinhagem(ficha: EpitomeFicha, raiz: LinhagemKey): EpitomeFicha {
  if (raiz === ficha.linhagem) return ficha;
  return { ...ficha, linhagem: raiz, _arvoreLinhagem: promoverHabilidadeExterna(ficha._arvoreLinhagem, raiz) };
}

export function obterHabilidadeExterna(ficha: EpitomeFicha) {
  const chave = ficha._arvoreLinhagem.habilidadeExterna;
  if (!ficha.linhagem || !chave) return null;
  const habilidade = HABILIDADES.get(chave);
  const ramo = habilidade?.ramo;
  if (!habilidade || !isLinhagemDefinida(ramo) || ramo === ficha.linhagem) return null;
  return ficha._arvoreLinhagem.energiasPorPericia[ramo] ? { ...habilidade, ramo, chave } : null;
}

export interface PontosLinhagem {
  total: number;
  gastos: number;
  disponiveis: number;
  excedente: number;
}

export function calcularPontosLinhagem(ficha: EpitomeFicha): PontosLinhagem {
  const niveis = Number.isFinite(ficha.nivel) ? Math.max(0, Math.floor(ficha.nivel)) : 0;
  const total = niveis * PONTOS_LINHAGEM_POR_NIVEL;
  const proprias = ficha._arvoreLinhagem.aprendidas.filter((chave) => {
    const ramo = HABILIDADES.get(chave)?.ramo;
    return ramo === 'material' || ramo === 'efetiva' || ramo === ficha.linhagem;
  }).length;
  const gastos = proprias * CUSTO_HABILIDADE_PROPRIA + (obterHabilidadeExterna(ficha) ? CUSTO_HABILIDADE_EXTERNA : 0);
  return { total, gastos, disponiveis: Math.max(0, total - gastos), excedente: Math.max(0, gastos - total) };
}

interface SituacaoHabilidade {
  aprendida: boolean;
  custo: number;
  bloqueio: 'indisponivel' | 'sem-vinculo' | 'limite-externa' | 'sem-saldo' | null;
}

export function situacaoHabilidadeLinhagem(
  ficha: EpitomeFicha,
  ramo: RamoLinhagemKey,
  id: string
): SituacaoHabilidade {
  const chave = idHabilidadeLinhagem(ramo, id);
  const externa = isLinhagemDefinida(ramo) && ramo !== ficha.linhagem;
  const custo = externa ? CUSTO_HABILIDADE_EXTERNA : CUSTO_HABILIDADE_PROPRIA;
  const aindaNaoAprendida = { aprendida: false, custo };
  if (!ficha.linhagem || !HABILIDADES.has(chave)) {
    return { ...aindaNaoAprendida, bloqueio: 'indisponivel' };
  }
  const externaAtiva = obterHabilidadeExterna(ficha);
  const aprendida = externa ? externaAtiva?.chave === chave : ficha._arvoreLinhagem.aprendidas.includes(chave);
  if (aprendida) return { aprendida, custo, bloqueio: null };
  if (externa && !ficha._arvoreLinhagem.energiasPorPericia[ramo]) {
    return { ...aindaNaoAprendida, bloqueio: 'sem-vinculo' };
  }
  if (externa && externaAtiva) return { ...aindaNaoAprendida, bloqueio: 'limite-externa' };
  const saldo = calcularPontosLinhagem(ficha).disponiveis;
  return { ...aindaNaoAprendida, bloqueio: saldo < custo ? 'sem-saldo' : null };
}

export function alternarHabilidadeLinhagem(ficha: EpitomeFicha, ramo: RamoLinhagemKey, id: string): EpitomeFicha {
  const { aprendida, bloqueio } = situacaoHabilidadeLinhagem(ficha, ramo, id);
  if (bloqueio) return ficha;
  const arvore = ficha._arvoreLinhagem;
  const chave = idHabilidadeLinhagem(ramo, id);
  if (isLinhagemDefinida(ramo) && ramo !== ficha.linhagem) {
    return { ...ficha, _arvoreLinhagem: { ...arvore, habilidadeExterna: aprendida ? null : chave } };
  }
  const aprendidas = aprendida ? arvore.aprendidas.filter((item) => item !== chave) : [...arvore.aprendidas, chave];
  return { ...ficha, _arvoreLinhagem: { ...arvore, aprendidas } };
}

export function vincularEnergiaPorPericia(
  ficha: EpitomeFicha,
  tribo: LinhagemDefinida,
  pericia: PericiaKey | null
): EpitomeFicha {
  if (!ficha.linhagem || !isLinhagemDefinida(tribo) || tribo === ficha.linhagem) return ficha;
  if (pericia !== null && !Object.hasOwn(ficha._pericias, pericia)) return ficha;

  const arvore = ficha._arvoreLinhagem;
  if ((arvore.energiasPorPericia[tribo] ?? null) === pericia) return ficha;
  const energiasPorPericia = { ...arvore.energiasPorPericia };
  if (pericia === null) delete energiasPorPericia[tribo];
  else energiasPorPericia[tribo] = pericia;
  const ativa = obterHabilidadeExterna(ficha);
  const habilidadeExterna = pericia === null && ativa?.ramo === tribo ? null : arvore.habilidadeExterna;
  return { ...ficha, _arvoreLinhagem: { ...arvore, energiasPorPericia, habilidadeExterna } };
}
