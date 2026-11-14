import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  Plus,
  Skull,
  Swords,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { BestiaryMonster } from '../../bestiary/bestiaryTypes';
import {
  calcularPerfilCombate,
  criarMonstroEmBranco,
  DIETAS_SUGERIDAS,
  ELEMENTOS,
  importarBestiarioHeartzLink,
  listarMonstros,
  listarRegioes,
  normalizarBestiario,
  RARIDADES,
} from '../../bestiary/bestiaryEngine';
import { importAndProcessImageFile } from '../../utils/imageProcessor';
import { TokenAvatar } from '../common/TokenAvatar';
import styles from './GlossarioMonstros.module.css';

type ElementoFiltro = 'ALL' | string;

export const GlossarioMonstros: React.FC = () => {
  const bestiaryCatalog = useGameStore((s) => s.bestiaryCatalog);
  const setActiveScreen = useGameStore((s) => s.setActiveScreen);
  const refreshBestiary = useGameStore((s) => s.refreshBestiary);
  const upsertMonster = useGameStore((s) => s.upsertMonster);
  const duplicateMonster = useGameStore((s) => s.duplicateMonster);
  const deleteMonster = useGameStore((s) => s.deleteMonster);
  const importBestiary = useGameStore((s) => s.importBestiary);
  const summonMonsterOnBoard = useGameStore((s) => s.summonMonsterOnBoard);
  const showToast = useGameStore((s) => s.showToast);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState('');
  const [elementoFiltro, setElementoFiltro] = useState<ElementoFiltro>('ALL');
  const [regiaoFiltro, setRegiaoFiltro] = useState<string>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [draft, setDraft] = useState<BestiaryMonster | null>(null);
  const [novaRegiao, setNovaRegiao] = useState('');
  const [novaPresa, setNovaPresa] = useState('');

  useEffect(() => {
    refreshBestiary();
  }, [refreshBestiary]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') setActiveScreen('glossario');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setActiveScreen]);

  const allMonsters = useMemo(
    () => listarMonstros(bestiaryCatalog),
    [bestiaryCatalog]
  );

  const regioesDisponiveis = useMemo(
    () => listarRegioes(bestiaryCatalog),
    [bestiaryCatalog]
  );

  const elementosEmUso = useMemo(() => {
    const set = new Set<string>();
    for (const m of allMonsters) for (const el of m.elementos) set.add(el);
    return ELEMENTOS.filter((el) => set.has(el.id));
  }, [allMonsters]);

  const filteredMonsters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allMonsters.filter((m) => {
      if (elementoFiltro !== 'ALL' && !m.elementos.includes(elementoFiltro)) {
        return false;
      }
      if (regiaoFiltro !== 'ALL' && !m.regioes.includes(regiaoFiltro)) {
        return false;
      }
      if (!q) return true;
      return (
        m.nome.toLowerCase().includes(q) ||
        m.alias.toLowerCase().includes(q) ||
        m.dieta.toLowerCase().includes(q) ||
        m.elementos.some((el) => el.toLowerCase().includes(q)) ||
        m.regioes.some((r) => r.toLowerCase().includes(q))
      );
    });
  }, [allMonsters, search, elementoFiltro, regiaoFiltro]);

  useEffect(() => {
    if (selectedId && bestiaryCatalog.monsters[selectedId]) return;
    setSelectedId(allMonsters[0]?.id ?? null);
  }, [allMonsters, selectedId, bestiaryCatalog.monsters]);

  const activeMonster = selectedId
    ? bestiaryCatalog.monsters[selectedId] ?? null
    : null;

  // Sincroniza o rascunho apenas quando muda de monstro
  useEffect(() => {
    setDraft(
      activeMonster
        ? {
            ...activeMonster,
            habilidades: {
              fisico: { ...activeMonster.habilidades.fisico },
              magico: { ...activeMonster.habilidades.magico },
              extras: { ...activeMonster.habilidades.extras },
            },
            regioes: [...activeMonster.regioes],
            presas: [...activeMonster.presas],
            elementos: [...activeMonster.elementos],
            itensExtraiveis: activeMonster.itensExtraiveis.map((i) => ({
              ...i,
            })),
          }
        : null
    );
    setConfirmDeleteId(null);
    setNovaRegiao('');
    setNovaPresa('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonster?.id]);

  const perfil = draft ? calcularPerfilCombate(draft) : null;

  const commit = (monstro: BestiaryMonster, silent = true) => {
    setDraft(monstro);
    upsertMonster(monstro);
    if (!silent) {
      showToast(`Criatura "${monstro.nome}" guardada no Bestiário!`);
    }
  };

  const patch = (partial: Partial<BestiaryMonster>, silent = true) => {
    if (!draft) return;
    commit({ ...draft, ...partial }, silent);
  };

  const setStatFisico = (key: keyof BestiaryMonster['habilidades']['fisico'], v: number) => {
    if (!draft) return;
    commit({
      ...draft,
      habilidades: {
        ...draft.habilidades,
        fisico: { ...draft.habilidades.fisico, [key]: Math.max(0, Math.round(v) || 0) },
      },
    });
  };

  const setStatMagico = (key: keyof BestiaryMonster['habilidades']['magico'], v: number) => {
    if (!draft) return;
    commit({
      ...draft,
      habilidades: {
        ...draft.habilidades,
        magico: { ...draft.habilidades.magico, [key]: Math.max(0, Math.round(v) || 0) },
      },
    });
  };

  const toggleElemento = (id: string) => {
    if (!draft) return;
    const tem = draft.elementos.includes(id);
    commit({
      ...draft,
      elementos: tem
        ? draft.elementos.filter((e) => e !== id)
        : [...draft.elementos, id],
    });
  };

  const handleCreateMonster = () => {
    const novo = criarMonstroEmBranco('Nova Criatura');
    novo.dieta = 'Carnívoro';
    upsertMonster(novo);
    setSelectedId(novo.id);
    showToast('Nova criatura criada — defina os Pontos de Classificação.');
  };

  const handleDuplicate = () => {
    if (!draft) return;
    const novoId = duplicateMonster(draft.id);
    if (novoId) {
      setSelectedId(novoId);
      showToast('Criatura duplicada no Bestiário!');
    }
  };

  const handleDelete = () => {
    if (!draft) return;
    if (confirmDeleteId === draft.id) {
      const delId = draft.id;
      deleteMonster(delId);
      setSelectedId(null);
      setConfirmDeleteId(null);
      showToast('Criatura removida do Bestiário.');
      return;
    }
    setConfirmDeleteId(draft.id);
    setTimeout(() => {
      setConfirmDeleteId((cur) => (cur === draft.id ? null : cur));
    }, 3200);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !draft) return;
    try {
      const imgId = await importAndProcessImageFile(file);
      patch({ imagemId: imgId });
      showToast('Retrato da criatura atualizado!');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao processar a imagem.');
    }
    e.target.value = '';
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const texto = await file.text();
      const parsed = JSON.parse(texto);
      const { catalog, total } = importarBestiarioHeartzLink(parsed);

      let lista = Object.values(catalog.monsters);
      if (lista.length === 0) {
        lista = Object.values(normalizarBestiario(parsed).monsters);
      }
      if (lista.length === 0) {
        showToast('Nenhum monstro encontrado no ficheiro.');
        e.target.value = '';
        return;
      }
      const inseridos = await importBestiary(lista);
      setSelectedId(lista[0].id);
      showToast(
        `${inseridos} criatura(s) importada(s) do Heartz-Link${total ? '' : ''}!`
      );
    } catch (err: any) {
      showToast(err?.message || 'Ficheiro JSON inválido.');
    }
    e.target.value = '';
  };

  const handleSummon = async () => {
    if (!draft) return;
    const charId = await summonMonsterOnBoard(draft.id);
    if (charId) setActiveScreen('tabuleiro');
  };

  const addRegiao = () => {
    const nome = novaRegiao.trim();
    if (!draft || !nome || draft.regioes.includes(nome)) {
      setNovaRegiao('');
      return;
    }
    patch({ regioes: [...draft.regioes, nome] });
    setNovaRegiao('');
  };

  const addPresa = () => {
    const nome = novaPresa.trim();
    if (!draft || !nome || draft.presas.includes(nome)) {
      setNovaPresa('');
      return;
    }
    patch({ presas: [...draft.presas, nome] });
    setNovaPresa('');
  };

  const sugerirDieta = (d: string) => {
    if (!draft) return;
    patch({ dieta: d });
  };

  return (
    <div className={styles.screen}>
      <div className={styles.container}>
        <header className={styles.topBar}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Glossário — Bestiário</h1>
            <p className={styles.subtitle}>
              Criaturas do mundo, os seus Pontos de Classificação e a invocação
              direta para o Tabuleiro
            </p>
          </div>

          <div className={styles.topActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setActiveScreen('glossario')}
            >
              &#9664; Glossário
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => jsonInputRef.current?.click()}
              title="Importar monstros exportados pelo Heartz-Link ou por este Bestiário"
            >
              <Download size={13} />
              <span>Importar JSON</span>
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setActiveScreen('tabuleiro')}
            >
              &#9820; Tabuleiro
            </button>
          </div>
        </header>

        <div className={styles.workspace}>
          {/* COLUNA ESQUERDA — Lista de Criaturas */}
          <aside className={styles.panel}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Bestiário ({allMonsters.length})
              </h2>
              <button
                type="button"
                className={styles.btnPrimary}
                style={{ padding: '5px 10px', fontSize: 10.5 }}
                onClick={handleCreateMonster}
              >
                <Plus size={13} />
                <span>Nova</span>
              </button>
            </div>

            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar por nome, alcunha, região..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {regioesDisponiveis.length > 0 && (
              <div className={styles.filterRow}>
                <button
                  type="button"
                  className={`${styles.filterChip} ${
                    regiaoFiltro === 'ALL' ? styles.filterChipActive : ''
                  }`}
                  onClick={() => setRegiaoFiltro('ALL')}
                >
                  Todas as regiões
                </button>
                {regioesDisponiveis.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`${styles.filterChip} ${
                      regiaoFiltro === r ? styles.filterChipActive : ''
                    }`}
                    onClick={() => setRegiaoFiltro(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            {elementosEmUso.length > 0 && (
              <div className={styles.filterRow} style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className={`${styles.filterChip} ${
                    elementoFiltro === 'ALL' ? styles.filterChipActive : ''
                  }`}
                  onClick={() => setElementoFiltro('ALL')}
                >
                  Todos os elementos
                </button>
                {elementosEmUso.map((el) => (
                  <button
                    key={el.id}
                    type="button"
                    className={`${styles.filterChip} ${
                      elementoFiltro === el.id ? styles.filterChipActive : ''
                    }`}
                    onClick={() => setElementoFiltro(el.id)}
                  >
                    {el.simbolo} {el.id}
                  </button>
                ))}
              </div>
            )}

            {filteredMonsters.length === 0 ? (
              <div className={styles.emptyState}>
                Nenhuma criatura encontrada. Crie uma nova ou importe um
                bestiário do Heartz-Link.
              </div>
            ) : (
              <div className={styles.monsterList}>
                {filteredMonsters.map((m) => {
                  const p = calcularPerfilCombate(m);
                  const badgeClass =
                    p.nivelAmeaca >= 4
                      ? styles.threatBadgeHigh
                      : p.nivelAmeaca <= 1
                      ? styles.threatBadgeLow
                      : '';
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`${styles.monsterItem} ${
                        m.id === selectedId ? styles.monsterItemActive : ''
                      }`}
                      onClick={() => setSelectedId(m.id)}
                    >
                      <span className={styles.monsterItemLeft}>
                        <TokenAvatar
                          imageId={m.imagemId || ''}
                          alt={m.nome}
                          size={30}
                          borderColor="rgba(196, 137, 26, 0.55)"
                          fallbackText={m.nome}
                        />
                        <span style={{ minWidth: 0 }}>
                          <span
                            className={styles.monsterItemName}
                            style={{ display: 'block' }}
                          >
                            {m.nome}
                          </span>
                          <span
                            className={styles.monsterItemMeta}
                            style={{ display: 'block' }}
                          >
                            {[
                              p.faixaAmeaca,
                              m.elementos.join(', '),
                              m.regioes[0],
                            ]
                              .filter(Boolean)
                              .join(' • ')}
                          </span>
                        </span>
                      </span>
                      <span className={`${styles.threatBadge} ${badgeClass}`}>
                        {p.totalPontos} pts
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          {/* COLUNA DIREITA — Ficha da Criatura */}
          <main className={styles.panel}>
            {!draft ? (
              <div className={styles.emptyState}>
                Selecione uma criatura do Bestiário para editar.
              </div>
            ) : (
              <div className={styles.editorStack}>
                {/* Identidade + Retrato */}
                <div className={styles.identityBar}>
                  <div className={styles.identityLeft}>
                    <div className={styles.portrait}>
                      {draft.imagemId ? (
                        <TokenAvatar
                          imageId={draft.imagemId}
                          alt={draft.nome}
                          size={72}
                          borderColor="rgba(196, 137, 26, 0.5)"
                          fallbackText={draft.nome}
                        />
                      ) : (
                        <span aria-hidden="true">
                          {draft.elementos.length > 0
                            ? ELEMENTOS.find(
                                (e) => e.id === draft.elementos[0]
                              )?.simbolo || '☠'
                            : '☠'}
                        </span>
                      )}
                    </div>

                    <div className={styles.iconActions}>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => imageInputRef.current?.click()}
                      >
                        <Upload size={13} />
                        <span>Retrato</span>
                      </button>
                      {draft.imagemId && (
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={() => patch({ imagemId: null })}
                        >
                          <X size={13} />
                          <span>Remover</span>
                        </button>
                      )}
                    </div>

                    <div style={{ minWidth: 180, flex: 1 }}>
                      <div className={styles.field}>
                        <label className={styles.label}>Nome da Criatura</label>
                        <input
                          className={styles.input}
                          value={draft.nome}
                          onChange={(e) =>
                            setDraft({ ...draft, nome: e.target.value })
                          }
                          onBlur={() =>
                            patch({
                              nome: draft.nome.trim() || 'Criatura Sem Nome',
                            })
                          }
                        />
                      </div>
                      <div className={styles.field} style={{ marginTop: 8 }}>
                        <label className={styles.label}>Alcunha Conhecida</label>
                        <input
                          className={styles.input}
                          placeholder="Ex: Foice-de-deus"
                          value={draft.alias}
                          onChange={(e) =>
                            setDraft({ ...draft, alias: e.target.value })
                          }
                          onBlur={() => patch({ alias: draft.alias.trim() })}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={handleDuplicate}
                      title="Duplicar criatura"
                    >
                      <Copy size={13} />
                      <span>Duplicar</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.btnDanger} ${
                        confirmDeleteId === draft.id
                          ? styles.btnDangerConfirm
                          : ''
                      }`}
                      onClick={handleDelete}
                      title="Apagar criatura do Bestiário"
                    >
                      <Trash2 size={13} />
                      <span>
                        {confirmDeleteId === draft.id
                          ? 'Confirmar?'
                          : 'Apagar'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Regiões / Presas / Dieta */}
                <section>
                  <h3 className={styles.subTitle}>
                    Regiões, Dieta &amp; Presas
                  </h3>

                  <div className={styles.formGrid2}>
                    <div className={styles.field}>
                      <label className={styles.label}>Regiões / Locais</label>
                      <div className={styles.tagInputRow}>
                        <input
                          className={styles.input}
                          placeholder="Ex: Verlas Ruinas"
                          value={novaRegiao}
                          onChange={(e) => setNovaRegiao(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addRegiao();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={addRegiao}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <div className={styles.tagRow}>
                        {draft.regioes.length === 0 && (
                          <span className={styles.hint}>
                            Sem região atribuída.
                          </span>
                        )}
                        {draft.regioes.map((r) => (
                          <span key={r} className={styles.tag}>
                            <span aria-hidden="true">&#128205;</span> {r}
                            <button
                              type="button"
                              className={styles.tagRemove}
                              onClick={() =>
                                patch({
                                  regioes: draft.regioes.filter((x) => x !== r),
                                })
                              }
                              aria-label={`Remover ${r}`}
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Presas (outros monstros)</label>
                      <div className={styles.tagInputRow}>
                        <input
                          className={styles.input}
                          placeholder="Ex: Coelho"
                          list="bestiary-prey-list"
                          value={novaPresa}
                          onChange={(e) => setNovaPresa(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addPresa();
                            }
                          }}
                        />
                        <datalist id="bestiary-prey-list">
                          {allMonsters
                            .filter((m) => m.id !== draft.id)
                            .map((m) => (
                              <option key={m.id} value={m.nome} />
                            ))}
                        </datalist>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={addPresa}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <div className={styles.tagRow}>
                        {draft.presas.length === 0 && (
                          <span className={styles.hint}>Nenhuma presa.</span>
                        )}
                        {draft.presas.map((p) => (
                          <span key={p} className={styles.tag}>
                            {p}
                            <button
                              type="button"
                              className={styles.tagRemove}
                              onClick={() =>
                                patch({
                                  presas: draft.presas.filter((x) => x !== p),
                                })
                              }
                              aria-label={`Remover ${p}`}
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={styles.formGrid2}>
                    <div className={styles.field}>
                      <label className={styles.label}>Dieta</label>
                      <input
                        className={styles.input}
                        placeholder="Ex: Carnívoro"
                        value={draft.dieta}
                        onChange={(e) =>
                          setDraft({ ...draft, dieta: e.target.value })
                        }
                        onBlur={() => patch({ dieta: draft.dieta.trim() })}
                      />
                      <div className={styles.tagRow}>
                        {DIETAS_SUGERIDAS.map((d) => (
                          <button
                            key={d}
                            type="button"
                            className={styles.filterChip}
                            onClick={() => sugerirDieta(d)}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={styles.field} style={{ marginTop: 12 }}>
                    <label className={styles.label}>
                      Descrição / Aparência
                    </label>
                    <textarea
                      className={styles.textarea}
                      placeholder="Aparência, comportamento, origem, hábitos de caça..."
                      value={draft.descricao}
                      onChange={(e) =>
                        setDraft({ ...draft, descricao: e.target.value })
                      }
                      onBlur={() => patch({ descricao: draft.descricao })}
                    />
                  </div>
                </section>

                {/* Pontos de Classificação */}
                <section>
                  <h3 className={styles.subTitle}>
                    Pontos de Classificação
                  </h3>

                  <div className={styles.statRow}>
                    <div className={styles.statField}>
                      <span className={styles.statLabel}>Rapidez</span>
                      <input
                        type="number"
                        min={0}
                        className={styles.statInput}
                        value={draft.habilidades.fisico.rapidez}
                        onChange={(e) =>
                          setStatFisico('rapidez', Number(e.target.value))
                        }
                      />
                    </div>
                    <div className={styles.statField}>
                      <span className={styles.statLabel}>Força</span>
                      <input
                        type="number"
                        min={0}
                        className={styles.statInput}
                        value={draft.habilidades.fisico.forca}
                        onChange={(e) =>
                          setStatFisico('forca', Number(e.target.value))
                        }
                      />
                    </div>
                    <div className={styles.statField}>
                      <span className={styles.statLabel}>Resistência</span>
                      <input
                        type="number"
                        min={0}
                        className={styles.statInput}
                        value={draft.habilidades.fisico.resistencia}
                        onChange={(e) =>
                          setStatFisico('resistencia', Number(e.target.value))
                        }
                      />
                    </div>
                  </div>

                  <div className={styles.statRow}>
                    <div className={styles.statField}>
                      <span className={styles.statLabel}>Artesanato</span>
                      <input
                        type="number"
                        min={0}
                        className={styles.statInput}
                        value={draft.habilidades.magico.artesanato}
                        onChange={(e) =>
                          setStatMagico('artesanato', Number(e.target.value))
                        }
                      />
                    </div>
                    <div className={styles.statField}>
                      <span className={styles.statLabel}>Impacto</span>
                      <input
                        type="number"
                        min={0}
                        className={styles.statInput}
                        value={draft.habilidades.magico.impacto}
                        onChange={(e) =>
                          setStatMagico('impacto', Number(e.target.value))
                        }
                      />
                    </div>
                    <div className={styles.statField}>
                      <span className={styles.statLabel}>Manipulação</span>
                      <input
                        type="number"
                        min={0}
                        className={styles.statInput}
                        value={draft.habilidades.magico.manipulacao}
                        onChange={(e) =>
                          setStatMagico('manipulacao', Number(e.target.value))
                        }
                      />
                    </div>
                  </div>

                  {/* Habilidades Extra */}
                  <div className={styles.dynamicList}>
                    {Object.entries(draft.habilidades.extras).map(
                      ([nome, valor]) => (
                        <div
                          key={nome}
                          className={`${styles.dynamicRow} ${styles.dynamicRowExtras}`}
                        >
                          <input
                            className={styles.input}
                            value={nome}
                            aria-label="Nome da perícia extra"
                            onChange={(e) => {
                              const novo = e.target.value;
                              const extras: Record<string, number> = {};
                              for (const [k, v] of Object.entries(
                                draft.habilidades.extras
                              )) {
                                extras[k === nome ? novo : k] = v;
                              }
                              setDraft({
                                ...draft,
                                habilidades: {
                                  ...draft.habilidades,
                                  extras,
                                },
                              });
                            }}
                            onBlur={() => commit(draft)}
                          />
                          <input
                            type="number"
                            min={0}
                            className={styles.statInput}
                            value={valor}
                            aria-label="Valor da perícia extra"
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                habilidades: {
                                  ...draft.habilidades,
                                  extras: {
                                    ...draft.habilidades.extras,
                                    [nome]: Math.max(
                                      0,
                                      Math.round(Number(e.target.value)) || 0
                                    ),
                                  },
                                },
                              })
                            }
                            onBlur={() => commit(draft)}
                          />
                          <button
                            type="button"
                            className={styles.rowRemove}
                            aria-label={`Remover perícia ${nome}`}
                            onClick={() => {
                              const extras = { ...draft.habilidades.extras };
                              delete extras[nome];
                              patch({
                                habilidades: { ...draft.habilidades, extras },
                              });
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )
                    )}
                  </div>

                  <div className={styles.tagRow}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => {
                        let nome = 'Nova Perícia';
                        let i = 2;
                        while (draft.habilidades.extras[nome] !== undefined) {
                          nome = `Nova Perícia ${i++}`;
                        }
                        patch({
                          habilidades: {
                            ...draft.habilidades,
                            extras: { ...draft.habilidades.extras, [nome]: 0 },
                          },
                        });
                      }}
                    >
                      <Plus size={13} />
                      <span>Perícia Extra</span>
                    </button>
                  </div>
                </section>

                {/* Elementos */}
                <section>
                  <h3 className={styles.subTitle}>Atributos Elementais</h3>
                  <div className={styles.elementGrid}>
                    {ELEMENTOS.map((el) => {
                      const ativo = draft.elementos.includes(el.id);
                      return (
                        <button
                          key={el.id}
                          type="button"
                          className={`${styles.elementChip} ${
                            ativo ? styles.elementChipActive : ''
                          }`}
                          style={
                            ativo
                              ? {
                                  background: el.cor,
                                  borderColor: el.cor,
                                }
                              : undefined
                          }
                          onClick={() => toggleElemento(el.id)}
                        >
                          <span aria-hidden="true">{el.simbolo}</span>
                          {el.id}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Itens extraíveis */}
                <section>
                  <h3 className={styles.subTitle}>Itens Extraíveis</h3>

                  <div className={styles.dynamicList}>
                    {draft.itensExtraiveis.length === 0 && (
                      <span className={styles.hint}>
                        Nenhum item registado para esta criatura.
                      </span>
                    )}
                    {draft.itensExtraiveis.map((item, idx) => (
                      <div
                        key={idx}
                        className={`${styles.dynamicRow} ${styles.dynamicRowLoot}`}
                      >
                        <input
                          className={styles.input}
                          placeholder="Nome do item"
                          value={item.nome}
                          onChange={(e) => {
                            const itens = draft.itensExtraiveis.map((it, i) =>
                              i === idx ? { ...it, nome: e.target.value } : it
                            );
                            setDraft({ ...draft, itensExtraiveis: itens });
                          }}
                          onBlur={() => commit(draft)}
                        />
                        <select
                          className={styles.select}
                          value={item.raridade}
                          onChange={(e) => {
                            const itens = draft.itensExtraiveis.map((it, i) =>
                              i === idx
                                ? { ...it, raridade: e.target.value }
                                : it
                            );
                            patch({ itensExtraiveis: itens });
                          }}
                        >
                          {RARIDADES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          className={styles.statInput}
                          value={item.dificuldade}
                          onChange={(e) => {
                            const itens = draft.itensExtraiveis.map((it, i) =>
                              i === idx
                                ? {
                                    ...it,
                                    dificuldade:
                                      Math.max(
                                        0,
                                        Math.round(Number(e.target.value)) || 0
                                      ),
                                  }
                                : it
                            );
                            setDraft({ ...draft, itensExtraiveis: itens });
                          }}
                          onBlur={() => commit(draft)}
                          aria-label="Dificuldade de extração"
                        />
                        <button
                          type="button"
                          className={styles.rowRemove}
                          aria-label={`Remover item ${item.nome}`}
                          onClick={() =>
                            patch({
                              itensExtraiveis: draft.itensExtraiveis.filter(
                                (_, i) => i !== idx
                              ),
                            })
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className={styles.tagRow}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() =>
                        patch({
                          itensExtraiveis: [
                            ...draft.itensExtraiveis,
                            { nome: '', raridade: 'Comum', dificuldade: 5 },
                          ],
                        })
                      }
                    >
                      <Plus size={13} />
                      <span>Adicionar Item</span>
                    </button>
                  </div>
                </section>

                {/* Perfil tático + invocação */}
                {perfil && (
                  <section>
                    <h3 className={styles.subTitle}>
                      Adaptação ao Tabuleiro
                    </h3>
                    <div className={styles.profileGrid}>
                      <div className={styles.profileStat}>
                        <div className={styles.profileValue}>{perfil.vida}</div>
                        <div className={styles.profileLabel}>Vida</div>
                      </div>
                      <div className={styles.profileStat}>
                        <div className={styles.profileValue}>
                          {perfil.movimento}
                        </div>
                        <div className={styles.profileLabel}>Movimento</div>
                      </div>
                      <div className={styles.profileStat}>
                        <div className={styles.profileValue}>
                          {perfil.danoFisico}
                        </div>
                        <div className={styles.profileLabel}>Dano Físico</div>
                      </div>
                      <div className={styles.profileStat}>
                        <div className={styles.profileValue}>
                          {perfil.danoMagico}
                        </div>
                        <div className={styles.profileLabel}>Dano Mágico</div>
                      </div>
                      <div className={styles.profileStat}>
                        <div className={styles.profileValue}>
                          {perfil.largura}×{perfil.altura}
                        </div>
                        <div className={styles.profileLabel}>Área Grid</div>
                      </div>
                      <div className={styles.profileStat}>
                        <div className={styles.profileValue}>
                          {perfil.totalPontos}
                        </div>
                        <div className={styles.profileLabel}>
                          {perfil.faixaAmeaca}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                        marginTop: 12,
                      }}
                    >
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={handleSummon}
                        title="Criar o token desta criatura no Tabuleiro com os ataques naturais"
                      >
                        <Swords size={14} />
                        <span>Invocar no Tabuleiro</span>
                      </button>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => commit(draft, false)}
                      >
                        <Skull size={14} />
                        <span>Guardar Criatura</span>
                      </button>
                    </div>
                    <p className={styles.hint} style={{ marginTop: 8 }}>
                      A conversão é determinística: Resistência define a Vida,
                      Rapidez o Movimento, Força o Dano Físico e Impacto +
                      Manipulação o Dano Mágico. Criaturas Grandes ou maiores
                      recebem também o ataque <em>Investida</em>; com Dano
                      Mágico &gt; 0 ganham <em>Descarga Elemental</em>.
                    </p>
                  </section>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />
      <input
        ref={jsonInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handleImportJSON}
      />
    </div>
  );
};
