import React, { useEffect, useMemo, useState } from 'react';
import { ScrollText, Sparkles, Swords, X } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import {
  converterFichaParaTabuleiro,
  LINHAGEM_LABELS,
  sugerirEmblemaPorFicha,
} from '../../epitome/epitomeEngine';
import { calculateAttackDamage } from '../../engine/combat';
import { TokenAvatar } from '../common/TokenAvatar';
import styles from './ModalShared.module.css';

export const SpawnFichaModal: React.FC = () => {
  const modal = useGameStore((s) => s.spawnFichaModal);
  const fichasList = useGameStore((s) => s.fichasList);
  const arsenalCatalog = useGameStore((s) => s.arsenalCatalog);
  const appState = useGameStore((s) => s.appState);

  const closeSpawnFichaModal = useGameStore((s) => s.closeSpawnFichaModal);
  const spawnOrSyncFichaOnBoard = useGameStore(
    (s) => s.spawnOrSyncFichaOnBoard
  );
  const openFichaEditor = useGameStore((s) => s.openFichaEditor);
  const refreshFichas = useGameStore((s) => s.refreshFichas);

  const [selectedId, setSelectedId] = useState<string>('');
  const [gridSize, setGridSize] = useState<number>(1);
  const [metrosPorQuad, setMetrosPorQuad] = useState<number>(5);
  const [placeImmediately, setPlaceImmediately] = useState<boolean>(true);
  const [updateExisting, setUpdateExisting] = useState<boolean>(true);

  useEffect(() => {
    if (!modal.open) return;
    refreshFichas();
  }, [modal.open, refreshFichas]);

  useEffect(() => {
    if (!modal.open) return;
    if (modal.preselectFichaId) {
      setSelectedId(modal.preselectFichaId);
    } else if (fichasList.length > 0 && !selectedId) {
      setSelectedId(fichasList[0].id);
    }
  }, [modal.open, modal.preselectFichaId, fichasList]);

  const activeFicha = useMemo(
    () => fichasList.find((f) => f.id === selectedId) ?? fichasList[0] ?? null,
    [fichasList, selectedId]
  );

  const previewBundle = useMemo(() => {
    if (!activeFicha) return null;
    return converterFichaParaTabuleiro(activeFicha, {
      width: gridSize,
      height: gridSize,
      metrosPorQuadrado: metrosPorQuad,
      arsenalCatalog,
    });
  }, [activeFicha, gridSize, metrosPorQuad, arsenalCatalog]);

  if (!modal.open) return null;

  const alreadyOnBoard = activeFicha
    ? Object.values(appState.characters).some(
        (c) => c.fichaId === activeFicha.id
      )
    : false;

  const handleConfirm = async () => {
    if (!activeFicha) return;
    await spawnOrSyncFichaOnBoard(activeFicha.id, {
      width: gridSize,
      height: gridSize,
      metrosPorQuadrado: metrosPorQuad,
      placeOnBoard: placeImmediately,
      updateExisting,
    });
    closeSpawnFichaModal();
  };

  return (
    <div className={styles.backdrop} onClick={closeSpawnFichaModal}>
      <div
        className={`${styles.modal} ${styles.modalWide}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.title}>
            <ScrollText size={17} />
            <span>Trazer Ficha do Grimório (Spiritual Epitome) ao Tabuleiro</span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={closeSpawnFichaModal}
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {fichasList.length === 0 ? (
            <div className={styles.card} style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', margin: '8px 0' }}>
                Nenhuma ficha criada ainda no Grimório do Mestre.
              </p>
              <div>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => {
                    closeSpawnFichaModal();
                    openFichaEditor(null);
                  }}
                >
                  Criar Primeira Ficha
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.row2}>
              {/* Coluna Esquerda: Seleção de Ficha */}
              <div className={styles.card}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span className={styles.label}>
                    Fichas Salvas ({fichasList.length})
                  </span>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    style={{ padding: '4px 9px', fontSize: 11 }}
                    onClick={() => {
                      closeSpawnFichaModal();
                      openFichaEditor(null);
                    }}
                  >
                    + Nova Ficha
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    maxHeight: 330,
                    overflowY: 'auto',
                  }}
                >
                  {fichasList.map((f) => {
                    const isSel = activeFicha?.id === f.id;
                    const linked = Object.values(appState.characters).some(
                      (c) => c.fichaId === f.id
                    );
                    return (
                      <div
                        key={f.id}
                        onClick={() => setSelectedId(f.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: 5,
                          cursor: 'pointer',
                          background: isSel
                            ? 'rgba(196, 137, 26, 0.18)'
                            : 'var(--bg-input)',
                          border: isSel
                            ? '1px solid var(--gold-primary)'
                            : '1px solid var(--border-subtle)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            minWidth: 0,
                          }}
                        >
                          <TokenAvatar
                            imageId={sugerirEmblemaPorFicha(f)}
                            alt={f.nome || 'Ficha'}
                            size={34}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {f.nome || 'Sem nome'}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--text-secondary)',
                              }}
                            >
                              Nv {f.nivel} •{' '}
                              {LINHAGEM_LABELS[f.linhagem].replace(
                                'Linhagem ',
                                ''
                              )}
                              {linked ? ' • (Já no Tabuleiro)' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Coluna Direita: Prévia de Conversão Tática */}
              {activeFicha && previewBundle && (
                <div className={styles.card}>
                  <div className={styles.label}>
                    Adaptação Tática — {previewBundle.character.name}
                  </div>

                  <div className={styles.row3}>
                    <div
                      style={{
                        padding: 6,
                        borderRadius: 4,
                        background: 'var(--bg-input)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
                        Vida (HP)
                      </div>
                      <strong style={{ color: '#f87171', fontSize: 14 }}>
                        {previewBundle.character.hpCurrent}/
                        {previewBundle.character.hpMax}
                      </strong>
                    </div>
                    <div
                      style={{
                        padding: 6,
                        borderRadius: 4,
                        background: 'var(--bg-input)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
                        Deslocamento
                      </div>
                      <strong style={{ color: '#93c5fd', fontSize: 14 }}>
                        {previewBundle.character.movement} quad.
                      </strong>
                    </div>
                    <div
                      style={{
                        padding: 6,
                        borderRadius: 4,
                        background: 'var(--bg-input)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
                        Agil. Combate
                      </div>
                      <strong style={{ color: 'var(--gold-bright)', fontSize: 14 }}>
                        {previewBundle.summary.agilidadeCombate}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      fontSize: 11.5,
                      color: 'var(--text-secondary)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      Mana: <strong>{previewBundle.summary.manaAtual}</strong>/
                      {previewBundle.summary.manaTotal}
                    </span>
                    <span>•</span>
                    <span>
                      Estamina:{' '}
                      <strong>{previewBundle.summary.estaminaAtual}</strong>/
                      {previewBundle.summary.estaminaTotal} (máx{' '}
                      {previewBundle.summary.estaminaMaxGasto}/ação)
                    </span>
                    <span>•</span>
                    <span>
                      Raciocínio:{' '}
                      <strong>{previewBundle.summary.racAtual}</strong>/
                      {previewBundle.summary.racTotal}
                    </span>
                  </div>

                  <div className={styles.label} style={{ marginTop: 4 }}>
                    <Swords size={12} style={{ marginRight: 4 }} />
                    Armas &amp; Magias Geradas ({previewBundle.attacks.length}{' '}
                    ataques):
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      maxHeight: 130,
                      overflowY: 'auto',
                    }}
                  >
                    {previewBundle.attacks.map((atk) => {
                      const parentWp =
                        previewBundle.weapons.find((w) =>
                          w.attackIds.includes(atk.id)
                        ) || null;
                      const effDmg = calculateAttackDamage(
                        atk,
                        parentWp,
                        previewBundle.character,
                        appState.settings.damageRule
                      );
                      return (
                        <div
                          key={atk.id}
                          style={{
                            padding: '5px 8px',
                            borderRadius: 4,
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: 11.5,
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <span>
                            <strong>{atk.name}</strong> ({atk.area.cells.length}{' '}
                            quad., alc. {atk.range})
                          </span>
                          <span
                            style={{
                              color: 'var(--gold-bright)',
                              fontWeight: 700,
                            }}
                          >
                            {effDmg} DMG
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className={styles.row2} style={{ marginTop: 4 }}>
                    <div className={styles.field}>
                      <label className={styles.label}>Tamanho no Grid</label>
                      <select
                        className={styles.select}
                        value={gridSize}
                        onChange={(e) => setGridSize(Number(e.target.value))}
                      >
                        <option value={1}>Comum (1×1)</option>
                        <option value={2}>Grande (2×2)</option>
                        <option value={3}>Enorme (3×3)</option>
                        <option value={4}>Colossal (4×4)</option>
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>
                        Escala de Alcance Mágico
                      </label>
                      <select
                        className={styles.select}
                        value={metrosPorQuad}
                        onChange={(e) =>
                          setMetrosPorQuad(Number(e.target.value))
                        }
                      >
                        <option value={3}>1 quad = 3 unid. (Amplo)</option>
                        <option value={5}>1 quad = 5 unid. (Padrão)</option>
                        <option value={8}>1 quad = 8 unid. (Compacto)</option>
                      </select>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                      fontSize: 12,
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={placeImmediately}
                        onChange={(e) => setPlaceImmediately(e.target.checked)}
                      />
                      <span>Posicionar automaticamente no grid</span>
                    </label>
                    {alreadyOnBoard && (
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={updateExisting}
                          onChange={(e) => setUpdateExisting(e.target.checked)}
                        />
                        <span>
                          Atualizar unidade já presente (desmarque para criar
                          cópia extra)
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={closeSpawnFichaModal}
          >
            Cancelar
          </button>
          {activeFicha && (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleConfirm}
            >
              <Sparkles size={14} />
              <span>
                {alreadyOnBoard && updateExisting
                  ? 'Sincronizar Ficha no Tabuleiro'
                  : 'Invocar no Tabuleiro'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
