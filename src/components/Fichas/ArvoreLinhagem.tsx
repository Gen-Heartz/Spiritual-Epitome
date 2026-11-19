import { useEffect, useId, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleDot,
  Eye,
  Fingerprint,
  Gem,
  HeartPulse,
  Link2,
  Mountain,
  Orbit,
  Plus,
  Sparkles,
  Zap,
} from 'lucide-react';
import { PERICIAS_GRUPOS } from '../../epitome/epitomeEngine';
import type {
  EpitomeFicha,
  FacetaLinhagemKey,
  LinhagemDefinida,
  LinhagemKey,
  PericiaKey,
  RamoLinhagemKey,
} from '../../epitome/epitomeTypes';
import { FACETAS, ORDEM_TRIBOS, TRIBOS } from '../../epitome/linhagemCatalogo';
import type { RegraLinhagem } from '../../epitome/linhagemCatalogo';
import {
  alternarHabilidadeLinhagem,
  calcularPontosLinhagem,
  CUSTO_HABILIDADE_EXTERNA,
  idHabilidadeLinhagem,
  mudarRaizLinhagem,
  obterHabilidadeExterna,
  PONTOS_LINHAGEM_POR_NIVEL,
  situacaoHabilidadeLinhagem,
  vincularEnergiaPorPericia,
} from '../../epitome/linhagemEngine';
import type { PontosLinhagem } from '../../epitome/linhagemEngine';
import styles from './ArvoreLinhagem.module.css';

type AtualizarFicha = (fn: (ficha: EpitomeFicha) => EpitomeFicha) => void;
interface ArvoreProps {
  ficha: EpitomeFicha;
  atualizarFicha: AtualizarFicha;
}

const ICONES = {
  pungente: HeartPulse,
  erudita: Orbit,
  agraco: Mountain,
  desperta: Eye,
  espectro: Fingerprint,
  material: Gem,
  efetiva: Zap,
};
const ORDEM_RAMOS = ['material', 'herdada', 'efetiva'] as const;
type PainelRamo = FacetaLinhagemKey | 'herdada';
const NUMERAIS = ['I', 'II', 'III', 'IV', 'V'];
const PERICIAS_LABELS = Object.fromEntries(
  PERICIAS_GRUPOS.flatMap((grupo) => grupo.pericias.map((pericia) => [pericia.key, pericia.label]))
) as Record<PericiaKey, string>;

function CartaCeleste() {
  return (
    <svg className={styles.cartaCeleste} viewBox="0 0 248 248" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="0.75">
        <circle cx="124" cy="124" r="112" strokeDasharray="1 5" />
        <circle cx="124" cy="124" r="102" />
        <circle cx="124" cy="124" r="89" />
        <circle cx="124" cy="124" r="64" strokeDasharray="5 6" />
        <circle cx="124" cy="124" r="26" />
        <path d="M124 2v244M2 124h244M45 45l158 158M203 45 45 203" />
        <path d="m124 22 102 102-102 102L22 124Z" />
        <path d="M61 61h126v126H61z" />
        <path d="m124 63 13 48 48 13-48 13-13 48-13-48-48-13 48-13Z" />
      </g>
      <g fill="currentColor">
        <circle cx="124" cy="22" r="3" />
        <circle cx="22" cy="124" r="3" />
        <circle cx="226" cy="124" r="3" />
        <circle cx="124" cy="226" r="3" />
        <circle cx="124" cy="124" r="3.6" />
      </g>
    </svg>
  );
}

function Selo({ tribo }: { tribo: LinhagemDefinida }) {
  const Icone = ICONES[tribo];
  return (
    <span className={styles.selo} aria-hidden="true">
      <Icone size={26} strokeWidth={1.5} />
    </span>
  );
}

function PainelPontos({ nivel, pontos }: { nivel: number; pontos: PontosLinhagem }) {
  return (
    <aside className={styles.painelPontos} aria-label="Pontos de habilidade">
      <div className={styles.pontosCabecalho}>
        <p><Gem size={13} aria-hidden="true" /> Pontos de habilidade</p>
        <span>Nível {nivel} · +{PONTOS_LINHAGEM_POR_NIVEL} por nível</span>
      </div>
      <dl className={styles.pontosContagem} aria-live="polite" aria-atomic="true">
        <div><dt>Disponíveis</dt><dd>{pontos.disponiveis}</dd></div>
        <div><dt>Gastos</dt><dd>{pontos.gastos}</dd></div>
        <div><dt>Total</dt><dd>{pontos.total}</dd></div>
      </dl>
      {pontos.excedente > 0 && (
        <p className={styles.pontosAviso} role="status">
          {pontos.excedente} {pontos.excedente === 1 ? 'ponto gasto' : 'pontos gastos'} acima do limite.
          Desmarque habilidades ou suba de nível para liberar pontos novamente.
        </p>
      )}
    </aside>
  );
}

export function ArvoreLinhagem({ ficha, atualizarFicha }: ArvoreProps) {
  const [trocando, setTrocando] = useState(false);
  const tituloId = useId();
  const tituloView = useRef<HTMLHeadingElement>(null);
  const moverFoco = useRef(false);
  const escolher = !ficha.linhagem || trocando;

  useEffect(() => {
    if (moverFoco.current) {
      tituloView.current?.focus({ preventScroll: true });
      moverFoco.current = false;
    }
  }, [escolher, ficha.linhagem]);

  const mostrarEscolha = (mostrar: boolean) => {
    moverFoco.current = true;
    setTrocando(mostrar);
  };

  const definirLinhagem = (linhagem: LinhagemKey) => {
    moverFoco.current = true;
    atualizarFicha((prev) => mudarRaizLinhagem(prev, linhagem));
    setTrocando(false);
  };

  return (
    <section className={styles.atlas} aria-labelledby={tituloId}>
      <header className={styles.masthead}>
        <CartaCeleste />
        <div>
          <p className={styles.sobretitulo}><Sparkles size={13} aria-hidden="true" /> Arquivo espiritual</p>
          <h2 id={tituloId}>Árvore de Linhagem</h2>
          <p className={styles.subtitulo}>Use seus pontos para aprender técnicas da linhagem e das Facetas.</p>
        </div>
        <PainelPontos nivel={ficha.nivel} pontos={calcularPontosLinhagem(ficha)} />
      </header>

      <div className={styles.conteudo}>
        {escolher ? (
          <div>
            <div className={styles.cabecalhoEscolha}>
              <div>
                <p className={styles.legenda}>01 / Origem</p>
                <h3 className={styles.tituloSecao} ref={tituloView} tabIndex={-1}>Escolha sua linhagem</h3>
                <p className={styles.textoSecao}>A sua tribo define a energia inata do personagem.</p>
              </div>
              {ficha.linhagem && (
                <button className={styles.botaoDiscreto} type="button" onClick={() => mostrarEscolha(false)}>
                  <ArrowLeft size={14} aria-hidden="true" /> Voltar à árvore
                </button>
              )}
            </div>
            <ul className={styles.tribos} aria-label="Linhagens disponíveis">
              {ORDEM_TRIBOS.map((id, i) => {
                const tribo = TRIBOS[id];
                const atual = id === ficha.linhagem;
                return (
                  <li key={id}>
                    <button
                      className={styles.triboCard}
                      data-tom={id}
                      data-atual={atual}
                      type="button"
                      onClick={() => definirLinhagem(id)}
                    >
                      <span className={styles.triboIndice} aria-hidden="true">{NUMERAIS[i]}</span>
                      <Selo tribo={id} />
                      <span className={styles.triboNome}>Tribo {tribo.nome}</span>
                      <span className={styles.triboEnergia}>{tribo.energia}</span>
                      <span className={styles.triboAcao} aria-hidden="true">
                        {atual ? <><Check size={13} /> Atual</> : <>Escolher <ArrowRight size={13} /></>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {ficha.linhagem ? (
              <div className={styles.rodapeEscolha}>
                <p>As habilidades da raiz anterior ficam arquivadas e não gastam pontos enquanto ela estiver inativa.</p>
                <button className={styles.botaoDiscreto} type="button" onClick={() => definirLinhagem('')}>
                  Remover linhagem
                </button>
              </div>
            ) : (
              <p className={styles.dicaMapeamento}><Link2 size={15} aria-hidden="true" />
                Depois da escolha, você pode vincular outras energias às suas perícias.
              </p>
            )}
          </div>
        ) : ficha.linhagem && (
          <ArvoreAtiva
            key={ficha.linhagem}
            raiz={ficha.linhagem}
            ficha={ficha}
            atualizarFicha={atualizarFicha}
            trocar={() => mostrarEscolha(true)}
            tituloView={tituloView}
          />
        )}
      </div>
    </section>
  );
}

function ArvoreAtiva({ ficha, raiz, atualizarFicha, trocar, tituloView }: ArvoreProps & {
  raiz: LinhagemDefinida;
  trocar: () => void;
  tituloView: RefObject<HTMLHeadingElement>;
}) {
  const [ramoAberto, setRamoAberto] = useState<PainelRamo>('herdada');
  const tribo = TRIBOS[raiz];
  const aprendidas = new Set(ficha._arvoreLinhagem.aprendidas);
  const ramoAbertoId = ramoAberto === 'herdada' ? raiz : ramoAberto;

  return (
    <>
      <div className={styles.barraArvore}>
        <p className={styles.legenda}>02 / Habilidades</p>
        <button className={styles.botaoDiscreto} type="button" onClick={trocar}>
          <ArrowLeft size={14} aria-hidden="true" /> Trocar linhagem
        </button>
      </div>
      <div className={styles.grafo} data-tom={raiz}>
        <div className={styles.raiz}>
          <Selo tribo={raiz} />
          <div>
            <h3 ref={tituloView} tabIndex={-1}>Tribo {tribo.nome}</h3>
            <p className={styles.energiaRaiz}>{tribo.energia} <span>Inata</span></p>
          </div>
          <p className={styles.descricaoRaiz}>{tribo.descricao}</p>
        </div>
        <div className={styles.tronco} aria-hidden="true" />
        <div className={styles.ramos} role="group" aria-label="Ramos da árvore de habilidades">
          {ORDEM_RAMOS.map((ramo) => {
            const herdada = ramo === 'herdada';
            const id = herdada ? raiz : ramo;
            const dados = herdada ? tribo : FACETAS[ramo];
            const Icone = ICONES[id];
            const total = dados.habilidades.filter((h) => aprendidas.has(idHabilidadeLinhagem(id, h.id))).length;
            const ativo = ramoAberto === ramo;
            return (
              <div className={styles.ramoCelula} data-ativo={ativo} key={ramo}>
                <button
                  type="button"
                  className={styles.ramo}
                  data-tom={id}
                  aria-pressed={ativo}
                  onClick={() => setRamoAberto(ramo)}
                >
                  <span className={styles.iconeRamo}><Icone size={18} strokeWidth={1.6} aria-hidden="true" /></span>
                  <span className={styles.infoRamo}>
                    <strong>{herdada ? 'Energia herdada' : FACETAS[ramo].nome}</strong>
                    <small>{herdada ? tribo.energia : FACETAS[ramo].foco}</small>
                  </span>
                  <span className={styles.contagem} aria-label={`${total} de ${dados.habilidades.length} aprendidas`}>
                    {total}/{dados.habilidades.length}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <PainelHabilidades key={ramoAbertoId} ficha={ficha} ramo={ramoAbertoId} atualizarFicha={atualizarFicha} />
      <EnergiasExternas ficha={ficha} raiz={raiz} atualizarFicha={atualizarFicha} />
    </>
  );
}

function PainelHabilidades({ ficha, atualizarFicha, ramo }: ArvoreProps & { ramo: RamoLinhagemKey }) {
  const dados = ramo === 'material' || ramo === 'efetiva' ? FACETAS[ramo] : TRIBOS[ramo];
  const externaAtiva = obterHabilidadeExterna(ficha);
  const ramoExterno = 'regras' in dados && ramo !== ficha.linhagem;
  const [consultando, setConsultando] = useState(
    () => externaAtiva?.ramo === ramo ? externaAtiva.id : dados.habilidades[0].id
  );
  const tituloId = useId();
  const detalheId = useId();
  const avisoId = useId();
  const detalheRef = useRef<HTMLDivElement>(null);
  const selecionada = dados.habilidades.find((h) => h.id === consultando) ?? dados.habilidades[0];
  const aprendidas = new Set(ficha._arvoreLinhagem.aprendidas);
  const { aprendida, custo, bloqueio } = situacaoHabilidadeLinhagem(ficha, ramo, selecionada.id);
  const preco = `${custo} ${custo === 1 ? 'ponto' : 'pontos'}`;
  const aviso = bloqueio === 'limite-externa'
    ? `Você já aprendeu ${externaAtiva?.nome} como habilidade externa. Desmarque-a antes de aprender outra.`
    : bloqueio === 'sem-saldo'
      ? `Pontos insuficientes: esta habilidade exige ${preco} na árvore.`
      : bloqueio === 'sem-vinculo' ? 'Vincule esta energia a uma perícia primeiro.'
      : bloqueio === 'indisponivel' ? 'Esta habilidade não está disponível.' : null;
  const Icone = ICONES[ramo];
  const raizHerdada = ramo === ficha.linhagem;
  const titulo = 'regras' in dados
    ? raizHerdada ? 'Habilidades da linhagem' : `Habilidades · Tribo ${dados.nome}`
    : dados.nome;

  const consultarNo = (id: string, foiClique: boolean) => {
    setConsultando(id);
    if (!foiClique) return;
    // Na ficha estreita, os detalhes ficam abaixo da lista, não ao lado dela.
    requestAnimationFrame(() => {
      const detalhe = detalheRef.current;
      if (detalhe && detalhe.offsetTop > 0) detalhe.scrollIntoView({ block: 'nearest' });
    });
  };

  return (
    <section className={styles.painel} data-tom={ramo} aria-labelledby={tituloId}>
      <header className={styles.cabecalhoRamo}>
        <div>
          <h4 id={tituloId}>{titulo}</h4>
          <p>{'regras' in dados ? 'Selecione uma habilidade para ver o que ela faz.' : dados.descricao}</p>
        </div>
        <span className={styles.totalNos}>{dados.habilidades.length} habilidades</span>
      </header>
      <div className={styles.habilidadesLayout}>
        <div className={styles.nosViewport}>
          <ul className={styles.nos} aria-label={`Nós de ${titulo.toLowerCase()}`}>
            {dados.habilidades.map((habilidade) => {
              const chave = idHabilidadeLinhagem(ramo, habilidade.id);
              const registrada = ramoExterno ? externaAtiva?.chave === chave : aprendidas.has(chave);
              const selecionado = habilidade.id === selecionada.id;
              return (
                <li className={styles.noCelula} key={habilidade.id}>
                  <button
                    className={styles.no}
                    data-aprendida={registrada}
                    aria-pressed={selecionado}
                    aria-controls={detalheId}
                    aria-label={registrada ? `${habilidade.nome} (aprendida)` : habilidade.nome}
                    type="button"
                    onClick={(e) => consultarNo(habilidade.id, e.detail > 0)}
                  >
                    <span className={styles.estadoNo} aria-hidden="true">
                      {registrada ? <Check size={13} /> : <CircleDot size={12} />}
                    </span>
                    <span>{habilidade.nome}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className={styles.detalhe} id={detalheId} ref={detalheRef}>
          <div className={styles.detalheCabecalho}>
            <span className={styles.iconeRamo}><Icone size={18} strokeWidth={1.6} aria-hidden="true" /></span>
            <div className={styles.detalheBadges}>
              <span className={styles.preco}><Gem size={12} aria-hidden="true" /> {preco}</span>
              <span className={styles.estado} data-aprendida={aprendida}>
                {aprendida && <Check size={12} aria-hidden="true" />} {aprendida ? 'Aprendida' : 'Não aprendida'}
              </span>
            </div>
          </div>
          <div className={styles.detalheTexto} aria-live="polite">
            <h5>{selecionada.nome}</h5>
            <p>{selecionada.descricao}</p>
          </div>
          <button
            className={aprendida ? styles.botaoDiscreto : styles.botaoPrimario}
            type="button"
            disabled={bloqueio !== null}
            aria-describedby={aviso ? avisoId : undefined}
            onClick={() => atualizarFicha((prev) => alternarHabilidadeLinhagem(prev, ramo, selecionada.id))}
          >
            {aprendida ? 'Desmarcar aprendizado' : <><Plus size={15} aria-hidden="true" /> Aprender por {preco}</>}
          </button>
          {aviso ? <p className={styles.avisoHabilidade} id={avisoId} role="status">{aviso}</p>
            : aprendida && <p className={styles.dicaReembolso}>Desmarcar devolve {preco}.</p>}
        </div>
      </div>
      {'regras' in dados && <RegrasDaTribo regras={dados.regras} />}
    </section>
  );
}

function RegrasDaTribo({ regras }: { regras: readonly RegraLinhagem[] }) {
  return (
    <div className={styles.regras}>
      <h5><BookOpen size={15} aria-hidden="true" /> Regras da linhagem</h5>
      {regras.map((regra) => (
        <details className={styles.regra} key={regra.titulo}>
          <summary>{regra.titulo}<ChevronDown className={styles.chevron} size={15} aria-hidden="true" /></summary>
          <div className={styles.regraConteudo}>
            {regra.texto && <p>{regra.texto}</p>}
            {regra.tabela && (
              <div className={styles.tabelaWrap}>
                <table aria-label={regra.titulo}>
                  <thead><tr>{regra.tabela.colunas.map((coluna) => <th key={coluna} scope="col">{coluna}</th>)}</tr></thead>
                  <tbody>
                    {regra.tabela.linhas.map(([chave, ...celulas]) => (
                      <tr key={chave}>
                        <th scope="row">{chave}</th>
                        {celulas.map((celula, i) => <td key={i}>{celula}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}

function EnergiasExternas({ ficha, raiz, atualizarFicha }: ArvoreProps & { raiz: LinhagemDefinida }) {
  const externas = ORDEM_TRIBOS.filter((id) => id !== raiz);
  const vinculadas = ficha._arvoreLinhagem.energiasPorPericia;
  const aprendida = obterHabilidadeExterna(ficha);
  const [energia, setEnergia] = useState<LinhagemDefinida | ''>(
    () => aprendida?.ramo ?? externas.find((id) => vinculadas[id]) ?? ''
  );
  const [pericia, setPericia] = useState<PericiaKey | ''>(
    () => (energia ? vinculadas[energia] ?? '' : '')
  );
  const vinculo = energia ? vinculadas[energia] : undefined;
  const escolherEnergia = (nova: LinhagemDefinida | '') => {
    setEnergia(nova);
    setPericia(nova ? vinculadas[nova] ?? '' : '');
  };

  return (
    <details className={styles.externas}>
      <summary>
        <span className={styles.iconeRamo}><Link2 size={18} aria-hidden="true" /></span>
        <span className={styles.infoExternas}>
          <strong>Outras energias</strong>
          <small>Aprendizado por Perícias</small>
        </span>
        <span className={styles.totalNos}>{aprendida ? '1' : '0'}/1 aprendida</span>
        <ChevronDown className={styles.chevron} size={15} aria-hidden="true" />
      </summary>
      <div className={styles.externasConteudo}>
        <p>
          Com aval do mestre, vincule uma energia a uma perícia para consultar suas técnicas.
          Você pode aprender apenas <strong>uma habilidade externa por personagem</strong>.
          Ela custa <strong>{CUSTO_HABILIDADE_EXTERNA} pontos da árvore</strong>; o vínculo não consome pontos de perícia.
        </p>
        {aprendida && (
          <div className={styles.externaAprendida}>
            <p><Check size={14} aria-hidden="true" /> <span><strong>{aprendida.nome}</strong> · Tribo {TRIBOS[aprendida.ramo].nome}</span></p>
            {aprendida.ramo !== energia && (
              <button className={styles.botaoDiscreto} type="button" onClick={() => escolherEnergia(aprendida.ramo)}>
                Ver habilidade aprendida
              </button>
            )}
          </div>
        )}
        <div className={styles.vinculoCampos}>
          <label>
            Energia de origem
            <select value={energia} onChange={(e) => escolherEnergia(e.target.value as LinhagemDefinida | '')}>
              <option value="">Selecione uma energia</option>
              {externas.map((id) => (
                <option value={id} key={id}>{TRIBOS[id].nome} · {TRIBOS[id].energia}{vinculadas[id] ? ' (vinculada)' : ''}</option>
              ))}
            </select>
          </label>
          <label>
            Perícia vinculada
            <select disabled={!energia} value={pericia} onChange={(e) => setPericia(e.target.value as PericiaKey | '')}>
              <option value="">Selecione uma perícia</option>
              {PERICIAS_GRUPOS.map((grupo) => (
                <optgroup key={grupo.id} label={grupo.titulo}>
                  {grupo.pericias.map((item) => (
                    <option value={item.key} key={item.key}>{item.label} ({ficha._pericias[item.key]})</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.vinculoAcoes}>
          <button
            className={styles.botaoPrimario}
            type="button"
            disabled={!energia || !pericia || vinculo === pericia}
            onClick={() => {
              if (energia && pericia) atualizarFicha((prev) => vincularEnergiaPorPericia(prev, energia, pericia));
            }}
          >
            <Link2 size={15} aria-hidden="true" /> {vinculo ? 'Atualizar vínculo' : 'Vincular energia'}
          </button>
          {energia && vinculo && (
            <button
              className={styles.botaoDiscreto}
              type="button"
              onClick={() => {
                setPericia('');
                atualizarFicha((prev) => vincularEnergiaPorPericia(prev, energia, null));
              }}
            >
              {aprendida?.ramo === energia
                ? `Desvincular e devolver ${CUSTO_HABILIDADE_EXTERNA} pontos`
                : 'Desvincular energia'}
            </button>
          )}
        </div>
        {energia && vinculo && (
          <>
            <p className={styles.vinculoStatus}><Check size={14} aria-hidden="true" /> Vinculada à perícia {PERICIAS_LABELS[vinculo]}.</p>
            <PainelHabilidades key={energia} ficha={ficha} ramo={energia} atualizarFicha={atualizarFicha} />
          </>
        )}
      </div>
    </details>
  );
}
