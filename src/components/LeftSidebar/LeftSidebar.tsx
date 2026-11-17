import React, { useState } from 'react';
import {
  ArrowDownWideNarrow,
  BookCopy,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  GripVertical,
  History,
  ListOrdered,
  Layers,
  MapPin,
  MapPinOff,
  Plus,
  Redo2,
  RotateCcw,
  ScrollText,
  SkipForward,
  Trash2,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { DIRECTION_SHORT } from '../../engine/geometry';
import { TokenAvatar } from '../common/TokenAvatar';
import styles from './LeftSidebar.module.css';

/** Rótulos legíveis para o Log (o `act.type` cru não aparece ao utilizador). */
const ACTION_LABELS: Record<string, string> = {
  MOVE: 'Movimento',
  PLACE_CHARACTER: 'Posicionamento',
  REMOVE_CHARACTER: 'Remoção',
  DAMAGE: 'Dano',
  HEAL: 'Cura',
  SET_HP: 'Vida',
  ATTACK_RESOLVE: 'Ataque',
  TERRAIN_BATCH: 'Terreno',
  TURN_CHANGE: 'Turno',
};

/**
 * Ações que não aparecem no Log. A rotação do personagem segue o cursor e
 * mudaria dezenas de vezes só a mover o mouse — não é uma jogada.
 */
const LOG_HIDDEN_TYPES = new Set(['ROTATE']);

export const LeftSidebar: React.FC = () => {
  const appState = useGameStore((s) => s.appState);
  const selectedCharacterId = useGameStore((s) => s.selectedCharacterId);
  const leftPanelOpen = useGameStore((s) => s.leftPanelOpen);
  const leftTab = useGameStore((s) => s.leftTab);

  const toggleLeftPanel = useGameStore((s) => s.toggleLeftPanel);
  const setLeftTab = useGameStore((s) => s.setLeftTab);
  const setSelectedCharacter = useGameStore((s) => s.setSelectedCharacter);
  const openCharacterModal = useGameStore((s) => s.openCharacterModal);
  const openMatchesModal = useGameStore((s) => s.openMatchesModal);
  const openSpawnFichaModal = useGameStore((s) => s.openSpawnFichaModal);
  const setQuickSheetFichaId = useGameStore((s) => s.setQuickSheetFichaId);
  const sortInitiativeByAgility = useGameStore((s) => s.sortInitiativeByAgility);
  const duplicateCharacter = useGameStore((s) => s.duplicateCharacter);
  const deleteCharacter = useGameStore((s) => s.deleteCharacter);
  const autoPlaceCharacter = useGameStore((s) => s.autoPlaceCharacter);
  const activeMapId = useGameStore((s) => s.activeMapId);
  const mapCatalog = useGameStore((s) => s.mapCatalog);
  const switchMap = useGameStore((s) => s.switchMap);
  const moveCharacterToFloor = useGameStore((s) => s.moveCharacterToFloor);
  const removeCharacterFromBoard = useGameStore((s) => s.removeCharacterFromBoard);

  const setCombatMode = useGameStore((s) => s.setCombatMode);
  const setTurnOrder = useGameStore((s) => s.setTurnOrder);
  const addCharacterToInitiative = useGameStore((s) => s.addCharacterToInitiative);
  const removeCharacterFromInitiative = useGameStore(
    (s) => s.removeCharacterFromInitiative
  );
  const setActiveTurnCharacter = useGameStore((s) => s.setActiveTurnCharacter);
  const nextTurn = useGameStore((s) => s.nextTurn);
  const newRound = useGameStore((s) => s.newRound);
  const undo = useGameStore((s) => s.undo);
  const redo = useGameStore((s) => s.redo);

  const [dragInitIdx, setDragInitIdx] = useState<number | null>(null);

  const allChars = Object.values(appState.characters);

  // Cada unidade pertence a um andar; só as deste andar aparecem no tabuleiro
  const andarDe = (c: (typeof allChars)[number]) => c.mapId ?? activeMapId;
  const desteAndar = allChars.filter((c) => andarDe(c) === activeMapId);
  const outrosAndares = allChars.filter(
    (c) => activeMapId !== null && andarDe(c) !== activeMapId
  );

  const positionedChars = desteAndar.filter((c) => c.position !== null);
  const reserveChars = desteAndar.filter((c) => c.position === null);

  const notInInitiative = allChars.filter(
    (c) => !appState.combat.turnOrder.includes(c.id)
  );

  const nomeDoAndar = (mapId: string | null | undefined) =>
    mapId ? mapCatalog.maps[mapId]?.nome ?? 'Andar removido' : 'Sem mapa';

  // Log sem as mudanças de direção (seguem o cursor) — só jogadas reais.
  const logEntries = appState.history.past.filter(
    (act) => !LOG_HIDDEN_TYPES.has(act.type)
  );
  const attackCount = logEntries.filter(
    (act) => act.type === 'ATTACK_RESOLVE'
  ).length;

  const handleInitDrop = (targetIdx: number) => {
    if (dragInitIdx === null || dragInitIdx === targetIdx) return;
    const copy = [...appState.combat.turnOrder];
    const [moved] = copy.splice(dragInitIdx, 1);
    copy.splice(targetIdx, 0, moved);
    setTurnOrder(copy);
    setDragInitIdx(null);
  };

  return (
    <aside className={styles.wrapper}>
      <div
        className={`${styles.panel} ${
          !leftPanelOpen ? styles.panelCollapsed : ''
        }`}
      >
        {/* Abas superiores */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tabBtn} ${
              leftTab === 'characters' ? styles.tabBtnActive : ''
            }`}
            onClick={() => setLeftTab('characters')}
          >
            <Users size={13} />
            <span>Unidades</span>
          </button>
          <button
            className={`${styles.tabBtn} ${
              leftTab === 'initiative' ? styles.tabBtnActive : ''
            }`}
            onClick={() => setLeftTab('initiative')}
          >
            <ListOrdered size={13} />
            <span>Iniciativa</span>
          </button>
          <button
            className={`${styles.tabBtn} ${
              leftTab === 'history' ? styles.tabBtnActive : ''
            }`}
            onClick={() => setLeftTab('history')}
          >
            <History size={13} />
            <span>Log</span>
          </button>
        </div>

        {/* ABA 1: LISTA DE PERSONAGENS */}
        {leftTab === 'characters' && (
          <>
            <div className={styles.headerActions}>
              <button
                className={styles.primaryCreateBtn}
                onClick={() => openSpawnFichaModal(null)}
                title="Trazer personagem criado no sistema de Fichas (Spiritual Epitome)"
              >
                <ScrollText size={14} />
                <span>Das Fichas</span>
              </button>
              <button
                className={styles.secondaryBtn}
                onClick={() => openCharacterModal(null)}
                title="Criar NPC / Criatura livre para o Tabuleiro"
              >
                <Plus size={14} />
                <span>NPC</span>
              </button>
              <button
                className={styles.secondaryBtn}
                onClick={() => openMatchesModal('templates')}
                title="Carregar personagem salvo nos Modelos"
              >
                <BookCopy size={14} />
              </button>
            </div>

            <div className={styles.scrollArea}>
              <div>
                <div className={styles.groupLabel}>
                  No Tabuleiro ({positionedChars.length})
                </div>
                {positionedChars.length === 0 ? (
                  <div className={styles.emptyHint}>
                    Nenhum personagem posicionado. Arraste uma unidade da reserva ou crie um novo personagem.
                  </div>
                ) : (
                  <div className={styles.charList}>
                    {positionedChars.map((ch) => {
                      const isSelected = selectedCharacterId === ch.id;
                      const isTurn =
                        appState.combat.mode === 'turns' &&
                        appState.combat.activeCharacterId === ch.id;
                      return (
                        <div
                          key={ch.id}
                          draggable
                          onDragStart={(e) => {
                            (window as any).__draggingCharacterId = ch.id;
                            e.dataTransfer.setData(
                              'application/x-rpg-character',
                              ch.id
                            );
                          }}
                          onDragEnd={() => {
                            (window as any).__draggingCharacterId = null;
                          }}
                          className={`${styles.charCard} ${
                            isSelected ? styles.charCardSelected : ''
                          } ${isTurn ? styles.charCardActiveTurn : ''}`}
                          onClick={() => setSelectedCharacter(ch.id)}
                        >
                          <div className={styles.charInfo}>
                            <TokenAvatar
                              imageId={ch.imageId}
                              alt={ch.name}
                              size={36}
                              borderColor={isSelected ? '#ecc050' : undefined}
                            />
                            <div className={styles.charMeta}>
                              <div className={styles.charName}>
                                {ch.name}
                                {ch.epitomeSummary && (
                                  <span
                                    style={{
                                      marginLeft: 5,
                                      fontSize: 10,
                                      color: 'var(--gold-bright)',
                                      fontWeight: 700,
                                    }}
                                  >
                                    Nv.{ch.epitomeSummary.nivel}
                                  </span>
                                )}
                              </div>
                              <div className={styles.charSub}>
                                <span>
                                  ({ch.position!.x},{ch.position!.y}) •{' '}
                                  {DIRECTION_SHORT[ch.facing]}
                                </span>
                                {(ch.width > 1 || ch.height > 1) && (
                                  <span>
                                    • {ch.width}×{ch.height}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div
                            className={styles.cardActions}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {ch.fichaId && (
                              <button
                                className={styles.iconBtn}
                                title="Abrir Ficha Spiritual Epitome"
                                onClick={() => setQuickSheetFichaId(ch.fichaId!)}
                              >
                                <ScrollText size={13} color="#ecc050" />
                              </button>
                            )}
                            <button
                              className={styles.iconBtn}
                              title="Editar atributos"
                              onClick={() => openCharacterModal(ch.id)}
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              className={styles.iconBtn}
                              title="Duplicar personagem"
                              onClick={() => duplicateCharacter(ch.id)}
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              className={styles.iconBtn}
                              title="Remover do tabuleiro (mover para reserva)"
                              onClick={() => removeCharacterFromBoard(ch.id)}
                            >
                              <MapPinOff size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <div className={styles.groupLabel}>
                  Reserva / Fora do Grid ({reserveChars.length})
                </div>
                {reserveChars.length === 0 ? (
                  <div className={styles.emptyHint}>
                    Arraste unidades daqui para qualquer quadrado do tabuleiro.
                  </div>
                ) : (
                  <div className={styles.charList}>
                    {reserveChars.map((ch) => {
                      const isSelected = selectedCharacterId === ch.id;
                      return (
                        <div
                          key={ch.id}
                          draggable
                          onDragStart={(e) => {
                            (window as any).__draggingCharacterId = ch.id;
                            e.dataTransfer.setData(
                              'application/x-rpg-character',
                              ch.id
                            );
                          }}
                          onDragEnd={() => {
                            (window as any).__draggingCharacterId = null;
                          }}
                          className={`${styles.charCard} ${
                            isSelected ? styles.charCardSelected : ''
                          }`}
                          onClick={() => setSelectedCharacter(ch.id)}
                        >
                          <div className={styles.charInfo}>
                            <TokenAvatar
                              imageId={ch.imageId}
                              alt={ch.name}
                              size={34}
                            />
                            <div className={styles.charMeta}>
                              <div className={styles.charName}>{ch.name}</div>
                              <div className={styles.charSub}>
                                <span>
                                  {ch.width}×{ch.height} • Mov {ch.movement}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div
                            className={styles.cardActions}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className={styles.iconBtn}
                              title="Posicionar no primeiro quadrado livre"
                              onClick={() => autoPlaceCharacter(ch.id)}
                            >
                              <MapPin size={13} />
                            </button>
                            <button
                              className={styles.iconBtn}
                              title="Editar"
                              onClick={() => openCharacterModal(ch.id)}
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                              title="Excluir permanentemente"
                              onClick={() => deleteCharacter(ch.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Noutros andares: unidades que ficaram noutro mapa */}
              {outrosAndares.length > 0 && (
                <div>
                  <div className={styles.groupLabel}>
                    Noutros Andares ({outrosAndares.length})
                  </div>
                  <div className={styles.charList}>
                    {outrosAndares.map((ch) => (
                      <div key={ch.id} className={styles.charCard}>
                        <div className={styles.charInfo}>
                          <TokenAvatar
                            imageId={ch.imageId}
                            alt={ch.name}
                            size={30}
                            borderColor="rgba(148,163,184,0.45)"
                          />
                          <div className={styles.charMeta}>
                            <div className={styles.charName}>{ch.name}</div>
                            <div className={styles.charSub}>
                              <span>
                                {nomeDoAndar(andarDe(ch))}
                                {(() => {
                                  // Posição guardada no mapa desse andar
                                  const andar = andarDe(ch);
                                  const guardada = andar
                                    ? mapCatalog.maps[andar]?.placements?.[ch.id]
                                    : null;
                                  const pos = ch.position ?? guardada ?? null;
                                  return pos
                                    ? ` • (${pos.x},${pos.y})`
                                    : ' • reserva';
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div
                          className={styles.cardActions}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {andarDe(ch) && (
                            <button
                              className={styles.iconBtn}
                              title="Ver o andar onde a unidade está"
                              onClick={() => switchMap(andarDe(ch) as string)}
                            >
                              <Layers size={13} />
                            </button>
                          )}
                          <button
                            className={styles.iconBtn}
                            title="Trazer para o andar ativo (fica na reserva)"
                            onClick={() =>
                              moveCharacterToFloor(ch.id, activeMapId)
                            }
                          >
                            <MapPin size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ABA 2: ORDEM DE INICIATIVA E TURNOS (Parte 14.1 e 14.2) */}
        {leftTab === 'initiative' && (
          <>
            <div className={styles.headerActions}>
              <button
                className={styles.primaryCreateBtn}
                onClick={() =>
                  setCombatMode(
                    appState.combat.mode === 'turns' ? 'free' : 'turns'
                  )
                }
              >
                <span>
                  {appState.combat.mode === 'turns'
                    ? 'Iniciativa Ativa (Desativar)'
                    : 'Ativar Modo de Turnos'}
                </span>
              </button>
            </div>

            <div className={styles.scrollArea}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  className={styles.secondaryBtn}
                  style={{ flex: 1 }}
                  onClick={nextTurn}
                  disabled={appState.combat.turnOrder.length === 0}
                >
                  <SkipForward size={13} />
                  <span>Próximo Turno</span>
                </button>
                <button
                  className={styles.secondaryBtn}
                  onClick={newRound}
                  disabled={appState.combat.turnOrder.length === 0}
                  title="Nova Rodada"
                >
                  <RotateCcw size={13} />
                  <span>Rodada {appState.combat.round}</span>
                </button>
              </div>
              <button
                className={styles.secondaryBtn}
                style={{ width: '100%' }}
                onClick={sortInitiativeByAgility}
                title="Ordena combatentes pela Agilidade de Combate das Fichas (Spiritual Epitome)"
              >
                <ArrowDownWideNarrow size={13} color="#ecc050" />
                <span>Ordenar por Agilidade de Combate</span>
              </button>

              <div>
                <div className={styles.groupLabel}>
                  Ordem de Iniciativa (arraste para ordenar)
                </div>
                {appState.combat.turnOrder.length === 0 ? (
                  <div className={styles.emptyHint}>
                    Lista vazia. Adicione personagens abaixo para acompanhar turnos.
                  </div>
                ) : (
                  <div className={styles.charList}>
                    {appState.combat.turnOrder.map((id, idx) => {
                      const ch = appState.characters[id];
                      if (!ch) return null;
                      const isActive = appState.combat.activeCharacterId === id;
                      return (
                        <div
                          key={id}
                          draggable
                          onDragStart={() => setDragInitIdx(idx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleInitDrop(idx)}
                          className={`${styles.initRow} ${
                            isActive ? styles.initRowActive : ''
                          }`}
                          onClick={() => setActiveTurnCharacter(id)}
                        >
                          <GripVertical size={14} color="#64748b" />
                          <TokenAvatar imageId={ch.imageId} alt={ch.name} size={28} />
                          <div className={styles.charMeta}>
                            <div className={styles.charName}>{ch.name}</div>
                            {ch.epitomeSummary && (
                              <div className={styles.charSub}>
                                Agil. Combate: {ch.epitomeSummary.agilidadeCombate}
                              </div>
                            )}
                          </div>
                          {isActive && <span className={styles.turnBadge}>Ativo</span>}
                          <button
                            className={styles.iconBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCharacterFromInitiative(id);
                            }}
                            title="Remover da iniciativa"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {notInInitiative.length > 0 && (
                <div>
                  <div className={styles.groupLabel}>Fora da Iniciativa</div>
                  <div className={styles.charList}>
                    {notInInitiative.map((ch) => (
                      <div
                        key={ch.id}
                        className={styles.charCard}
                        onClick={() => addCharacterToInitiative(ch.id)}
                      >
                        <div className={styles.charInfo}>
                          <TokenAvatar imageId={ch.imageId} alt={ch.name} size={28} />
                          <span className={styles.charName}>{ch.name}</span>
                        </div>
                        <Plus size={14} color="#c9a65c" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ABA 3: HISTÓRICO DE AÇÕES (Parte 14.3 e 14.4) */}
        {leftTab === 'history' && (
          <>
            <div className={styles.headerActions}>
              <button
                className={styles.secondaryBtn}
                style={{ flex: 1 }}
                disabled={appState.history.past.length === 0}
                onClick={undo}
              >
                <Undo2 size={13} />
                <span>Desfazer ({appState.history.past.length})</span>
              </button>
              <button
                className={styles.secondaryBtn}
                style={{ flex: 1 }}
                disabled={appState.history.future.length === 0}
                onClick={redo}
              >
                <Redo2 size={13} />
                <span>Refazer ({appState.history.future.length})</span>
              </button>
            </div>

            <div className={styles.scrollArea}>
              <div className={styles.groupLabel}>
                Registro de Combate
                {attackCount > 0 ? ` • ${attackCount} ataque${attackCount > 1 ? 's' : ''}` : ''}
              </div>
              {logEntries.length === 0 ? (
                <div className={styles.emptyHint}>
                  Nenhuma ação registrada ainda nesta sessão. Ataques (com a
                  direção), movimentos e alterações de vida aparecerão aqui — a
                  orientação do personagem não é registrada.
                </div>
              ) : (
                [...logEntries].reverse().map((act) => (
                  <div
                    key={act.id}
                    className={`${styles.historyItem} ${
                      act.type === 'ATTACK_RESOLVE' ? styles.historyItemAttack : ''
                    }`}
                  >
                    <div className={styles.historyTime}>
                      {new Date(act.timestamp).toLocaleTimeString('pt-BR')} •{' '}
                      {ACTION_LABELS[act.type] ?? act.type}
                    </div>
                    <div>{act.description}</div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Alça lateral para recolher/expandir painel */}
      <button
        className={styles.collapseHandle}
        onClick={toggleLeftPanel}
        title={
          leftPanelOpen
            ? 'Recolher painel esquerdo'
            : 'Expandir lista de personagens'
        }
      >
        {leftPanelOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>
    </aside>
  );
};
