import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Copy,
  Eraser,
  Eye,
  EyeOff,
  LayoutGrid,
  MapPin,
  Moon,
  Mountain,
  Plus,
  Save,
  Star,
  Sun,
  Trash2,
  Trees,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { Direction, TerrainType } from '../../types';
import {
  GameMap,
  MapStair,
  StairDirection,
} from '../../maps/mapTypes';
import {
  calcularVisaoDaUnidade,
} from '../../engine/vision';
import {
  boardDoMapa,
  celulaTemEscada,
  chaveCelula,
  criarMapaEmBranco,
  escadaNaCelula,
  gerarStairId,
  listarMapas,
  normalizarMapa,
  rotuloDirecao,
} from '../../maps/mapEngine';
import styles from './GlossarioMapas.module.css';

type EditorTool = 'normal' | 'difficult' | 'impassable' | `stair_${StairDirection}`;

const SIZE_PRESETS: Array<{ label: string; w: number; h: number }> = [
  { label: 'Pequeno 12×9', w: 12, h: 9 },
  { label: 'Médio 20×15', w: 20, h: 15 },
  { label: 'Grande 28×20', w: 28, h: 20 },
  { label: 'Salão 32×24', w: 32, h: 24 },
];

export const GlossarioMapas: React.FC = () => {
  const mapCatalog = useGameStore((s) => s.mapCatalog);
  const activeMapId = useGameStore((s) => s.activeMapId);
  const setActiveScreen = useGameStore((s) => s.setActiveScreen);
  const refreshMaps = useGameStore((s) => s.refreshMaps);
  const upsertMap = useGameStore((s) => s.upsertMap);
  const deleteMap = useGameStore((s) => s.deleteMap);
  const duplicateMap = useGameStore((s) => s.duplicateMap);
  const setDefaultMap = useGameStore((s) => s.setDefaultMap);
  const switchMap = useGameStore((s) => s.switchMap);
  const showToast = useGameStore((s) => s.showToast);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<GameMap | null>(null);
  const [tool, setTool] = useState<EditorTool>('impassable');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [previewFog, setPreviewFog] = useState(true);
  const [novaLigacaoMapa, setNovaLigacaoMapa] = useState<string>('');

  useEffect(() => {
    refreshMaps();
  }, [refreshMaps]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') setActiveScreen('glossario_locais');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setActiveScreen]);

  const allMaps = useMemo(() => listarMapas(mapCatalog), [mapCatalog]);

  useEffect(() => {
    if (selectedId && mapCatalog.maps[selectedId]) return;
    setSelectedId(
      (activeMapId && mapCatalog.maps[activeMapId] ? activeMapId : null) ??
        allMaps[0]?.id ??
        null
    );
  }, [allMaps, mapCatalog.maps, selectedId, activeMapId]);

  const activeMap = selectedId ? mapCatalog.maps[selectedId] ?? null : null;

  useEffect(() => {
    setDraft(
      activeMap
        ? {
            ...activeMap,
            terrain: { ...activeMap.terrain },
            stairs: activeMap.stairs.map((s) => ({ ...s })),
            fog: { ...activeMap.fog },
            placements: { ...activeMap.placements },
          }
        : null
    );
    setConfirmDeleteId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMap?.id]);

  const commit = (mapa: GameMap, silent = true) => {
    setDraft(mapa);
    upsertMap(mapa);
    if (!silent) showToast(`Mapa "${mapa.nome}" guardado!`);
  };

  const patch = (partial: Partial<GameMap>, silent = true) => {
    if (!draft) return;
    commit({ ...draft, ...partial }, silent);
  };

  const handleCreate = () => {
    const novo = criarMapaEmBranco(`Novo Mapa ${allMaps.length + 1}`);
    upsertMap(novo);
    setSelectedId(novo.id);
    showToast('Novo mapa criado. Define dimensões, terreno e escadas.');
  };

  const handleDuplicate = () => {
    if (!draft) return;
    const novoId = duplicateMap(draft.id);
    if (novoId) {
      setSelectedId(novoId);
      showToast('Mapa duplicado.');
    }
  };

  const handleDelete = () => {
    if (!draft) return;
    if (confirmDeleteId === draft.id) {
      deleteMap(draft.id);
      setSelectedId(null);
      setConfirmDeleteId(null);
      showToast('Mapa apagado.');
      return;
    }
    setConfirmDeleteId(draft.id);
    setTimeout(
      () => setConfirmDeleteId((cur) => (cur === draft.id ? null : cur)),
      3200
    );
  };

  /* ---------------------- Edição do grid ---------------------- */

  const pintarCelula = (x: number, y: number) => {
    if (!draft) return;
    const k = chaveCelula(x, y);

    if (tool === 'normal') {
      const terrain = { ...draft.terrain };
      delete terrain[k];
      patch({ terrain });
      return;
    }

    if (tool === 'difficult' || tool === 'impassable') {
      const terrain = { ...draft.terrain };
      if (terrain[k] === tool) delete terrain[k];
      else terrain[k] = tool as TerrainType;
      patch({ terrain });
      return;
    }

    // Ferramentas de escada
    const direction: StairDirection = tool === 'stair_up' ? 'up' : 'down';
    const existente = draft.stairs.find((s) => s.x === x && s.y === y);
    if (existente) {
      patch({ stairs: draft.stairs.filter((s) => s.id !== existente.id) });
      return;
    }
    if (celulaTemEscada(draft, x, y)) return;

    const nova: MapStair = {
      id: gerarStairId(),
      x,
      y,
      direction,
      label:
        direction === 'up'
          ? `Escada de subida (${x},${y})`
          : `Escada de descida (${x},${y})`,
      targetMapId: null,
      targetStairId: null,
    };
    patch({ stairs: [...draft.stairs, nova] });
  };

  const atualizarEscada = (stairId: string, partial: Partial<MapStair>) => {
    if (!draft) return;
    patch({
      stairs: draft.stairs.map((s) =>
        s.id === stairId ? { ...s, ...partial } : s
      ),
    });
  };

  const removerEscada = (stairId: string) => {
    if (!draft) return;
    patch({ stairs: draft.stairs.filter((s) => s.id !== stairId) });
  };

  /**
   * Garante uma escada de retorno no mapa de destino: o mestre fica sempre com
   * ligação de ida e volta entre níveis (sem precisar de a criar à mão).
   */
  const garantirEscadaDeRetorno = (
    mapaDestino: GameMap,
    stairOrigem: MapStair
  ): { mapa: GameMap; criada: boolean } => {
    if (!draft) return { mapa: mapaDestino, criada: false };
    const jaTemRetorno = mapaDestino.stairs.some(
      (st) => st.targetMapId === draft.id
    );
    if (jaTemRetorno) return { mapa: mapaDestino, criada: false };

    // Célula livre: no centro do mapa de destino, evitando escadas existentes
    let x = Math.min(mapaDestino.largura - 1, Math.floor(mapaDestino.largura / 2));
    let y = Math.min(mapaDestino.altura - 1, Math.floor(mapaDestino.altura / 2));
    const livre = (cx: number, cy: number) =>
      cx >= 0 &&
      cy >= 0 &&
      cx < mapaDestino.largura &&
      cy < mapaDestino.altura &&
      !escadaNaCelula(mapaDestino, cx, cy);
    if (!livre(x, y)) {
      const maxRaio = Math.max(mapaDestino.largura, mapaDestino.altura);
      let achou = false;
      for (let raio = 0; raio <= maxRaio && !achou; raio++) {
        for (let dy = -raio; dy <= raio && !achou; dy++) {
          for (let dx = -raio; dx <= raio && !achou; dx++) {
            if (raio > 0 && Math.abs(dx) !== raio && Math.abs(dy) !== raio) continue;
            if (livre(x + dx, y + dy)) {
              x += dx;
              y += dy;
              achou = true;
            }
          }
        }
      }
    }

    const retorno: MapStair = {
      id: gerarStairId(),
      x,
      y,
      direction: stairOrigem.direction === 'up' ? 'down' : 'up',
      label:
        stairOrigem.direction === 'up'
          ? `Escada de descida para ${draft.nome}`
          : `Escada de subida para ${draft.nome}`,
      targetMapId: draft.id,
      targetStairId: stairOrigem.id,
    };

    return {
      mapa: {
        ...mapaDestino,
        stairs: [...mapaDestino.stairs, retorno],
        atualizadoEm: Date.now(),
      },
      criada: true,
    };
  };

  const criarMapaELigar = (stairId: string) => {
    if (!draft) return;
    const stairOrigem = draft.stairs.find((st) => st.id === stairId);
    if (!stairOrigem) return;

    const novo = criarMapaEmBranco(
      `Nível de ${draft.nome}`,
      Math.max(10, Math.round(draft.largura * 0.8)),
      Math.max(8, Math.round(draft.altura * 0.8))
    );
    const { mapa: destino } = garantirEscadaDeRetorno(novo, stairOrigem);
    upsertMap(destino);

    const retorno = destino.stairs.find((st) => st.targetMapId === draft.id);
    atualizarEscada(stairId, {
      targetMapId: destino.id,
      targetStairId: retorno ? retorno.id : null,
    });
    showToast(`Mapa "${destino.nome}" criado com escada de retorno.`);
  };

  /** Liga uma escada a um mapa já existente (criando o retorno se faltar). */
  const ligarAEscadaExistente = (stairId: string) => {
    if (!draft || !novaLigacaoMapa) return;
    const destino = mapCatalog.maps[novaLigacaoMapa];
    if (!destino) return;
    const stairOrigem = draft.stairs.find((st) => st.id === stairId);
    if (!stairOrigem) return;

    const { mapa: destinoComRetorno, criada } = garantirEscadaDeRetorno(
      destino,
      stairOrigem
    );
    if (criada) upsertMap(destinoComRetorno);

    const retorno = destinoComRetorno.stairs.find(
      (st) => st.targetMapId === draft.id
    );
    atualizarEscada(stairId, {
      targetMapId: destinoComRetorno.id,
      targetStairId: retorno ? retorno.id : null,
    });
    setNovaLigacaoMapa('');
    showToast(
      criada
        ? `Ligado a "${destinoComRetorno.nome}" com escada de retorno criada.`
        : `Ligado a "${destinoComRetorno.nome}".`
    );
  };

  /* ---------------------- Pré-visualização da névoa ---------------------- */

  const fogCells = useMemo(() => {
    if (!draft || !previewFog || draft.fog.mode !== 'exploration') return null;
    const board = boardDoMapa(draft);
    // Referência: primeira escada ou o centro do mapa
    const referencia = {
      x: draft.stairs[0]?.x ?? Math.floor(draft.largura / 2),
      y: draft.stairs[0]?.y ?? Math.floor(draft.altura / 2),
    };
    return calcularVisaoDaUnidade(
      board,
      {
        id: 'preview',
        name: 'preview',
        imageId: '',
        hpMax: 1,
        hpCurrent: 1,
        movement: 1,
        baseDamage: 1,
        weaponIds: [],
        position: { x: referencia.x, y: referencia.y },
        facing: Direction.North,
        width: 1,
        height: 1,
      },
      draft.fog.range
    );
  }, [draft, previewFog]);

  const celulas = useMemo(() => {
    if (!draft) return [] as Array<{ x: number; y: number }>;
    const out: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < draft.altura; y++) {
      for (let x = 0; x < draft.largura; x++) out.push({ x, y });
    }
    return out;
  }, [draft?.largura, draft?.altura]);

  return (
    <div className={styles.screen}>
      <div className={styles.container}>
        <header className={styles.topBar}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Glossário — Mapas do Tabuleiro</h1>
            <p className={styles.subtitle}>
              Editor de mapas, escadas entre níveis e predefinição de visão do
              modo de jogo
            </p>
          </div>

          <div className={styles.topActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setActiveScreen('glossario_locais')}
            >
              <ChevronLeft size={13} /> Locais
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setActiveScreen('glossario')}
            >
              Glossário
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                // Leva o mapa em edição para o modo de jogo
                if (draft && draft.id !== activeMapId) switchMap(draft.id);
                setActiveScreen('tabuleiro');
              }}
              title={
                draft
                  ? `Abrir o Tabuleiro com "${draft.nome}"`
                  : 'Abrir o Tabuleiro'
              }
            >
              <LayoutGrid size={13} /> Tabuleiro
            </button>
          </div>
        </header>

        <div className={styles.workspace}>
          {/* Lista de mapas */}
          <aside className={styles.panel}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Mapas ({allMaps.length})
              </h2>
              <button
                type="button"
                className={styles.btnPrimary}
                style={{ padding: '5px 10px', fontSize: 10.5 }}
                onClick={handleCreate}
              >
                <Plus size={13} />
                <span>Novo</span>
              </button>
            </div>

            {allMaps.length === 0 ? (
              <div className={styles.emptyState}>
                Nenhum mapa criado. Clica em “Novo” para começar.
              </div>
            ) : (
              <div className={styles.mapList}>
                {allMaps.map((m) => {
                  const orfas = m.stairs.filter(
                    (s) => !s.targetMapId || !mapCatalog.maps[s.targetMapId]
                  ).length;
                  const isActive = m.id === activeMapId;
                  const isDefault = m.id === mapCatalog.defaultMapId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`${styles.mapItem} ${
                        m.id === selectedId ? styles.mapItemActive : ''
                      }`}
                      onClick={() => setSelectedId(m.id)}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span
                          className={styles.mapItemName}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          {isActive && (
                            <MapPin
                              size={12}
                              style={{ flexShrink: 0 }}
                              aria-label="Mapa em jogo"
                            />
                          )}
                          {m.nome}
                          {isDefault && (
                            <Star
                              size={11}
                              fill="currentColor"
                              style={{ flexShrink: 0 }}
                              aria-label="Mapa predefinido"
                            />
                          )}
                        </span>
                        <span className={styles.mapItemMeta}>
                          {m.largura}×{m.altura} • {m.stairs.length} escada
                          {m.stairs.length === 1 ? '' : 's'} •{' '}
                          {m.fog.mode === 'exploration'
                            ? `Névoa ${m.fog.range}q`
                            : 'Dia'}
                        </span>
                      </span>
                      <span
                        className={`${styles.stairBadge} ${
                          orfas > 0 ? styles.stairBadgeWarn : ''
                        }`}
                      >
                        {orfas > 0 ? `${orfas} sem ligação` : 'OK'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Editor */}
          <main className={styles.panel}>
            {!draft ? (
              <div className={styles.emptyState}>
                Selecione um mapa para editar.
              </div>
            ) : (
              <div className={styles.editorStack}>
                {/* Identidade + dimensões */}
                <div>
                  <div className={styles.formGrid2}>
                    <div className={styles.field}>
                      <label className={styles.label}>Nome do Mapa</label>
                      <input
                        className={styles.input}
                        value={draft.nome}
                        onChange={(e) =>
                          setDraft({ ...draft, nome: e.target.value })
                        }
                        onBlur={() =>
                          patch({ nome: draft.nome.trim() || 'Mapa' })
                        }
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>
                        Descrição / Ambiente
                      </label>
                      <input
                        className={styles.input}
                        placeholder="Ex: Cripta húmida sob as ruínas"
                        value={draft.descricao}
                        onChange={(e) =>
                          setDraft({ ...draft, descricao: e.target.value })
                        }
                        onBlur={() => patch({ descricao: draft.descricao })}
                      />
                    </div>
                  </div>

                  <div className={styles.formGrid3} style={{ marginTop: 10 }}>
                    <div className={styles.field}>
                      <label className={styles.label}>Largura (quad.)</label>
                      <input
                        type="number"
                        min={4}
                        max={60}
                        className={styles.input}
                        value={draft.largura}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            largura: Number(e.target.value) || draft.largura,
                          })
                        }
                        onBlur={() =>
                          patch(
                            normalizarMapa({
                              ...draft,
                              largura: draft.largura,
                            })
                          )
                        }
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Altura (quad.)</label>
                      <input
                        type="number"
                        min={4}
                        max={60}
                        className={styles.input}
                        value={draft.altura}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            altura: Number(e.target.value) || draft.altura,
                          })
                        }
                        onBlur={() =>
                          patch(
                            normalizarMapa({
                              ...draft,
                              altura: draft.altura,
                            })
                          )
                        }
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Tamanhos rápidos</label>
                      <select
                        className={styles.select}
                        value=""
                        onChange={(e) => {
                          const preset = SIZE_PRESETS[Number(e.target.value)];
                          if (!preset) return;
                          patch(
                            normalizarMapa({
                              ...draft,
                              largura: preset.w,
                              altura: preset.h,
                            })
                          );
                        }}
                      >
                        <option value="">Escolher…</option>
                        {SIZE_PRESETS.map((p, i) => (
                          <option key={p.label} value={i}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Preset de visão */}
                <section>
                  <h3 className={styles.subTitle}>
                    Predefinição de Visão (modo de jogo)
                  </h3>
                  <div className={styles.toolRow}>
                    <button
                      type="button"
                      className={`${styles.toolChip} ${
                        draft.fog.mode === 'day' ? styles.toolChipActive : ''
                      }`}
                      onClick={() =>
                        patch({ fog: { ...draft.fog, mode: 'day' } })
                      }
                    >
                      <Sun size={13} /> Dia (mapa completo)
                    </button>
                    <button
                      type="button"
                      className={`${styles.toolChip} ${
                        draft.fog.mode === 'exploration'
                          ? styles.toolChipActive
                          : ''
                      }`}
                      onClick={() =>
                        patch({ fog: { ...draft.fog, mode: 'exploration' } })
                      }
                    >
                      <Moon size={13} /> Exploração (névoa)
                    </button>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        color: 'var(--color-pergaminho-400)',
                      }}
                    >
                      Alcance
                      <input
                        type="number"
                        min={1}
                        max={40}
                        className={styles.input}
                        style={{ width: 72 }}
                        value={draft.fog.range}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            fog: {
                              ...draft.fog,
                              range: Number(e.target.value) || draft.fog.range,
                            },
                          })
                        }
                        onBlur={() =>
                          patch({
                            fog: {
                              ...draft.fog,
                              range: Math.max(
                                1,
                                Math.min(40, Math.round(draft.fog.range))
                              ),
                            },
                          })
                        }
                      />
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        color: 'var(--color-pergaminho-400)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={draft.fog.locked}
                        onChange={(e) =>
                          patch({
                            fog: { ...draft.fog, locked: e.target.checked },
                          })
                        }
                      />
                      Trancar no Tabuleiro (jogo)
                    </label>

                    <button
                      type="button"
                      className={`${styles.toolChip} ${
                        previewFog ? styles.toolChipActive : ''
                      }`}
                      onClick={() => setPreviewFog(!previewFog)}
                      title="Pré-visualizar a névoa no editor (modo de edição)"
                    >
                      {previewFog ? <Eye size={12} /> : <EyeOff size={12} />}
                      Pré-visualizar névoa
                    </button>
                  </div>
                  <p className={styles.hint} style={{ marginTop: 6 }}>
                    No Tabuleiro esta predefinição é aplicada automaticamente ao
                    entrar no mapa. Com “Trancar” ativo, os controlos de visão
                    ficam bloqueados em jogo — aqui no editor podes sempre
                    alterá-los.
                  </p>
                </section>

                {/* Ferramentas + grid */}
                <section>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.subTitle} style={{ margin: 0 }}>
                      Terreno &amp; Escadas
                    </h3>
                    <div className={styles.toolRow}>
                      <button
                        type="button"
                        className={`${styles.toolChip} ${
                          tool === 'impassable' ? styles.toolChipActive : ''
                        }`}
                        onClick={() => setTool('impassable')}
                      >
                        <Mountain size={12} /> Obstáculo
                      </button>
                      <button
                        type="button"
                        className={`${styles.toolChip} ${
                          tool === 'difficult' ? styles.toolChipActive : ''
                        }`}
                        onClick={() => setTool('difficult')}
                      >
                        <Trees size={12} /> Difícil
                      </button>
                      <button
                        type="button"
                        className={`${styles.toolChip} ${
                          tool === 'normal' ? styles.toolChipActive : ''
                        }`}
                        onClick={() => setTool('normal')}
                      >
                        <Eraser size={12} /> Limpar
                      </button>
                      <button
                        type="button"
                        className={`${styles.toolChip} ${
                          tool === 'stair_down' ? styles.toolChipActive : ''
                        }`}
                        onClick={() => setTool('stair_down')}
                        title="Colocar escada de descida"
                      >
                        <ArrowDown size={12} /> Escada (descer)
                      </button>
                      <button
                        type="button"
                        className={`${styles.toolChip} ${
                          tool === 'stair_up' ? styles.toolChipActive : ''
                        }`}
                        onClick={() => setTool('stair_up')}
                        title="Colocar escada de subida"
                      >
                        <ArrowUp size={12} /> Escada (subir)
                      </button>
                    </div>
                  </div>

                  <div className={styles.fogPreviewBar}>
                    <span>
                      Clique para pintar. Ferramenta:{' '}
                      <strong>
                        {tool === 'stair_up'
                          ? 'Escada de subida'
                          : tool === 'stair_down'
                          ? 'Escada de descida'
                          : tool === 'impassable'
                          ? 'Obstáculo'
                          : tool === 'difficult'
                          ? 'Terreno difícil'
                          : 'Limpar'}
                      </strong>
                    </span>
                    <span style={{ opacity: 0.7 }}>
                      {draft.largura}×{draft.altura} • {draft.stairs.length}{' '}
                      escadas
                      {draft.fog.mode === 'exploration' && previewFog
                        ? ` • névoa ${draft.fog.range}q (a partir da 1.ª escada)`
                        : ''}
                    </span>
                  </div>

                  <div className={styles.gridScroll}>
                    <div
                      className={styles.grid}
                      style={{
                        gridTemplateColumns: `repeat(${draft.largura}, 26px)`,
                        gridTemplateRows: `repeat(${draft.altura}, 26px)`,
                      }}
                    >
                      {celulas.map(({ x, y }) => {
                        const k = chaveCelula(x, y);
                        const tipo = draft.terrain[k];
                        const escada = draft.stairs.find(
                          (s) => s.x === x && s.y === y
                        );
                        const visivel = fogCells
                          ? fogCells.visible.has(k)
                          : true;
                        const orla = fogCells ? fogCells.edge.has(k) : false;

                        const classes = [styles.cell];
                        if (tipo === 'impassable')
                          classes.push(styles.cellImpassable);
                        if (tipo === 'difficult')
                          classes.push(styles.cellDifficult);
                        if (escada) classes.push(styles.cellStair);
                        if (fogCells && !visivel)
                          classes.push(
                            orla ? styles.cellFogEdge : styles.cellFog
                          );

                        return (
                          <div
                            key={k}
                            className={classes.join(' ')}
                            style={{
                              background:
                                (x + y) % 2 === 0 ? '#151b26' : '#181f2c',
                            }}
                            onMouseDown={() => pintarCelula(x, y)}
                            title={`(${x}, ${y})${
                              escada ? ` — ${escada.label}` : ''
                            }`}
                          >
                            {escada && (
                              <span
                                className={
                                  escada.direction === 'up'
                                    ? styles.stairUp
                                    : styles.stairDown
                                }
                              >
                                {escada.direction === 'up' ? (
                                  <ArrowUp size={12} />
                                ) : (
                                  <ArrowDown size={12} />
                                )}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* Lista de escadas */}
                <section>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.subTitle} style={{ margin: 0 }}>
                      Escadas &amp; Ligações ({draft.stairs.length})
                    </h3>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <select
                        className={styles.select}
                        style={{ width: 200 }}
                        value={novaLigacaoMapa}
                        onChange={(e) => setNovaLigacaoMapa(e.target.value)}
                      >
                        <option value="">Ligar a mapa existente…</option>
                        {allMaps
                          .filter((m) => m.id !== draft.id)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nome}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        disabled={!novaLigacaoMapa}
                        onClick={() => {
                          if (!novaLigacaoMapa) return;
                          let x = Math.min(
                            draft.largura - 1,
                            Math.floor(draft.largura / 2)
                          );
                          let y = Math.min(
                            draft.altura - 1,
                            Math.floor(draft.altura / 2)
                          );
                          // Procura uma célula livre para a nova escada
                          const livreAqui = (cx: number, cy: number) =>
                            !escadaNaCelula(draft, cx, cy);
                          if (!livreAqui(x, y)) {
                            let achou = false;
                            for (
                              let raio = 0;
                              raio <= Math.max(draft.largura, draft.altura) && !achou;
                              raio++
                            ) {
                              for (let dy = -raio; dy <= raio && !achou; dy++) {
                                for (let dx = -raio; dx <= raio && !achou; dx++) {
                                  if (
                                    raio > 0 &&
                                    Math.abs(dx) !== raio &&
                                    Math.abs(dy) !== raio
                                  )
                                    continue;
                                  const cx = x + dx;
                                  const cy = y + dy;
                                  if (
                                    cx >= 0 &&
                                    cy >= 0 &&
                                    cx < draft.largura &&
                                    cy < draft.altura &&
                                    livreAqui(cx, cy)
                                  ) {
                                    x = cx;
                                    y = cy;
                                    achou = true;
                                  }
                                }
                              }
                            }
                          }

                          const nova: MapStair = {
                            id: gerarStairId(),
                            x,
                            y,
                            direction: 'down',
                            label: 'Nova escada',
                            targetMapId: novaLigacaoMapa,
                            targetStairId: null,
                          };
                          patch({ stairs: [...draft.stairs, nova] });
                          // liga (e cria o retorno) logo de seguida
                          const destino = mapCatalog.maps[novaLigacaoMapa];
                          if (destino) {
                            const { mapa: comRetorno, criada } =
                              garantirEscadaDeRetorno(destino, nova);
                            if (criada) upsertMap(comRetorno);
                            const retorno = comRetorno.stairs.find(
                              (ds) => ds.targetMapId === draft.id
                            );
                            atualizarEscada(nova.id, {
                              targetStairId: retorno ? retorno.id : null,
                            });
                          }
                          setNovaLigacaoMapa('');
                          showToast('Escada criada e ligada ao mapa escolhido.');
                        }}
                      >
                        <Plus size={13} />
                        <span>Adicionar Escada</span>
                      </button>
                    </div>
                  </div>

                  {draft.stairs.length === 0 ? (
                    <div className={styles.emptyState}>
                      Sem escadas. Usa a ferramenta “Escada” no grid ou liga
                      diretamente a um mapa existente.
                    </div>
                  ) : (
                    <div className={styles.stairList}>
                      {draft.stairs.map((st) => {
                        const destino = st.targetMapId
                          ? mapCatalog.maps[st.targetMapId] ?? null
                          : null;
                        const orfa = Boolean(st.targetMapId) && !destino;
                        return (
                          <div
                            key={st.id}
                            className={`${styles.stairCard} ${
                              orfa ? styles.stairCardOrphan : ''
                            }`}
                          >
                            <input
                              className={styles.input}
                              value={st.label}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  stairs: draft.stairs.map((s) =>
                                    s.id === st.id
                                      ? { ...s, label: e.target.value }
                                      : s
                                  ),
                                })
                              }
                              onBlur={() =>
                                atualizarEscada(st.id, { label: st.label })
                              }
                              title="Etiqueta da escada"
                            />

                            <select
                              className={styles.select}
                              value={st.direction}
                              onChange={(e) =>
                                atualizarEscada(st.id, {
                                  direction: e.target.value as StairDirection,
                                })
                              }
                            >
                              <option value="down">Descer</option>
                              <option value="up">Subir</option>
                            </select>

                            <select
                              className={styles.select}
                              value={st.targetMapId ?? ''}
                              onChange={(e) => {
                                const valor = e.target.value;
                                if (!valor) {
                                  atualizarEscada(st.id, {
                                    targetMapId: null,
                                    targetStairId: null,
                                  });
                                  return;
                                }
                                const destinoEscolhido =
                                  mapCatalog.maps[valor] ?? null;
                                if (!destinoEscolhido) return;
                                const { mapa: comRetorno, criada } =
                                  garantirEscadaDeRetorno(
                                    destinoEscolhido,
                                    st
                                  );
                                if (criada) {
                                  upsertMap(comRetorno);
                                  showToast(
                                    `Escada de retorno criada em "${comRetorno.nome}".`
                                  );
                                }
                                const retorno = comRetorno.stairs.find(
                                  (ds) => ds.targetMapId === draft.id
                                );
                                atualizarEscada(st.id, {
                                  targetMapId: valor,
                                  targetStairId: retorno ? retorno.id : null,
                                });
                              }}
                              title="Mapa de destino"
                            >
                              <option value="">— Sem ligação —</option>
                              {allMaps
                                .filter((m) => m.id !== draft.id)
                                .map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.nome}
                                  </option>
                                ))}
                            </select>

                            <select
                              className={`${styles.select} ${styles.stairTargetStair}`}
                              value={st.targetStairId ?? ''}
                              onChange={(e) =>
                                atualizarEscada(st.id, {
                                  targetStairId: e.target.value || null,
                                })
                              }
                              title="Escada de chegada no mapa de destino"
                              disabled={!destino}
                            >
                              <option value="">Chegada automática</option>
                              {(destino?.stairs ?? []).map((ds) => (
                                <option key={ds.id} value={ds.id}>
                                  {rotuloDirecao(ds.direction)} — {ds.label} (
                                  {ds.x},{ds.y})
                                </option>
                              ))}
                            </select>

                            <div className={styles.toolRow}>
                              <button
                                type="button"
                                className={styles.rowRemove}
                                onClick={() => removerEscada(st.id)}
                                aria-label="Remover escada"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>

                            <span
                              className={styles.hint}
                              style={{ gridColumn: '1 / -1' }}
                            >
                              Célula ({st.x}, {st.y}) •{' '}
                              {destino
                                ? `Ligada a "${destino.nome}"`
                                : st.targetMapId
                                ? 'Destino inexistente — corrige a ligação'
                                : 'Sem ligação'}
                              {' · '}
                              <button
                                type="button"
                                className={styles.toolChip}
                                style={{ padding: '1px 7px', fontSize: 11 }}
                                onClick={() => criarMapaELigar(st.id)}
                              >
                                Criar mapa de destino
                              </button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Ações */}
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    paddingTop: 8,
                    borderTop: '1px solid rgba(196, 137, 26, 0.22)',
                  }}
                >
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => commit(draft, false)}
                  >
                    <Save size={13} />
                    <span>Guardar Mapa</span>
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={handleDuplicate}
                  >
                    <Copy size={13} />
                    <span>Duplicar</span>
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => {
                      setDefaultMap(draft.id);
                      showToast('Mapa definido como predefinição da partida.');
                    }}
                  >
                    <Star size={13} /> Usar como predefinição
                  </button>
                  <button
                    type="button"
                    className={`${styles.btnDanger} ${
                      confirmDeleteId === draft.id
                        ? styles.btnDangerConfirm
                        : ''
                    }`}
                    onClick={handleDelete}
                  >
                    <Trash2 size={13} />
                    <span>
                      {confirmDeleteId === draft.id ? 'Confirmar?' : 'Apagar'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
