import React, { useEffect, useMemo, useState } from 'react';
import {
  Crosshair,
  Eraser,
  Flame,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { AreaCell, Attack, Direction, ImpactZone } from '../../types';
import { cellKey, DIRECTION_SHORT, GridPoint } from '../../engine/geometry';
import {
  generateCircleCells,
  generateConeCells,
  generateCrossCells,
  generateLineCells,
  generateRectangleCells,
  rotateAreaCells,
  rotateOffset,
} from '../../engine/rotation';
import styles from './ModalShared.module.css';
import editorStyles from './AttackEditorModal.module.css';

type DrawTool =
  | 'individual'
  | 'irregular'
  | 'single'
  | 'line'
  | 'cone'
  | 'cross'
  | 'square'
  | 'circle'
  | 'origin'
  | 'eraser';

const EDITOR_HALF = 7; // Grid 15×15 de -7 a +7

const IMPACT_PRESETS = [
  'Corpo a Corpo',
  'Cortante',
  'Perfurante',
  'Contundente',
  'Impacto',
  'Fogo',
  'Gelo',
  'Arcano',
];

const ALL_DIRS: Direction[] = [
  Direction.North,
  Direction.NorthEast,
  Direction.East,
  Direction.SouthEast,
  Direction.South,
  Direction.SouthWest,
  Direction.West,
  Direction.NorthWest,
];

export const AttackEditorModal: React.FC = () => {
  const modal = useGameStore((s) => s.attackEditorModal);
  const appState = useGameStore((s) => s.appState);
  const arsenalCatalog = useGameStore((s) => s.arsenalCatalog);
  const closeAttackEditorModal = useGameStore((s) => s.closeAttackEditorModal);
  const upsertAttack = useGameStore((s) => s.upsertAttack);
  const showToast = useGameStore((s) => s.showToast);

  const weapon = modal.weaponId
    ? arsenalCatalog.weapons[modal.weaponId] ??
      appState.weapons[modal.weaponId] ??
      null
    : null;
  const existing = modal.editAttackId
    ? arsenalCatalog.attacks[modal.editAttackId] ??
      appState.attacks[modal.editAttackId] ??
      null
    : null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [range, setRange] = useState(2);
  const [damage, setDamage] = useState(12);
  const [impactType, setImpactType] = useState('Cortante');
  const [allowExceedWeaponRange, setAllowExceedWeaponRange] = useState(false);

  const [origin, setOrigin] = useState<GridPoint>({ x: 0, y: 0 });
  const [cellsMap, setCellsMap] = useState<Record<string, AreaCell>>({});

  const [tool, setTool] = useState<DrawTool>('individual');
  const [activeZone, setActiveZone] = useState<ImpactZone>('red');
  const [previewDirection, setPreviewDirection] = useState<Direction>(
    Direction.North
  );

  const [dragStart, setDragStart] = useState<GridPoint | null>(null);
  const [hoverPt, setHoverPt] = useState<GridPoint | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);

  useEffect(() => {
    if (!modal.open) return;
    setPreviewDirection(Direction.North);
    setDragStart(null);
    setIsMouseDown(false);

    if (existing) {
      setName(existing.name);
      setDescription(existing.description);
      setRange(existing.range);
      setDamage(existing.damage);
      setImpactType(existing.impactType);
      setOrigin({ ...existing.area.origin });
      const map: Record<string, AreaCell> = {};
      for (const c of existing.area.cells) {
        map[cellKey(c.dx, c.dy)] = { ...c };
      }
      setCellsMap(map);
      setAllowExceedWeaponRange(
        weapon ? existing.range > weapon.range : false
      );
    } else {
      setName('');
      setDescription('');
      setRange(weapon ? weapon.range : 2);
      setDamage(12);
      setImpactType('Cortante');
      setOrigin({ x: 0, y: 0 });
      setCellsMap({
        '0,-1': { dx: 0, dy: -1, zone: 'red' },
      });
      setAllowExceedWeaponRange(false);
    }
  }, [modal.open, existing?.id, weapon?.id]);

  // Células exibidas no editor (incluindo pré-visualização de ferramentas geométricas e rotação)
  const displayedBoardMap = useMemo(() => {
    const baseList = Object.values(cellsMap);

    // Se estiver arrastando uma ferramenta geométrica no modo Norte (edição base)
    let draftOffsets: AreaCell[] = [];
    if (
      previewDirection === Direction.North &&
      isMouseDown &&
      dragStart &&
      hoverPt
    ) {
      const relStart = {
        x: dragStart.x - origin.x,
        y: dragStart.y - origin.y,
      };
      const relEnd = {
        x: hoverPt.x - origin.x,
        y: hoverPt.y - origin.y,
      };

      if (tool === 'line') {
        draftOffsets = generateLineCells({ x: 0, y: 0 }, relEnd, activeZone, false);
      } else if (tool === 'cone') {
        draftOffsets = generateConeCells({ x: 0, y: 0 }, relEnd, activeZone);
      } else if (tool === 'square') {
        draftOffsets = generateRectangleCells(relStart, relEnd, activeZone);
      } else if (tool === 'circle') {
        const radius = Math.round(
          Math.hypot(relEnd.x - relStart.x, relEnd.y - relStart.y)
        );
        draftOffsets = generateCircleCells(relStart, radius, activeZone);
      } else if (tool === 'cross') {
        const arm = Math.max(
          1,
          Math.round(Math.hypot(relEnd.x - relStart.x, relEnd.y - relStart.y))
        );
        draftOffsets = generateCrossCells(relStart, arm, activeZone, true);
      }
    }

    const combinedMap = new Map<string, AreaCell>();
    for (const c of baseList) {
      combinedMap.set(cellKey(c.dx, c.dy), c);
    }
    for (const d of draftOffsets) {
      combinedMap.set(cellKey(d.dx, d.dy), d);
    }

    const rotatedOriginDelta = rotateOffset(origin.x, origin.y, previewDirection);
    const rotatedOrigin: GridPoint = {
      x: rotatedOriginDelta.dx,
      y: rotatedOriginDelta.dy,
    };
    const rotatedCells = rotateAreaCells(
      Array.from(combinedMap.values()),
      previewDirection
    );

    const gridLookup = new Map<string, ImpactZone>();
    for (const rc of rotatedCells) {
      const gx = rotatedOrigin.x + rc.dx;
      const gy = rotatedOrigin.y + rc.dy;
      gridLookup.set(cellKey(gx, gy), rc.zone);
    }

    return {
      rotatedOrigin,
      gridLookup,
      totalCells: rotatedCells.length,
    };
  }, [
    cellsMap,
    origin,
    previewDirection,
    isMouseDown,
    dragStart,
    hoverPt,
    tool,
    activeZone,
  ]);

  if (!modal.open) return null;

  const commitCells = (incoming: AreaCell[], replaceAll = false) => {
    setCellsMap((prev) => {
      const next = replaceAll ? {} : { ...prev };
      for (const c of incoming) {
        next[cellKey(c.dx, c.dy)] = { ...c };
      }
      return next;
    });
  };

  const handleCellDown = (gx: number, gy: number) => {
    // Se estiver visualizando outra rotação, retorna automaticamente para Norte (0°) ou aplica edição
    if (previewDirection !== Direction.North) {
      // Permite ajuste direto pós-rotação convertendo rotação atual em base se desejar,
      // ou volta para Norte com aviso suave
      const rotatedList = rotateAreaCells(
        Object.values(cellsMap),
        previewDirection
      );
      const rotOrigDelta = rotateOffset(origin.x, origin.y, previewDirection);
      const rotOrig: GridPoint = { x: rotOrigDelta.dx, y: rotOrigDelta.dy };
      const baked: Record<string, AreaCell> = {};
      for (const c of rotatedList) {
        baked[cellKey(c.dx, c.dy)] = c;
      }
      const dx = gx - rotOrig.x;
      const dy = gy - rotOrig.y;
      const k = cellKey(dx, dy);
      if (tool === 'eraser' || baked[k]?.zone === activeZone) {
        delete baked[k];
      } else {
        baked[k] = { dx, dy, zone: activeZone };
      }
      setOrigin(rotOrig);
      setCellsMap(baked);
      setPreviewDirection(Direction.North);
      return;
    }

    setIsMouseDown(true);
    setDragStart({ x: gx, y: gy });
    setHoverPt({ x: gx, y: gy });

    const dx = gx - origin.x;
    const dy = gy - origin.y;
    const k = cellKey(dx, dy);

    if (tool === 'origin') {
      setOrigin({ x: gx, y: gy });
      return;
    }

    if (tool === 'eraser') {
      setCellsMap((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
      return;
    }

    if (tool === 'single') {
      setCellsMap({ [k]: { dx, dy, zone: activeZone } });
      return;
    }

    if (tool === 'individual') {
      setCellsMap((prev) => {
        const next = { ...prev };
        if (next[k]?.zone === activeZone) {
          delete next[k];
        } else {
          next[k] = { dx, dy, zone: activeZone };
        }
        return next;
      });
      return;
    }

    if (tool === 'irregular') {
      setCellsMap((prev) => ({
        ...prev,
        [k]: { dx, dy, zone: activeZone },
      }));
    }
  };

  const handleCellEnter = (gx: number, gy: number) => {
    setHoverPt({ x: gx, y: gy });
    if (!isMouseDown || previewDirection !== Direction.North) return;

    const dx = gx - origin.x;
    const dy = gy - origin.y;
    const k = cellKey(dx, dy);

    if (tool === 'irregular') {
      setCellsMap((prev) => ({
        ...prev,
        [k]: { dx, dy, zone: activeZone },
      }));
    } else if (tool === 'eraser') {
      setCellsMap((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  };

  const handleMouseUpGrid = () => {
    if (
      isMouseDown &&
      previewDirection === Direction.North &&
      dragStart &&
      hoverPt
    ) {
      const relStart = {
        x: dragStart.x - origin.x,
        y: dragStart.y - origin.y,
      };
      const relEnd = {
        x: hoverPt.x - origin.x,
        y: hoverPt.y - origin.y,
      };

      if (tool === 'line') {
        commitCells(
          generateLineCells({ x: 0, y: 0 }, relEnd, activeZone, false)
        );
      } else if (tool === 'cone') {
        commitCells(generateConeCells({ x: 0, y: 0 }, relEnd, activeZone));
      } else if (tool === 'square') {
        commitCells(generateRectangleCells(relStart, relEnd, activeZone));
      } else if (tool === 'circle') {
        const radius = Math.round(
          Math.hypot(relEnd.x - relStart.x, relEnd.y - relStart.y)
        );
        commitCells(generateCircleCells(relStart, radius, activeZone));
      } else if (tool === 'cross') {
        const arm = Math.max(
          1,
          Math.round(Math.hypot(relEnd.x - relStart.x, relEnd.y - relStart.y))
        );
        commitCells(generateCrossCells(relStart, arm, activeZone, true));
      }
    }
    setIsMouseDown(false);
    setDragStart(null);
  };

  const exceedsWeaponRange = weapon ? range > weapon.range : false;

  const handleSaveAttack = (e: React.FormEvent) => {
    e.preventDefault();
    if (exceedsWeaponRange && !allowExceedWeaponRange) {
      showToast(
        'Marque a confirmação para permitir alcance maior que o alcance geral da arma.'
      );
      return;
    }

    const cellsList = Object.values(cellsMap);
    if (cellsList.length === 0) {
      showToast('Adicione pelo menos 1 quadrado na área de impacto do ataque.');
      return;
    }

    const id =
      existing?.id ||
      `atk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const saved: Attack = {
      id,
      name: name.trim() || 'Ataque Personalizado',
      description: description.trim(),
      range: Math.max(0, Math.round(range)),
      damage: Math.max(0, Math.round(damage)),
      impactType: impactType.trim() || 'Geral',
      effects: existing?.effects || [],
      area: {
        origin: { ...origin },
        cells: cellsList,
      },
    };

    upsertAttack(saved, modal.weaponId);
    showToast(`Ataque "${saved.name}" salvo com ${cellsList.length} quadrados!`);
    closeAttackEditorModal();
  };

  const coords: number[] = [];
  for (let i = -EDITOR_HALF; i <= EDITOR_HALF; i++) coords.push(i);

  return (
    <div
      className={styles.backdrop}
      onClick={closeAttackEditorModal}
      onMouseUp={handleMouseUpGrid}
    >
      <form
        className={`${styles.modal} ${styles.modalWide}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSaveAttack}
      >
        <div className={styles.header}>
          <div className={styles.title}>
            <Flame size={17} />
            <span>
              Editor Visual de Ataque
              {weapon ? ` — ${weapon.name}` : ''}
            </span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={closeAttackEditorModal}
          >
            <X size={16} />
          </button>
        </div>

        <div className={`${styles.body} ${editorStyles.editorBody}`}>
          {/* Coluna Esquerda: Atributos do Ataque e Zonas */}
          <div className={editorStyles.column}>
            <div className={styles.field}>
              <label className={styles.label}>Nome do Ataque</label>
              <input
                className={styles.input}
                placeholder="Ex: Corte Crescente, Sopro de Gelo..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Dano</label>
                <input
                  type="number"
                  min={0}
                  className={styles.input}
                  value={damage}
                  onChange={(e) => setDamage(Number(e.target.value))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Alcance</label>
                <input
                  type="number"
                  min={0}
                  className={styles.input}
                  value={range}
                  onChange={(e) => setRange(Number(e.target.value))}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Tipo de Impacto</label>
              <input
                className={styles.input}
                placeholder="Corpo a Corpo, Perfurante, Fogo..."
                value={impactType}
                onChange={(e) => setImpactType(e.target.value)}
                list="impact-type-presets"
              />
              <datalist id="impact-type-presets">
                {IMPACT_PRESETS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <div className={editorStyles.impactChips}>
                {IMPACT_PRESETS.slice(0, 5).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`${editorStyles.impactChip} ${
                      impactType.trim().toLowerCase() === p.toLowerCase()
                        ? editorStyles.impactChipActive
                        : ''
                    }`}
                    onClick={() => setImpactType(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {exceedsWeaponRange && weapon && (
              <div className={styles.warnNote}>
                <div>
                  Alcance ({range}) ultrapassa o alcance geral da arma ({weapon.range}).
                </div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 5,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allowExceedWeaponRange}
                    onChange={(e) => setAllowExceedWeaponRange(e.target.checked)}
                  />
                  <span>Permitir explicitamente este alcance superior</span>
                </label>
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>Descrição Livre</label>
              <textarea
                className={styles.textarea}
                placeholder="Notas sobre o efeito ou comportamento narrativo..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Seletor de Zona de Impacto (Parte 11) */}
            <div className={styles.card}>
              <div className={styles.label}>Cor / Zona de Ameaça Ativa</div>
              {(
                [
                  {
                    z: 'red' as ImpactZone,
                    title: 'Vermelho — Evasão Obrigatória',
                    color: '#ef4444',
                  },
                  {
                    z: 'orange' as ImpactZone,
                    title: 'Laranja — Zona de Reação',
                    color: '#f97316',
                  },
                  {
                    z: 'yellow' as ImpactZone,
                    title: 'Amarelo — Risco Indireto',
                    color: '#eab308',
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.z}
                  type="button"
                  onClick={() => setActiveZone(item.z)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    border:
                      activeZone === item.z
                        ? `1.5px solid ${item.color}`
                        : '1px solid var(--border-subtle)',
                    background:
                      activeZone === item.z
                        ? `${item.color}26`
                        : 'var(--bg-input)',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: 3,
                      background: item.color,
                    }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {item.title}
                  </span>
                </button>
              ))}
            </div>

            {/* Validador de Rotação em 8 Direções (Parte 12.2 Etapa C) */}
            <div className={styles.card}>
              <div className={editorStyles.rotationHeader}>
                <span className={styles.label}>
                  <RotateCw size={12} style={{ marginRight: 4 }} />
                  Testar Rotação (8 Direções)
                </span>
                <span className={editorStyles.rotationBase}>
                  Base = Norte (↑)
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 4,
                }}
              >
                {ALL_DIRS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`${styles.chip} ${
                      previewDirection === d ? styles.chipActive : ''
                    }`}
                    onClick={() => setPreviewDirection(d)}
                  >
                    {DIRECTION_SHORT[d]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Coluna Direita: Ferramentas de Desenho e Grid Visual 15×15 */}
          <div className={editorStyles.column}>
            <div className={`${styles.card} ${editorStyles.toolsCard}`}>
              <div className={styles.label}>
                Ferramentas de Desenho (clique ou arraste no grid abaixo)
              </div>
              <div className={styles.chipRow}>
                {(
                  [
                    { id: 'individual', label: 'Seleção Individual' },
                    { id: 'irregular', label: 'Área Irregular (Pincel)' },
                    { id: 'single', label: 'Alvo Único' },
                    { id: 'line', label: 'Linha Reta' },
                    { id: 'cone', label: 'Cone' },
                    { id: 'cross', label: 'Cruz' },
                    { id: 'square', label: 'Quadrado' },
                    { id: 'circle', label: 'Círculo' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`${styles.chip} ${
                      tool === t.id ? styles.chipActive : ''
                    }`}
                    onClick={() => setTool(t.id)}
                  >
                    {t.label}
                  </button>
                ))}

                <button
                  type="button"
                  className={`${styles.chip} ${
                    tool === 'origin' ? styles.chipActive : ''
                  }`}
                  onClick={() => setTool('origin')}
                  title="Definir ponto de origem relativo ao atacante"
                >
                  <Crosshair size={11} /> Origem ({origin.x},{origin.y})
                </button>

                <button
                  type="button"
                  className={`${styles.chip} ${
                    tool === 'eraser' ? styles.chipActive : ''
                  }`}
                  onClick={() => setTool('eraser')}
                >
                  <Eraser size={11} /> Borracha
                </button>

                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => setCellsMap({})}
                  title="Limpar todos os quadrados"
                >
                  <Trash2 size={11} /> Limpar
                </button>
              </div>
            </div>

            {/* Grid Interativo 15×15 */}
            <div className={editorStyles.canvasCard}>
              <div className={editorStyles.tileGrid}>
                {coords.map((gy) =>
                  coords.map((gx) => {
                    const isAttacker = gx === 0 && gy === 0;
                    const isOrigin =
                      gx === displayedBoardMap.rotatedOrigin.x &&
                      gy === displayedBoardMap.rotatedOrigin.y;
                    const zone = displayedBoardMap.gridLookup.get(
                      cellKey(gx, gy)
                    );

                    let bg = (gx + gy) % 2 === 0 ? '#151b26' : '#181f2c';
                    if (zone === 'red') bg = 'rgba(239, 68, 68, 0.65)';
                    else if (zone === 'orange') bg = 'rgba(249, 115, 22, 0.62)';
                    else if (zone === 'yellow') bg = 'rgba(234, 179, 8, 0.56)';

                    return (
                      <div
                        key={`${gx},${gy}`}
                        className={editorStyles.tile}
                        onMouseDown={() => handleCellDown(gx, gy)}
                        onMouseEnter={() => handleCellEnter(gx, gy)}
                        title={`Offset (${gx}, ${gy})`}
                        style={{
                          background: bg,
                          border: isOrigin
                            ? '1.5px dashed #4ade80'
                            : isAttacker
                            ? '1.5px solid #facc15'
                            : 'none',
                        }}
                      >
                        {isAttacker && (
                          <span
                            style={{
                              color: '#fde047',
                              fontSize: 12,
                              lineHeight: 1,
                            }}
                            title="Atacante (Referência 0,0)"
                          >
                            🛡
                          </span>
                        )}
                        {!isAttacker && isOrigin && (
                          <span
                            style={{ color: '#4ade80', fontSize: 10 }}
                            title="Origem da Área"
                          >
                            ⊕
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className={editorStyles.legend}>
                <span>🛡 Centro (0,0) = Atacante</span>
                <span>⊕ Borda Verde = Origem ({origin.x},{origin.y})</span>
                <span>
                  Quadrados ativos: <strong>{displayedBoardMap.totalCells}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={closeAttackEditorModal}
          >
            Cancelar
          </button>
          <button type="submit" className={styles.btnPrimary}>
            Salvar Formato de Ataque
          </button>
        </div>
      </form>
    </div>
  );
};
