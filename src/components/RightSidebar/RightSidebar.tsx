import React, { useMemo, useState } from 'react';
import {
  BookmarkPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  Footprints,
  MapPin,
  MapPinOff,
  Plus,
  RefreshCw,
  ScrollText,
  SkipForward,
  Swords,
  Trash2,
  Zap,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { LINHAGEM_LABELS } from '../../epitome/epitomeEngine';
import {
  DIRECTION_SHORT,
  minDistanceFromCharacterToPoint,
} from '../../engine/geometry';
import { projectAttackOnBoard } from '../../engine/rotation';
import { calculateAttackDamage, detectAttackImpacts } from '../../engine/combat';
import { Direction, ImpactZone } from '../../types';
import { TokenAvatar } from '../common/TokenAvatar';
import styles from './RightSidebar.module.css';

const ALL_DIRECTIONS: Direction[] = [
  Direction.North,
  Direction.NorthEast,
  Direction.East,
  Direction.SouthEast,
  Direction.South,
  Direction.SouthWest,
  Direction.West,
  Direction.NorthWest,
];

const ZONE_NAME_PT: Record<ImpactZone, string> = {
  red: 'Zona Vermelha',
  orange: 'Zona Laranja',
  yellow: 'Zona Amarela',
};

export const RightSidebar: React.FC = () => {
  const appState = useGameStore((s) => s.appState);
  const selectedCharacterId = useGameStore((s) => s.selectedCharacterId);
  const rightPanelOpen = useGameStore((s) => s.rightPanelOpen);
  const attackTargeting = useGameStore((s) => s.attackTargeting);

  const toggleRightPanel = useGameStore((s) => s.toggleRightPanel);
  const enterMovementMode = useGameStore((s) => s.enterMovementMode);
  const rotateCharacter = useGameStore((s) => s.rotateCharacter);
  const applyDamage = useGameStore((s) => s.applyDamage);
  const applyHeal = useGameStore((s) => s.applyHeal);
  const autoPlaceCharacter = useGameStore((s) => s.autoPlaceCharacter);
  const removeCharacterFromBoard = useGameStore((s) => s.removeCharacterFromBoard);
  const openCharacterModal = useGameStore((s) => s.openCharacterModal);
  const openArsenalModal = useGameStore((s) => s.openArsenalModal);
  const openAttackEditorModal = useGameStore((s) => s.openAttackEditorModal);
  const openSpawnFichaModal = useGameStore((s) => s.openSpawnFichaModal);
  const setQuickSheetFichaId = useGameStore((s) => s.setQuickSheetFichaId);
  const spawnOrSyncFichaOnBoard = useGameStore(
    (s) => s.spawnOrSyncFichaOnBoard
  );
  const adjustCharacterEpitomeResource = useGameStore(
    (s) => s.adjustCharacterEpitomeResource
  );
  const duplicateCharacter = useGameStore((s) => s.duplicateCharacter);
  const deleteCharacter = useGameStore((s) => s.deleteCharacter);
  const saveCharacterAsTemplate = useGameStore((s) => s.saveCharacterAsTemplate);
  const nextTurn = useGameStore((s) => s.nextTurn);

  const startAttackTargeting = useGameStore((s) => s.startAttackTargeting);
  const updateAttackDirection = useGameStore((s) => s.updateAttackDirection);
  const setAttackAnchorToAttacker = useGameStore((s) => s.setAttackAnchorToAttacker);
  const setTargetDamageAdjustment = useGameStore((s) => s.setTargetDamageAdjustment);
  const confirmAttackResolution = useGameStore((s) => s.confirmAttackResolution);
  const cancelActiveModes = useGameStore((s) => s.cancelActiveModes);

  const [hpDeltaInput, setHpDeltaInput] = useState('10');

  const selectedChar = selectedCharacterId
    ? appState.characters[selectedCharacterId] ?? null
    : null;

  // Dados calculados em tempo real para o Painel de Resolução de Ataques (Parte 13)
  const resolutionData = useMemo(() => {
    if (!attackTargeting) return null;
    const attacker = appState.characters[attackTargeting.attackerId];
    const weapon = appState.weapons[attackTargeting.weaponId] ?? null;
    const attack = appState.attacks[attackTargeting.attackId];
    if (!attacker || !attack) return null;

    const projectedCells = projectAttackOnBoard(
      attack.area,
      attackTargeting.targetOrigin,
      attackTargeting.direction,
      appState.board,
      attackTargeting.manualOverrides
    );

    const { originHasLoS, impacts } = detectAttackImpacts({
      board: appState.board,
      projectedCells,
      characters: appState.characters,
      attacker,
      weapon,
      attack,
      damageRule: appState.settings.damageRule,
      targetOrigin: attackTargeting.targetOrigin,
      damageAdjustments: attackTargeting.damageAdjustments,
    });

    const originDist = minDistanceFromCharacterToPoint(
      attacker,
      attackTargeting.targetOrigin,
      appState.settings.diagonalRule
    );

    const baseDamage = calculateAttackDamage(
      attack,
      weapon,
      attacker,
      appState.settings.damageRule
    );

    return {
      attacker,
      weapon,
      attack,
      projectedCells,
      originHasLoS,
      originDist,
      baseDamage,
      impacts,
    };
  }, [attackTargeting, appState]);

  const hpRatio =
    selectedChar && selectedChar.hpMax > 0
      ? Math.max(0, Math.min(1, selectedChar.hpCurrent / selectedChar.hpMax))
      : 0;
  const hpColor =
    hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <aside className={styles.wrapper}>
      {/* Alça lateral para recolher/expandir painel direito */}
      <button
        className={styles.collapseHandle}
        onClick={toggleRightPanel}
        title={
          rightPanelOpen
            ? 'Recolher painel direito'
            : 'Expandir propriedades do selecionado'
        }
      >
        {rightPanelOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div
        className={`${styles.panel} ${
          !rightPanelOpen ? styles.panelCollapsed : ''
        }`}
      >
        {/* =================================================================== */}
        {/* MODO A: PAINEL DE RESOLUÇÃO DE ATAQUE (Parte 13)                     */}
        {/* =================================================================== */}
        {attackTargeting && resolutionData ? (
          <>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Resolução de Ataque</span>
              <button className={styles.dirBtn} onClick={cancelActiveModes}>
                Cancelar
              </button>
            </div>

            <div className={styles.scrollArea}>
              <div className={styles.heroCard}>
                <TokenAvatar
                  imageId={resolutionData.attacker.imageId}
                  alt={resolutionData.attacker.name}
                  size={44}
                />
                <div>
                  <div className={styles.heroName}>
                    {resolutionData.attack.name}
                  </div>
                  <div className={styles.heroMeta}>
                    {resolutionData.attacker.name}
                    {resolutionData.weapon
                      ? ` • ${resolutionData.weapon.name}`
                      : ''}
                  </div>
                  <div className={styles.heroMeta}>
                    Tipo: <strong>{resolutionData.attack.impactType || 'Geral'}</strong> • Dano Base:{' '}
                    <strong>{resolutionData.baseDamage}</strong>
                  </div>
                </div>
              </div>

              {/* Alcance, LoS e Ancoragem */}
              <div className={styles.cardBlock}>
                <div className={styles.blockTitle}>
                  <span>Origem & Linha de Visão</span>
                  <span
                    className={`${styles.statusPill} ${
                      resolutionData.originHasLoS
                        ? styles.statusOk
                        : styles.statusWarn
                    }`}
                  >
                    {resolutionData.originHasLoS ? 'LoS Livre' : 'LoS Bloqueada'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>
                    Origem: ({attackTargeting.targetOrigin.x},{' '}
                    {attackTargeting.targetOrigin.y})
                  </span>
                  <span
                    style={{
                      color:
                        resolutionData.originDist <= resolutionData.attack.range
                          ? '#86efac'
                          : '#fde047',
                    }}
                  >
                    Distância: {resolutionData.originDist} /{' '}
                    {resolutionData.attack.range} quad.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className={`${styles.dirBtn} ${
                      attackTargeting.anchorToAttacker ? styles.dirBtnActive : ''
                    }`}
                    style={{ flex: 1 }}
                    onClick={() => setAttackAnchorToAttacker(true)}
                  >
                    Ancorado no Atacante
                  </button>
                  <button
                    className={`${styles.dirBtn} ${
                      !attackTargeting.anchorToAttacker ? styles.dirBtnActive : ''
                    }`}
                    style={{ flex: 1 }}
                    onClick={() => setAttackAnchorToAttacker(false)}
                  >
                    Mira Livre no Grid
                  </button>
                </div>

                <div className={styles.blockTitle} style={{ marginTop: 4 }}>
                  <span>Rotação da Área (8 Direções)</span>
                </div>
                <div className={styles.compassGrid}>
                  {ALL_DIRECTIONS.map((dir) => (
                    <button
                      key={dir}
                      className={`${styles.dirBtn} ${
                        attackTargeting.direction === dir
                          ? styles.dirBtnActive
                          : ''
                      }`}
                      onClick={() => updateAttackDirection(dir)}
                    >
                      {DIRECTION_SHORT[dir]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista de Personagens Atingidos (Parte 13.2 e 13.3) */}
              <div className={styles.cardBlock}>
                <div className={styles.blockTitle}>
                  <span>Personagens Atingidos ({resolutionData.impacts.length})</span>
                </div>

                {resolutionData.impacts.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>
                    Nenhum personagem dentro dos {resolutionData.projectedCells.length} quadrados da área atual.
                  </div>
                ) : (
                  resolutionData.impacts.map((imp) => {
                    const zoneClass =
                      imp.zone === 'red'
                        ? styles.zoneRed
                        : imp.zone === 'orange'
                        ? styles.zoneOrange
                        : styles.zoneYellow;

                    return (
                      <div
                        key={imp.characterId}
                        className={`${styles.impactRow} ${
                          imp.ignored ? styles.impactRowIgnored : ''
                        }`}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 6,
                          }}
                        >
                          <strong style={{ fontSize: 12.5 }}>
                            {imp.characterName} ({imp.width}×{imp.height})
                          </strong>
                          <span className={`${styles.zoneTag} ${zoneClass}`}>
                            {ZONE_NAME_PT[imp.zone]}
                          </span>
                        </div>

                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          {imp.hitSquares}/{imp.totalSquares} quadrado
                          {imp.totalSquares > 1 ? 's' : ''} atingido
                          {imp.hitSquares > 1 ? 's' : ''} • Dano único sugerido:{' '}
                          <strong>{imp.suggestedDamage}</strong>
                          {imp.isAttacker && ' • (Atacante)'}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              fontSize: 11.5,
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={!imp.ignored}
                              onChange={(e) =>
                                setTargetDamageAdjustment(
                                  imp.characterId,
                                  imp.finalDamage,
                                  !e.target.checked
                                )
                              }
                            />
                            <span>Aplicar no alvo</span>
                          </label>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                              Dano:
                            </span>
                            <input
                              type="number"
                              min={0}
                              className={styles.numInput}
                              value={imp.finalDamage}
                              disabled={imp.ignored}
                              onChange={(e) =>
                                setTargetDamageAdjustment(
                                  imp.characterId,
                                  Number(e.target.value) || 0,
                                  imp.ignored
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Ações de Confirmação (Manual ou Automática) */}
              <div className={styles.actionGrid}>
                <button
                  className={styles.btnPrimaryGold}
                  onClick={() => confirmAttackResolution(false)}
                >
                  <CheckCircle2 size={15} />
                  <span>Confirmar e Aplicar Efeitos</span>
                </button>
                <button
                  className={styles.btnAction}
                  style={{ gridColumn: 'span 2' }}
                  onClick={() => confirmAttackResolution(true)}
                  title="Atalho rápido: aplica imediatamente os danos sugeridos padrão"
                >
                  <Zap size={14} color="#facc15" />
                  <span>Aplicar Automaticamente ({resolutionData.baseDamage} dano)</span>
                </button>
              </div>
            </div>
          </>
        ) : selectedChar ? (
          /* =================================================================== */
          /* MODO B: PROPRIEDADES DO PERSONAGEM SELECIONADO (Parte 5.3)          */
          /* =================================================================== */
          <>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Unidade Selecionada</span>
              <button
                className={styles.dirBtn}
                onClick={() => openCharacterModal(selectedChar.id)}
              >
                <Edit3 size={12} style={{ marginRight: 4 }} />
                Editar
              </button>
            </div>

            <div className={styles.scrollArea}>
              <div className={styles.heroCard}>
                <TokenAvatar
                  imageId={selectedChar.imageId}
                  alt={selectedChar.name}
                  size={52}
                  borderColor="#facc15"
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className={styles.heroName}>{selectedChar.name}</div>
                  <div className={styles.heroMeta}>
                    Dimensão {selectedChar.width}×{selectedChar.height} •{' '}
                    {selectedChar.position
                      ? `Grid (${selectedChar.position.x}, ${selectedChar.position.y})`
                      : 'Fora do Tabuleiro'}
                  </div>
                </div>
              </div>

              {/* Controle de Vida (Dano / Cura) */}
              <div className={styles.cardBlock}>
                <div className={styles.blockTitle}>
                  <span>Pontos de Vida (HP)</span>
                  <span>
                    {selectedChar.hpCurrent} / {selectedChar.hpMax}
                  </span>
                </div>
                <div className={styles.hpBarOuter}>
                  <div
                    className={styles.hpBarInner}
                    style={{
                      width: `${hpRatio * 100}%`,
                      background: hpColor,
                    }}
                  />
                  <div className={styles.hpBarText}>
                    {selectedChar.hpCurrent} / {selectedChar.hpMax} HP
                  </div>
                </div>

                <div className={styles.hpControlsRow}>
                  <input
                    type="number"
                    min={1}
                    className={styles.numInput}
                    value={hpDeltaInput}
                    onChange={(e) => setHpDeltaInput(e.target.value)}
                  />
                  <button
                    className={styles.btnDamage}
                    onClick={() =>
                      applyDamage(selectedChar.id, Number(hpDeltaInput) || 0)
                    }
                  >
                    - Dano
                  </button>
                  <button
                    className={styles.btnHeal}
                    onClick={() =>
                      applyHeal(selectedChar.id, Number(hpDeltaInput) || 0)
                    }
                  >
                    + Curar
                  </button>
                </div>
              </div>

              {/* Atributos Principais */}
              <div className={styles.statsGrid}>
                <div className={styles.statPill}>
                  <div className={styles.statVal}>{selectedChar.movement}</div>
                  <div className={styles.statLbl}>Movimento</div>
                </div>
                <div className={styles.statPill}>
                  <div className={styles.statVal}>{selectedChar.baseDamage}</div>
                  <div className={styles.statLbl}>Dano Físico</div>
                </div>
                <div className={styles.statPill}>
                  <div className={styles.statVal}>
                    {selectedChar.epitomeSummary
                      ? selectedChar.epitomeSummary.agilidadeCombate
                      : `${selectedChar.width}×${selectedChar.height}`}
                  </div>
                  <div className={styles.statLbl}>
                    {selectedChar.epitomeSummary ? 'Agil. Combate' : 'Área Grid'}
                  </div>
                </div>
              </div>

              {/* Painel Integrado Spiritual-Epitome (quando vinculado a uma Ficha) */}
              {selectedChar.fichaId && selectedChar.epitomeSummary && (
                <div className={styles.cardBlock}>
                  <div className={styles.blockTitle}>
                    <span>
                      Spiritual Epitome • Nv.{selectedChar.epitomeSummary.nivel}
                    </span>
                    <span style={{ color: 'var(--gold-bright)' }}>
                      {LINHAGEM_LABELS[
                        selectedChar.epitomeSummary.linhagem
                      ].replace('Linhagem ', '')}
                    </span>
                  </div>

                  {/* Mana, Estamina e Raciocínio */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      fontSize: 11.5,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 8px',
                        borderRadius: 4,
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span>
                        <strong style={{ color: '#93c5fd' }}>Mana:</strong>{' '}
                        {selectedChar.epitomeSummary.manaAtual} /{' '}
                        {selectedChar.epitomeSummary.manaTotal}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 10.5 }}>
                        Dano Mág. {selectedChar.epitomeSummary.danoMagico}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                        padding: '5px 8px',
                        borderRadius: 4,
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span>
                        <strong style={{ color: '#86efac' }}>Estamina:</strong>{' '}
                        {selectedChar.epitomeSummary.estaminaAtual} /{' '}
                        {selectedChar.epitomeSummary.estaminaTotal}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          className={styles.dirBtn}
                          title={`Gastar 1 de Estamina (máx ${selectedChar.epitomeSummary.estaminaMaxGasto}/ação)`}
                          onClick={() =>
                            adjustCharacterEpitomeResource(
                              selectedChar.id,
                              'estamina',
                              -1
                            )
                          }
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          className={styles.dirBtn}
                          title={`Gastar limite máximo da ação (-${selectedChar.epitomeSummary.estaminaMaxGasto})`}
                          onClick={() =>
                            adjustCharacterEpitomeResource(
                              selectedChar.id,
                              'estamina',
                              -selectedChar.epitomeSummary!.estaminaMaxGasto
                            )
                          }
                        >
                          -{selectedChar.epitomeSummary.estaminaMaxGasto}
                        </button>
                        <button
                          type="button"
                          className={styles.dirBtn}
                          title={`Recuperação padrão (+${selectedChar.epitomeSummary.estaminaRecuperarPadrao})`}
                          onClick={() =>
                            adjustCharacterEpitomeResource(
                              selectedChar.id,
                              'estamina',
                              selectedChar.epitomeSummary!.estaminaRecuperarPadrao
                            )
                          }
                        >
                          +{selectedChar.epitomeSummary.estaminaRecuperarPadrao}
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                        padding: '5px 8px',
                        borderRadius: 4,
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span>
                        <strong style={{ color: '#fcd34d' }}>Raciocínio:</strong>{' '}
                        {selectedChar.epitomeSummary.racAtual} /{' '}
                        {selectedChar.epitomeSummary.racTotal}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          className={styles.dirBtn}
                          onClick={() =>
                            adjustCharacterEpitomeResource(
                              selectedChar.id,
                              'raciocinio',
                              -1
                            )
                          }
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          className={styles.dirBtn}
                          title={`Recuperação padrão (+${selectedChar.epitomeSummary.racRecuperarPadrao})`}
                          onClick={() =>
                            adjustCharacterEpitomeResource(
                              selectedChar.id,
                              'raciocinio',
                              selectedChar.epitomeSummary!.racRecuperarPadrao
                            )
                          }
                        >
                          +{selectedChar.epitomeSummary.racRecuperarPadrao}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                    <button
                      type="button"
                      className={styles.btnAction}
                      style={{ flex: 1 }}
                      onClick={() =>
                        setQuickSheetFichaId(selectedChar.fichaId!)
                      }
                    >
                      <ScrollText size={13} color="#ecc050" />
                      <span>Abrir Ficha</span>
                    </button>
                    <button
                      type="button"
                      className={styles.btnAction}
                      title="Recalcula atributos, armas e áreas mágicas a partir da Ficha"
                      onClick={() =>
                        spawnOrSyncFichaOnBoard(selectedChar.fichaId!, {
                          placeOnBoard: false,
                          updateExisting: true,
                        })
                      }
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>
              )}

              {/* Orientação em 8 Direções */}
              <div className={styles.cardBlock}>
                <div className={styles.blockTitle}>
                  <span>Orientação (Facing)</span>
                  <span>{DIRECTION_SHORT[selectedChar.facing]}</span>
                </div>
                <div className={styles.compassGrid}>
                  {ALL_DIRECTIONS.map((dir) => (
                    <button
                      key={dir}
                      className={`${styles.dirBtn} ${
                        selectedChar.facing === dir ? styles.dirBtnActive : ''
                      }`}
                      onClick={() => rotateCharacter(selectedChar.id, dir)}
                    >
                      {DIRECTION_SHORT[dir]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Armas Equipadas e Painel de Ataques (Partes 9 e 10) */}
              <div className={styles.cardBlock}>
                <div className={styles.blockTitle}>
                  <span>Armas & Painel de Ataques</span>
                  <button
                    className={styles.dirBtn}
                    onClick={() => openArsenalModal(null, selectedChar.id)}
                  >
                    <Plus size={11} /> Equipar / Criar
                  </button>
                </div>

                {selectedChar.weaponIds.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>
                    Nenhuma arma equipada. Clique em "Equipar / Criar" para atribuir armas e ataques personalizados.
                  </div>
                ) : (
                  selectedChar.weaponIds.map((wid) => {
                    const wp = appState.weapons[wid];
                    if (!wp) return null;

                    // Exibe no mínimo 3 slots visuais por padrão, mas suporta ilimitados (Parte 10.1)
                    const slotCount = Math.max(3, wp.attackIds.length);
                    const slots = Array.from({ length: slotCount }, (_, i) =>
                      wp.attackIds[i] ? appState.attacks[wp.attackIds[i]] : null
                    );

                    return (
                      <div key={wp.id} className={styles.weaponBox}>
                        <div className={styles.weaponHeader}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <TokenAvatar
                              imageId={wp.iconId}
                              alt={wp.name}
                              size={30}
                            />
                            <div>
                              <div className={styles.weaponName}>{wp.name}</div>
                              <div className={styles.weaponSub}>
                                {wp.category || 'Arma'} • Alcance {wp.range} • Base +
                                {wp.baseDamage}
                              </div>
                            </div>
                          </div>
                          <button
                            className={styles.dirBtn}
                            onClick={() => openArsenalModal(wp.id, selectedChar.id)}
                            title="Editar arma e seus ataques"
                          >
                            Editar
                          </button>
                        </div>

                        <div className={styles.attackSlots}>
                          {slots.map((atk, idx) =>
                            atk ? (
                              <button
                                key={atk.id}
                                className={styles.attackSlotBtn}
                                onClick={() =>
                                  startAttackTargeting(
                                    selectedChar.id,
                                    wp.id,
                                    atk.id
                                  )
                                }
                              >
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 12 }}>
                                    ⚔️ {atk.name}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 10.5,
                                      color: 'var(--text-secondary)',
                                    }}
                                  >
                                    Alcance {atk.range} •{' '}
                                    {atk.impactType || 'Impacto'} •{' '}
                                    {atk.area.cells.length} quad.
                                  </div>
                                </div>
                                <span
                                  style={{
                                    fontWeight: 700,
                                    color: 'var(--gold-bright)',
                                    fontSize: 12.5,
                                  }}
                                >
                                  {calculateAttackDamage(
                                    atk,
                                    wp,
                                    selectedChar,
                                    appState.settings.damageRule
                                  )}{' '}
                                  DMG
                                </span>
                              </button>
                            ) : (
                              <div key={`empty_${idx}`} className={styles.emptySlot}>
                                <span>Slot de Ataque {idx + 1} vazio</span>
                                <button
                                  className={styles.dirBtn}
                                  onClick={() =>
                                    openAttackEditorModal(wp.id, null)
                                  }
                                >
                                  + Criar
                                </button>
                              </div>
                            )
                          )}
                          <button
                            className={styles.dirBtn}
                            style={{ marginTop: 2 }}
                            onClick={() => openAttackEditorModal(wp.id, null)}
                          >
                            + Novo Ataque Personalizado
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Ações Táticas e Gerenciamento */}
              <div className={styles.actionGrid}>
                {selectedChar.position ? (
                  <button
                    className={styles.btnPrimaryGold}
                    onClick={() => enterMovementMode(selectedChar.id)}
                  >
                    <Footprints size={15} />
                    <span>Mover pelo Tabuleiro</span>
                  </button>
                ) : (
                  <button
                    className={styles.btnPrimaryGold}
                    onClick={() => autoPlaceCharacter(selectedChar.id)}
                  >
                    <MapPin size={15} />
                    <span>Posicionar no Tabuleiro</span>
                  </button>
                )}

                <button
                  className={styles.btnAction}
                  onClick={() => openArsenalModal(null, selectedChar.id)}
                >
                  <Swords size={14} />
                  <span>Arsenal</span>
                </button>

                <button
                  className={styles.btnAction}
                  onClick={() => saveCharacterAsTemplate(selectedChar.id)}
                >
                  <BookmarkPlus size={14} />
                  <span>Salvar Modelo</span>
                </button>

                <button
                  className={styles.btnAction}
                  onClick={() => duplicateCharacter(selectedChar.id)}
                >
                  <Copy size={14} />
                  <span>Duplicar</span>
                </button>

                {selectedChar.position ? (
                  <button
                    className={styles.btnAction}
                    onClick={() => removeCharacterFromBoard(selectedChar.id)}
                  >
                    <MapPinOff size={14} />
                    <span>Tirar do Grid</span>
                  </button>
                ) : (
                  <button
                    className={styles.btnAction}
                    onClick={() => deleteCharacter(selectedChar.id)}
                  >
                    <Trash2 size={14} color="#f87171" />
                    <span>Excluir</span>
                  </button>
                )}

                {appState.combat.mode === 'turns' && (
                  <button
                    className={styles.btnAction}
                    style={{ gridColumn: 'span 2' }}
                    onClick={nextTurn}
                  >
                    <SkipForward size={14} />
                    <span>Finalizar Ação / Passar Turno</span>
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          /* =================================================================== */
          /* MODO C: NENHUM SELECIONADO — GUIA RÁPIDO DO MESTRE                  */
          /* =================================================================== */
          <>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Controle do Mestre</span>
            </div>
            <div className={styles.scrollArea}>
              <div className={styles.cardBlock}>
                <div className={styles.blockTitle}>Atalhos & Interações</div>
                <ul className={styles.guideList}>
                  <li>
                    <strong>Clique simples</strong> em um personagem: seleciona e abre este painel.
                  </li>
                  <li>
                    <strong>Clique duplo</strong> no personagem: calcula e destaca áreas de movimento (BFS).
                  </li>
                  <li>
                    <strong>Arrastar personagem</strong>: move livremente pelo grid.
                  </li>
                  <li>
                    <strong>Arrastar seta dourada</strong>: gira orientação entre as 8 direções.
                  </li>
                  <li>
                    <strong>Passe o mouse</strong> sobre qualquer unidade para revelar sua barra de vida.
                  </li>
                  <li>
                    <strong>Botão direito / meio ou WASD</strong>: move a câmera. <strong>Scroll</strong>: zoom (0,25×–4×). <strong>Tecla 0</strong>: centraliza.
                  </li>
                </ul>
              </div>

              <div className={styles.actionGrid}>
                <button
                  className={styles.btnPrimaryGold}
                  onClick={() => openSpawnFichaModal(null)}
                >
                  <ScrollText size={15} />
                  <span>Invocar Personagem das Fichas</span>
                </button>
                <button
                  className={styles.btnAction}
                  style={{ gridColumn: 'span 2' }}
                  onClick={() => openCharacterModal(null)}
                >
                  <Plus size={14} />
                  <span>Criar NPC / Criatura Livre</span>
                </button>
                <button
                  className={styles.btnAction}
                  style={{ gridColumn: 'span 2' }}
                  onClick={() => openArsenalModal(null, null)}
                >
                  <Swords size={14} />
                  <span>Abrir Biblioteca de Armas & Ataques</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
