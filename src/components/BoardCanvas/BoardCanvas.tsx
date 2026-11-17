import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Moon, X } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import {
  canPlaceCharacter,
  cellKey,
  directionToCanvasAngle,
  DIRECTION_SHORT,
  getCharacterAtCell,
  getTerrainAt,
  getVisualCenter,
  GridPoint,
  gridDistance,
  isWithinBoard,
  minDistanceFromCharacterToPoint,
  vectorToDirection,
} from '../../engine/geometry';
import { calculateReachableCells } from '../../engine/movement';
import { hasCreatureToCellLoS, traceBresenhamLine } from '../../engine/los';
import { projectAttackOnBoard } from '../../engine/rotation';
import {
  alcanceVisaoDaUnidade,
  calcularVisaoDaUnidade,
  nevoaAtiva,
} from '../../engine/vision';
import {
  getCachedImageElement,
  onImageCacheUpdated,
} from '../../utils/imageProcessor';
import { Direction, ImpactZone, TerrainType } from '../../types';
import { MapStair } from '../../maps/mapTypes';
import { escadaSobUnidade, simboloDirecao } from '../../maps/mapEngine';
import styles from './BoardCanvas.module.css';

const CELL_SIZE = 56;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4.0;

interface Camera {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export const BoardCanvas: React.FC = () => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const appState = useGameStore((s) => s.appState);
  const selectedCharacterId = useGameStore((s) => s.selectedCharacterId);
  const activeTool = useGameStore((s) => s.activeTool);
  const movementModeCharacterId = useGameStore((s) => s.movementModeCharacterId);
  const attackTargeting = useGameStore((s) => s.attackTargeting);
  const showZoneLegend = useGameStore((s) => s.showZoneLegend);
  const mapCatalog = useGameStore((s) => s.mapCatalog);
  const activeMapId = useGameStore((s) => s.activeMapId);
  const switchMap = useGameStore((s) => s.switchMap);
  const cameraResetNonce = useGameStore((s) => s.cameraResetNonce);
  const zoomStepRequest = useGameStore((s) => s.zoomStepRequest);

  const setSelectedCharacter = useGameStore((s) => s.setSelectedCharacter);
  const enterMovementMode = useGameStore((s) => s.enterMovementMode);
  const cancelActiveModes = useGameStore((s) => s.cancelActiveModes);
  const moveCharacter = useGameStore((s) => s.moveCharacter);
  const placeCharacter = useGameStore((s) => s.placeCharacter);
  const rotateCharacter = useGameStore((s) => s.rotateCharacter);
  const applyTerrainChanges = useGameStore((s) => s.applyTerrainChanges);
  const updateAttackDirection = useGameStore((s) => s.updateAttackDirection);
  const updateAttackOrigin = useGameStore((s) => s.updateAttackOrigin);
  const toggleAttackCellOverride = useGameStore((s) => s.toggleAttackCellOverride);
  const confirmAttackResolution = useGameStore((s) => s.confirmAttackResolution);
  const clearLastResolvedAttack = useGameStore((s) => s.clearLastResolvedAttack);
  const setShowZoneLegend = useGameStore((s) => s.setShowZoneLegend);
  const setCameraZoomPercent = useGameStore((s) => s.setCameraZoomPercent);

  const cameraRef = useRef<Camera>({ offsetX: 80, offsetY: 60, zoom: 1 });
  const rafPendingRef = useRef<boolean>(false);

  const [hoveredCell, setHoveredCell] = useState<GridPoint | null>(null);
  const [isPanningUi, setIsPanningUi] = useState(false);

  // Refs mutáveis de interação para renderização Canvas imediata sem re-renders desnecessários
  const hoverCellRef = useRef<GridPoint | null>(null);
  const hoverWorldRef = useRef<{ wx: number; wy: number } | null>(null);
  const lastClickRef = useRef<{ charId: string; time: number } | null>(null);

  const interactionRef = useRef<{
    mode:
      | 'idle'
      | 'panning'
      | 'pending_char_action'
      | 'dragging_char'
      | 'dragging_facing'
      | 'painting_terrain'
      | 'measuring_los'
      | 'aiming_attack'
      | 'external_drag';
    startClientX: number;
    startClientY: number;
    panStartOffsetX: number;
    panStartOffsetY: number;
    targetCharId: string | null;
    dragGrabOffset: { dx: number; dy: number };
    dragCandidatePos: GridPoint | null;
    previewFacing: Direction | null;
    terrainDraft: Record<string, TerrainType>;
    rulerStart: GridPoint | null;
    externalDragCharId: string | null;
  }>({
    mode: 'idle',
    startClientX: 0,
    startClientY: 0,
    panStartOffsetX: 0,
    panStartOffsetY: 0,
    targetCharId: null,
    dragGrabOffset: { dx: 0, dy: 0 },
    dragCandidatePos: null,
    previewFacing: null,
    terrainDraft: {},
    rulerStart: null,
    externalDragCharId: null,
  });

  // Pré-cálculo dos quadrados alcançáveis quando em modo de movimentação (Parte 6)
  const reachableMap = useMemo(() => {
    if (!movementModeCharacterId) return null;
    const ch = appState.characters[movementModeCharacterId];
    if (!ch || !ch.position) return null;
    return calculateReachableCells(
      appState.board,
      appState.characters,
      ch,
      appState.settings.diagonalRule
    );
  }, [
    movementModeCharacterId,
    appState.board,
    appState.characters,
    appState.settings.diagonalRule,
  ]);

  // Pré-cálculo da área de ataque projetada quando mirando um ataque (Partes 10–13)
  const projectedAttack = useMemo(() => {
    if (!attackTargeting) return null;
    const attacker = appState.characters[attackTargeting.attackerId];
    const attack = appState.attacks[attackTargeting.attackId];
    if (!attacker || !attacker.position || !attack) return null;

    const cells = projectAttackOnBoard(
      attack.area,
      attackTargeting.targetOrigin,
      attackTargeting.direction,
      appState.board,
      attackTargeting.manualOverrides
    );
    const hasLoS = hasCreatureToCellLoS(
      appState.board,
      attacker,
      attackTargeting.targetOrigin
    );
    const dist = minDistanceFromCharacterToPoint(
      attacker,
      attackTargeting.targetOrigin,
      appState.settings.diagonalRule
    );
    return {
      attacker,
      attack,
      cells,
      hasLoS,
      dist,
      inRange: dist <= attack.range,
    };
  }, [
    attackTargeting,
    appState.characters,
    appState.attacks,
    appState.board,
    appState.settings.diagonalRule,
  ]);

  // Converte coordenadas de tela (relativas ao elemento Canvas) para coordenadas do mundo e do grid
  const screenToWorld = useCallback((sx: number, sy: number) => {
    const cam = cameraRef.current;
    const wx = (sx - cam.offsetX) / cam.zoom;
    const wy = (sy - cam.offsetY) / cam.zoom;
    return {
      wx,
      wy,
      gx: Math.floor(wx / CELL_SIZE),
      gy: Math.floor(wy / CELL_SIZE),
    };
  }, []);

  // Verifica se o ponteiro está sobre a seta de orientação de algum personagem posicionado
  const hitTestFacingHandle = useCallback(
    (wx: number, wy: number): string | null => {
      // Prioriza personagem selecionado primeiro
      const ordered = Object.values(appState.characters).sort((a, b) =>
        a.id === selectedCharacterId ? -1 : b.id === selectedCharacterId ? 1 : 0
      );
      for (const ch of ordered) {
        if (!ch.position) continue;
        const { cx, cy } = getVisualCenter(ch.position, ch.width, ch.height);
        const centerPxX = cx * CELL_SIZE;
        const centerPxY = cy * CELL_SIZE;
        const tokenRadius = Math.min(ch.width, ch.height) * CELL_SIZE * 0.41;
        const angle = directionToCanvasAngle(ch.facing);
        const arrowDist = tokenRadius + 7;
        const handleX = centerPxX + Math.cos(angle) * arrowDist;
        const handleY = centerPxY + Math.sin(angle) * arrowDist;
        const hitRadius = Math.max(11, 13 / cameraRef.current.zoom);
        if (Math.hypot(wx - handleX, wy - handleY) <= hitRadius) {
          return ch.id;
        }
      }
      return null;
    },
    [appState.characters, selectedCharacterId]
  );

  // === Névoa de Visão (Exploração) ===
  // Só calcula a área visível a partir da unidade selecionada; não altera
  // posições, terrenos ou dados das unidades — é apenas camada visual.
  const fogEnabled = nevoaAtiva(appState.settings);
  const fogRangeMode = appState.settings.fogRangeMode ?? 'global';
  const fogGlobalRange = appState.settings.fogGlobalRange ?? 8;
  const fogIntensity = Math.max(
    0.35,
    Math.min(1, appState.settings.fogIntensity ?? 1)
  );

  const visionReference = useMemo(() => {
    const selected = selectedCharacterId
      ? appState.characters[selectedCharacterId]
      : undefined;
    if (selected?.position) return selected;
    // Sem unidade selecionada posicionada: usa a primeira unidade no tabuleiro
    return (
      Object.values(appState.characters).find((c) => c.position) ?? null
    );
  }, [selectedCharacterId, appState.characters]);

  const vision = useMemo(() => {
    if (!fogEnabled || !visionReference) return null;
    const range = alcanceVisaoDaUnidade(
      visionReference,
      fogRangeMode,
      fogGlobalRange
    );
    return calcularVisaoDaUnidade(
      appState.board,
      visionReference,
      range,
      appState.settings.diagonalRule
    );
  }, [
    fogEnabled,
    visionReference,
    fogRangeMode,
    fogGlobalRange,
    appState.board,
    appState.settings.diagonalRule,
  ]);

  // === Escadas do mapa ativo (definidas em Glossário → Locais → Mapas) ===
  const mapaAtivo = activeMapId ? mapCatalog.maps[activeMapId] ?? null : null;

  const activeMapStairs = useMemo<MapStair[]>(() => {
    const mapa = mapaAtivo;
    if (!mapa) return [];
    return mapa.stairs.filter(
      (st) =>
        st.x >= 0 &&
        st.y >= 0 &&
        st.x < appState.board.width &&
        st.y < appState.board.height
    );
  }, [mapaAtivo, appState.board.width, appState.board.height]);

  const escadaDaUnidade = useMemo(() => {
    const unidade = selectedCharacterId
      ? appState.characters[selectedCharacterId]
      : undefined;
    if (!unidade || !unidade.position || !mapaAtivo) return null;
    return escadaSobUnidade(mapaAtivo, unidade);
  }, [selectedCharacterId, appState.characters, mapaAtivo]);

  // === Renderização Sob Demanda (Dirty Flag — Parte 3.4) ===
  const drawRef = useRef<() => void>(() => {});

  const requestRedraw = useCallback(() => {
    if (rafPendingRef.current) return;
    rafPendingRef.current = true;
    requestAnimationFrame(() => {
      rafPendingRef.current = false;
      drawRef.current();
    });
  }, []);

  drawRef.current = () => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = wrapper.getBoundingClientRect();
    const targetW = Math.max(1, Math.floor(rect.width * dpr));
    const targetH = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cam = cameraRef.current;
    const { board, characters, combat, settings } = appState;
    const boardPixelW = board.width * CELL_SIZE;
    const boardPixelH = board.height * CELL_SIZE;
    const inter = interactionRef.current;
    const hCell = hoverCellRef.current;
    const stairList = activeMapStairs;

    // Limpa tela em coordenadas de dispositivo
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Aplica matriz de transformação da câmera (Parte 3.3: ctx.setTransform())
    ctx.setTransform(
      dpr * cam.zoom,
      0,
      0,
      dpr * cam.zoom,
      dpr * cam.offsetX,
      dpr * cam.offsetY
    );

    // =========================================================================
    // CAMADA 1: Fundo do tabuleiro (cor e moldura de pedra/terra escura)
    // =========================================================================
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.78)';
    ctx.shadowBlur = 28;
    ctx.fillStyle = '#15120f';
    ctx.fillRect(-8, -8, boardPixelW + 16, boardPixelH + 16);
    ctx.restore();

    ctx.strokeStyle = 'rgba(196, 137, 26, 0.45)';
    ctx.lineWidth = 2 / cam.zoom;
    ctx.strokeRect(-8, -8, boardPixelW + 16, boardPixelH + 16);

    // Tabuleiro xadrez sutil entre quadrados pares e ímpares (tons Terra/Metal)
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#181512' : '#1d1915';
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    // =========================================================================
    // CAMADA 2: Terrenos (cores e padrões por quadrado — Parte 7)
    // =========================================================================
    const mergedTerrain: Record<string, TerrainType> =
      inter.mode === 'painting_terrain'
        ? { ...board.terrain, ...inter.terrainDraft }
        : board.terrain;

    for (const [k, type] of Object.entries(mergedTerrain)) {
      if (type === 'normal') continue;
      const [xs, ys] = k.split(',');
      const x = Number(xs);
      const y = Number(ys);
      if (x < 0 || y < 0 || x >= board.width || y >= board.height) continue;

      const px = x * CELL_SIZE;
      const py = y * CELL_SIZE;

      if (type === 'impassable') {
        // Bloco sólido de rocha/muralha que bloqueia passagem e visão
        ctx.fillStyle = '#302922';
        ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

        ctx.fillStyle = '#231e19';
        ctx.fillRect(px + 4, py + 4, CELL_SIZE - 8, CELL_SIZE - 8);

        // Hachura diagonal de cantaria
        ctx.strokeStyle = 'rgba(212, 196, 165, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px + 8, py + CELL_SIZE - 8);
        ctx.lineTo(px + CELL_SIZE - 8, py + 8);
        ctx.moveTo(px + 8, py + 24);
        ctx.lineTo(px + 24, py + 8);
        ctx.moveTo(px + 32, py + CELL_SIZE - 8);
        ctx.lineTo(px + CELL_SIZE - 8, py + 32);
        ctx.stroke();

        ctx.strokeStyle = '#6e5f4c';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1.5, py + 1.5, CELL_SIZE - 3, CELL_SIZE - 3);
      } else if (type === 'difficult') {
        // Terreno difícil (custo 2): tom terroso e padrão pontilhado/escombros
        ctx.fillStyle = 'rgba(180, 120, 50, 0.22)';
        ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

        ctx.strokeStyle = 'rgba(217, 155, 67, 0.42)';
        ctx.lineWidth = 1.25;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(px + 3, py + 3, CELL_SIZE - 6, CELL_SIZE - 6);
        ctx.setLineDash([]);

        // Pequenos fragmentos de terreno difícil
        ctx.fillStyle = 'rgba(217, 155, 67, 0.5)';
        const dots = [
          [14, 16],
          [38, 18],
          [24, 30],
          [16, 42],
          [40, 40],
        ];
        for (const [dx, dy] of dots) {
          ctx.beginPath();
          ctx.arc(px + dx, py + dy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // =========================================================================
    // CAMADA 3: Linhas do Grid e Coordenadas de Referência
    // =========================================================================
    if (settings.showGrid) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 1 / cam.zoom;
      ctx.beginPath();
      for (let x = 0; x <= board.width; x++) {
        ctx.moveTo(x * CELL_SIZE, 0);
        ctx.lineTo(x * CELL_SIZE, boardPixelH);
      }
      for (let y = 0; y <= board.height; y++) {
        ctx.moveTo(0, y * CELL_SIZE);
        ctx.lineTo(boardPixelW, y * CELL_SIZE);
      }
      ctx.stroke();
    }

    if (settings.showCoordinates && cam.zoom >= 0.45) {
      ctx.fillStyle = 'rgba(154, 166, 188, 0.65)';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let x = 0; x < board.width; x++) {
        ctx.fillText(String(x), x * CELL_SIZE + CELL_SIZE / 2, -18);
      }
      for (let y = 0; y < board.height; y++) {
        ctx.fillText(String(y), -20, y * CELL_SIZE + CELL_SIZE / 2);
      }
    }

    // =========================================================================
    // CAMADA 3.5: Escadas entre mapas (Glossário → Locais → Mapas)
    // =========================================================================
    // Puramente visual: desenha a marca da escada no quadrado, com seta de
    // subida (▲) ou descida (▼) e um anel dourado quando está ligada.
    if (stairList.length > 0) {
      ctx.save();
      ctx.setLineDash([]);
      for (const st of stairList) {
        const px = st.x * CELL_SIZE;
        const py = st.y * CELL_SIZE;
        const ligada = Boolean(st.targetMapId);

        // Base: degraus
        ctx.fillStyle = ligada
          ? 'rgba(122, 80, 18, 0.42)'
          : 'rgba(82, 74, 62, 0.35)';
        ctx.fillRect(px + 3, py + 3, CELL_SIZE - 6, CELL_SIZE - 6);

        // Degraus (linhas horizontais)
        ctx.strokeStyle = ligada
          ? 'rgba(234, 197, 122, 0.55)'
          : 'rgba(170, 160, 145, 0.4)';
        ctx.lineWidth = 1.4;
        for (let i = 1; i <= 3; i++) {
          const yy = py + (CELL_SIZE / 4) * i;
          ctx.beginPath();
          ctx.moveTo(px + CELL_SIZE * 0.22, yy);
          ctx.lineTo(px + CELL_SIZE * 0.78, yy);
          ctx.stroke();
        }

        // Moldura
        ctx.strokeStyle = ligada
          ? 'rgba(234, 197, 122, 0.85)'
          : 'rgba(160, 148, 130, 0.6)';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(px + 3, py + 3, CELL_SIZE - 6, CELL_SIZE - 6);

        // Seta de direção
        ctx.fillStyle = st.direction === 'up' ? '#86efac' : '#fca5a5';
        ctx.font = `700 ${Math.round(CELL_SIZE * 0.3)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          simboloDirecao(st.direction),
          px + CELL_SIZE / 2,
          py + CELL_SIZE / 2 + 1
        );
      }
      ctx.restore();
    }

    // =========================================================================
    // CAMADA 4: Áreas de Ataque (vermelho, laranja, amarelo com transparência)
    // =========================================================================
    // 4A — Último ataque já resolvido: continua visível no grid (tracejado e
    // mais translúcido para se distinguir da mira ativa) até outro ataque
    // ser confirmado, por qualquer personagem.
    const lastAttack = appState.lastAttack ?? null;
    if (lastAttack && lastAttack.cells.length > 0) {
      const aimingNewAttack = Boolean(attackTargeting);
      const ghostFills: Record<ImpactZone, string> = aimingNewAttack
        ? {
            red: 'rgba(239, 68, 68, 0.20)',
            orange: 'rgba(249, 115, 22, 0.18)',
            yellow: 'rgba(234, 179, 8, 0.15)',
          }
        : {
            red: 'rgba(239, 68, 68, 0.34)',
            orange: 'rgba(249, 115, 22, 0.31)',
            yellow: 'rgba(234, 179, 8, 0.27)',
          };
      const ghostBorders: Record<ImpactZone, string> = aimingNewAttack
        ? {
            red: 'rgba(252, 165, 165, 0.45)',
            orange: 'rgba(253, 186, 116, 0.42)',
            yellow: 'rgba(253, 224, 71, 0.42)',
          }
        : {
            red: 'rgba(252, 165, 165, 0.75)',
            orange: 'rgba(253, 186, 116, 0.72)',
            yellow: 'rgba(253, 224, 71, 0.72)',
          };

      ctx.save();
      for (const c of lastAttack.cells) {
        if (!isWithinBoard(board, c.x, c.y)) continue;
        const px = c.x * CELL_SIZE;
        const py = c.y * CELL_SIZE;
        ctx.fillStyle = ghostFills[c.zone];
        ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        ctx.strokeStyle = ghostBorders[c.zone];
        ctx.lineWidth = 1.8;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(px + 2.5, py + 2.5, CELL_SIZE - 5, CELL_SIZE - 5);
        ctx.setLineDash([]);
      }

      // Linha ténue da posição original do atacante até à origem da área
      if (lastAttack.attackerPosition) {
        const ac = getVisualCenter(
          lastAttack.attackerPosition,
          lastAttack.attackerWidth || 1,
          lastAttack.attackerHeight || 1
        );
        const ox = (lastAttack.targetOrigin.x + 0.5) * CELL_SIZE;
        const oy = (lastAttack.targetOrigin.y + 0.5) * CELL_SIZE;
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = aimingNewAttack
          ? 'rgba(230, 198, 124, 0.22)'
          : 'rgba(230, 198, 124, 0.38)';
        ctx.beginPath();
        ctx.moveTo(ac.cx * CELL_SIZE, ac.cy * CELL_SIZE);
        ctx.lineTo(ox, oy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Marcador da origem (losango) do último ataque
        ctx.beginPath();
        ctx.moveTo(ox, oy - 7);
        ctx.lineTo(ox + 7, oy);
        ctx.lineTo(ox, oy + 7);
        ctx.lineTo(ox - 7, oy);
        ctx.closePath();
        ctx.fillStyle = aimingNewAttack ? 'rgba(250, 204, 21, 0.55)' : '#facc15';
        ctx.fill();
        ctx.strokeStyle = '#0a0d12';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4B — Mira ativa (por cima do último ataque, com contorno sólido)
    if (projectedAttack && attackTargeting) {
      const { attacker, attack, cells, hasLoS } = projectedAttack;

      // Destaque discreto do alcance máximo ao redor do atacante
      if (attacker.position && attack.range > 0) {
        ctx.fillStyle = 'rgba(201, 166, 92, 0.05)';
        ctx.strokeStyle = 'rgba(201, 166, 92, 0.25)';
        ctx.lineWidth = 1 / cam.zoom;
        for (let y = 0; y < board.height; y++) {
          for (let x = 0; x < board.width; x++) {
            const d = minDistanceFromCharacterToPoint(
              attacker,
              { x, y },
              settings.diagonalRule
            );
            if (d <= attack.range) {
              ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
          }
        }
      }

      // Pintura das zonas de impacto: red, orange, yellow
      const zoneFills: Record<ImpactZone, string> = {
        red: 'rgba(239, 68, 68, 0.46)',
        orange: 'rgba(249, 115, 22, 0.42)',
        yellow: 'rgba(234, 179, 8, 0.36)',
      };
      const zoneBorders: Record<ImpactZone, string> = {
        red: 'rgba(252, 165, 165, 0.9)',
        orange: 'rgba(253, 186, 116, 0.85)',
        yellow: 'rgba(253, 224, 71, 0.85)',
      };

      for (const c of cells) {
        const px = c.x * CELL_SIZE;
        const py = c.y * CELL_SIZE;
        ctx.fillStyle = zoneFills[c.zone];
        ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);

        ctx.strokeStyle = zoneBorders[c.zone];
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      }

      // Linha de LoS do centro do atacante até a origem da área
      if (attacker.position && settings.checkLoSOnAttacks) {
        const { cx, cy } = getVisualCenter(
          attacker.position,
          attacker.width,
          attacker.height
        );
        const ox = (attackTargeting.targetOrigin.x + 0.5) * CELL_SIZE;
        const oy = (attackTargeting.targetOrigin.y + 0.5) * CELL_SIZE;

        ctx.save();
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = hasLoS
          ? 'rgba(74, 222, 128, 0.78)'
          : 'rgba(248, 113, 113, 0.9)';
        ctx.beginPath();
        ctx.moveTo(cx * CELL_SIZE, cy * CELL_SIZE);
        ctx.lineTo(ox, oy);
        ctx.stroke();
        ctx.restore();

        // Marcador de origem da área
        ctx.beginPath();
        ctx.arc(ox, oy, 6, 0, Math.PI * 2);
        ctx.fillStyle = hasLoS ? '#4ade80' : '#ef4444';
        ctx.fill();
      }
    }

    // =========================================================================
    // CAMADA 5: Áreas de Movimento (destaque visual + custo por quadrado)
    // =========================================================================
    if (reachableMap && movementModeCharacterId) {
      const movingChar = characters[movementModeCharacterId];
      for (const cell of reachableMap.values()) {
        const px = cell.x * CELL_SIZE;
        const py = cell.y * CELL_SIZE;

        ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.lineWidth = 1.25;
        ctx.strokeRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);

        // Exibe custo de movimento no quadrado alcançável (Parte 6.4)
        if (cam.zoom >= 0.5) {
          ctx.fillStyle = 'rgba(12, 18, 28, 0.78)';
          ctx.beginPath();
          ctx.roundRect(px + CELL_SIZE - 21, py + CELL_SIZE - 19, 17, 15, 3);
          ctx.fill();

          ctx.fillStyle = '#bae6fd';
          ctx.font = '700 10.5px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(cell.cost), px + CELL_SIZE - 12.5, py + CELL_SIZE - 11);
        }
      }

      // Trilha do caminho ao passar o mouse sobre um destino válido
      if (movingChar && hCell) {
        const hoveredReach = reachableMap.get(cellKey(hCell.x, hCell.y));
        if (hoveredReach && hoveredReach.path.length > 1) {
          // Contorno da pegada completa (width × height) no destino
          ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.fillRect(
            hCell.x * CELL_SIZE,
            hCell.y * CELL_SIZE,
            movingChar.width * CELL_SIZE,
            movingChar.height * CELL_SIZE
          );
          ctx.strokeRect(
            hCell.x * CELL_SIZE + 1,
            hCell.y * CELL_SIZE + 1,
            movingChar.width * CELL_SIZE - 2,
            movingChar.height * CELL_SIZE - 2
          );

          ctx.save();
          ctx.strokeStyle = '#7dd3fc';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          hoveredReach.path.forEach((pt, idx) => {
            const cx = (pt.x + movingChar.width / 2) * CELL_SIZE;
            const cy = (pt.y + movingChar.height / 2) * CELL_SIZE;
            if (idx === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
          });
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // =========================================================================
    // CAMADA 6: Personagens (imagens circulares + seta de direção em 8 direções)
    // =========================================================================
    for (const ch of Object.values(characters)) {
      if (!ch.position) continue;

      const isBeingDragged =
        inter.mode === 'dragging_char' && inter.targetCharId === ch.id;
      const pos = ch.position;
      const areaX = pos.x * CELL_SIZE;
      const areaY = pos.y * CELL_SIZE;
      const areaW = ch.width * CELL_SIZE;
      const areaH = ch.height * CELL_SIZE;

      ctx.save();
      if (isBeingDragged) {
        ctx.globalAlpha = 0.42;
      }

      // Base retangular sutil para criaturas grandes (2×2, 3×3, 4×4...)
      if (ch.width > 1 || ch.height > 1) {
        ctx.fillStyle = 'rgba(201, 166, 92, 0.08)';
        ctx.fillRect(areaX + 2, areaY + 2, areaW - 4, areaH - 4);
        ctx.strokeStyle = 'rgba(201, 166, 92, 0.32)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(areaX + 3, areaY + 3, areaW - 6, areaH - 6);
      }

      const { cx, cy } = getVisualCenter(pos, ch.width, ch.height);
      const centerPxX = cx * CELL_SIZE;
      const centerPxY = cy * CELL_SIZE;
      const radius = Math.min(ch.width, ch.height) * CELL_SIZE * 0.41;

      // Halo de personagem ativo no modo de turnos
      if (combat.mode === 'turns' && combat.activeCharacterId === ch.id) {
        ctx.beginPath();
        ctx.arc(centerPxX, centerPxY, radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Sombra sob o token circular
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      ctx.beginPath();
      ctx.arc(centerPxX, centerPxY, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#1b2232';
      ctx.fill();
      ctx.restore();

      // Imagem circular recortada (carregada do cache de Blob)
      const imgEl = getCachedImageElement(ch.imageId);
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerPxX, centerPxY, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      if (imgEl) {
        ctx.drawImage(
          imgEl,
          centerPxX - radius,
          centerPxY - radius,
          radius * 2,
          radius * 2
        );
      } else {
        ctx.fillStyle = '#253047';
        ctx.fillRect(
          centerPxX - radius,
          centerPxY - radius,
          radius * 2,
          radius * 2
        );
        ctx.fillStyle = '#e6c67c';
        ctx.font = `700 ${Math.round(radius * 0.65)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initials = ch.name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
        ctx.fillText(initials, centerPxX, centerPxY);
      }

      // Indicador visual caso HP chegue a 0
      if (ch.hpCurrent <= 0) {
        ctx.fillStyle = 'rgba(127, 29, 29, 0.62)';
        ctx.fillRect(
          centerPxX - radius,
          centerPxY - radius,
          radius * 2,
          radius * 2
        );
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(centerPxX - radius * 0.42, centerPxY - radius * 0.42);
        ctx.lineTo(centerPxX + radius * 0.42, centerPxY + radius * 0.42);
        ctx.moveTo(centerPxX + radius * 0.42, centerPxY - radius * 0.42);
        ctx.lineTo(centerPxX - radius * 0.42, centerPxY + radius * 0.42);
        ctx.stroke();
      }
      ctx.restore();

      // Anel metálico do token
      ctx.beginPath();
      ctx.arc(centerPxX, centerPxY, radius, 0, Math.PI * 2);
      ctx.strokeStyle =
        selectedCharacterId === ch.id ? '#facc15' : 'rgba(201, 166, 92, 0.8)';
      ctx.lineWidth = selectedCharacterId === ch.id ? 2.8 : 2;
      ctx.stroke();

      // Seta de orientação em 8 direções (Parte 4.4)
      const effectiveFacing =
        inter.mode === 'dragging_facing' &&
        inter.targetCharId === ch.id &&
        inter.previewFacing !== null
          ? inter.previewFacing
          : ch.facing;

      const angle = directionToCanvasAngle(effectiveFacing);
      const tipDist = radius + 12;
      const baseDist = radius + 2;
      const wingAngle = 0.24;

      const tipX = centerPxX + Math.cos(angle) * tipDist;
      const tipY = centerPxY + Math.sin(angle) * tipDist;
      const leftX = centerPxX + Math.cos(angle - wingAngle) * baseDist;
      const leftY = centerPxY + Math.sin(angle - wingAngle) * baseDist;
      const rightX = centerPxX + Math.cos(angle + wingAngle) * baseDist;
      const rightY = centerPxY + Math.sin(angle + wingAngle) * baseDist;

      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(leftX, leftY);
      ctx.lineTo(rightX, rightY);
      ctx.closePath();
      ctx.fillStyle =
        selectedCharacterId === ch.id ? '#fde047' : '#e0be75';
      ctx.fill();
      ctx.strokeStyle = '#0a0d12';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.restore();
    }

    // =========================================================================
    // CAMADA 7: Overlays de Hover (barra de vida APENAS no hover — Parte 4.3, e Régua LoS)
    // =========================================================================
    if (hCell && inter.mode === 'idle') {
      const hoveredChar = getCharacterAtCell(characters, hCell.x, hCell.y);
      if (hoveredChar && hoveredChar.position) {
        const { cx } = getVisualCenter(
          hoveredChar.position,
          hoveredChar.width,
          hoveredChar.height
        );
        const topPxY = hoveredChar.position.y * CELL_SIZE;
        const centerPxX = cx * CELL_SIZE;

        const boxW = Math.max(126, hoveredChar.name.length * 6.8 + 24);
        const boxH = 42;
        const bx = centerPxX - boxW / 2;
        const by = topPxY - boxH - 10;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.65)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = 'rgba(14, 19, 28, 0.95)';
        ctx.strokeStyle = 'rgba(201, 166, 92, 0.65)';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 6);
        ctx.fill();
        ctx.stroke();

        // Nome do personagem
        ctx.fillStyle = '#f1f5f9';
        ctx.font = '600 11.5px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const dimSuffix =
          hoveredChar.width > 1 || hoveredChar.height > 1
            ? ` (${hoveredChar.width}×${hoveredChar.height})`
            : '';
        ctx.fillText(
          `${hoveredChar.name}${dimSuffix}`,
          centerPxX,
          by + 5
        );

        // Barra visual proporcional de vida + texto "75 / 100 HP"
        const barX = bx + 9;
        const barY = by + 22;
        const barW = boxW - 18;
        const barH = 13;
        const ratio =
          hoveredChar.hpMax > 0
            ? Math.max(0, Math.min(1, hoveredChar.hpCurrent / hoveredChar.hpMax))
            : 0;

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 4);
        ctx.fill();

        const barColor =
          ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#f59e0b' : '#ef4444';
        if (ratio > 0) {
          ctx.fillStyle = barColor;
          ctx.beginPath();
          ctx.roundRect(barX, barY, barW * ratio, barH, 4);
          ctx.fill();
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          `${hoveredChar.hpCurrent} / ${hoveredChar.hpMax} HP`,
          centerPxX,
          barY + barH / 2 + 0.5
        );
        ctx.restore();
      }
    }

    // Ferramenta Régua / Medidor de Linha de Visão (LoS)
    if (
      activeTool === 'los_ruler' &&
      inter.mode === 'measuring_los' &&
      inter.rulerStart &&
      hCell &&
      isWithinBoard(board, hCell.x, hCell.y)
    ) {
      const trace = traceBresenhamLine(board, inter.rulerStart, hCell);
      for (const c of trace.cells) {
        ctx.fillStyle = trace.clear
          ? 'rgba(74, 222, 128, 0.18)'
          : 'rgba(248, 113, 113, 0.18)';
        ctx.fillRect(c.x * CELL_SIZE, c.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }

      const sx = (inter.rulerStart.x + 0.5) * CELL_SIZE;
      const sy = (inter.rulerStart.y + 0.5) * CELL_SIZE;
      const ex = (hCell.x + 0.5) * CELL_SIZE;
      const ey = (hCell.y + 0.5) * CELL_SIZE;

      ctx.save();
      ctx.strokeStyle = trace.clear ? '#4ade80' : '#f87171';
      ctx.lineWidth = 2.8;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.restore();

      const dist = gridDistance(inter.rulerStart, hCell, settings.diagonalRule);
      const label = `${dist} quad. • ${trace.clear ? 'LoS Livre' : 'LoS Bloqueada'}`;
      ctx.save();
      ctx.fillStyle = 'rgba(14, 19, 28, 0.94)';
      ctx.strokeStyle = trace.clear ? '#4ade80' : '#f87171';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(ex - 72, ey - 36, 144, 24, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, ex, ey - 24);
      ctx.restore();
    }

    // =========================================================================
    // CAMADA 8: Indicadores de Seleção, Fantasma de Arrasto e Cursores
    // =========================================================================
    if (selectedCharacterId && characters[selectedCharacterId]?.position) {
      const sel = characters[selectedCharacterId];
      const pos = sel.position!;
      const sx = pos.x * CELL_SIZE;
      const sy = pos.y * CELL_SIZE;
      const sw = sel.width * CELL_SIZE;
      const sh = sel.height * CELL_SIZE;

      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.2;
      ctx.strokeRect(sx + 1.5, sy + 1.5, sw - 3, sh - 3);

      // Cantoneiras táticas douradas
      const corner = 10;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      // Sup-Esq
      ctx.moveTo(sx, sy + corner);
      ctx.lineTo(sx, sy);
      ctx.lineTo(sx + corner, sy);
      // Sup-Dir
      ctx.moveTo(sx + sw - corner, sy);
      ctx.lineTo(sx + sw, sy);
      ctx.lineTo(sx + sw, sy + corner);
      // Inf-Dir
      ctx.moveTo(sx + sw, sy + sh - corner);
      ctx.lineTo(sx + sw, sy + sh);
      ctx.lineTo(sx + sw - corner, sy + sh);
      // Inf-Esq
      ctx.moveTo(sx + corner, sy + sh);
      ctx.lineTo(sx, sy + sh);
      ctx.lineTo(sx, sy + sh - corner);
      ctx.stroke();
    }

    // Fantasma de arrasto de personagem (interno ao Canvas ou vindo da lista lateral)
    const activeDragCharId =
      inter.mode === 'dragging_char'
        ? inter.targetCharId
        : inter.mode === 'external_drag'
        ? inter.externalDragCharId
        : null;

    if (activeDragCharId && inter.dragCandidatePos) {
      const dragChar = characters[activeDragCharId];
      if (dragChar) {
        const cand = inter.dragCandidatePos;
        const valid = canPlaceCharacter(
          board,
          characters,
          cand,
          dragChar.width,
          dragChar.height,
          dragChar.id
        );
        const gx = cand.x * CELL_SIZE;
        const gy = cand.y * CELL_SIZE;
        const gw = dragChar.width * CELL_SIZE;
        const gh = dragChar.height * CELL_SIZE;

        ctx.fillStyle = valid
          ? 'rgba(34, 197, 94, 0.26)'
          : 'rgba(239, 68, 68, 0.30)';
        ctx.strokeStyle = valid ? '#4ade80' : '#f87171';
        ctx.lineWidth = 2.5;
        ctx.fillRect(gx, gy, gw, gh);
        ctx.strokeRect(gx + 1, gy + 1, gw - 2, gh - 2);
      }
    }

    // Cursor de célula ativa
    if (
      hCell &&
      isWithinBoard(board, hCell.x, hCell.y) &&
      inter.mode !== 'dragging_char' &&
      inter.mode !== 'external_drag'
    ) {
      ctx.strokeStyle =
        activeTool.startsWith('terrain_')
          ? 'rgba(250, 204, 21, 0.85)'
          : 'rgba(226, 232, 240, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        hCell.x * CELL_SIZE + 1,
        hCell.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2
      );
    }

    // =========================================================================
    // CAMADA 9: Névoa de Visão (Modo Exploração)
    // Puramente visual: escurece os quadrados fora do alcance de visão da
    // unidade de referência. Não altera dados, posições nem interações.
    // =========================================================================
    if (fogEnabled && vision) {
      const { visible, edge } = vision;
      const escuridao = `rgba(4, 6, 10, ${fogIntensity})`;
      const orla = `rgba(4, 6, 10, ${Math.max(0, fogIntensity - 0.28)})`;

      ctx.save();
      ctx.setLineDash([]);

      // Desenha em faixas horizontais contínuas para reduzir o custo
      for (let y = 0; y < board.height; y++) {
        let runStart = -1;
        let runKind: 0 | 1 | 2 = 0; // 0 = visível, 1 = orla, 2 = névoa total

        const flush = (endX: number) => {
          if (runStart < 0 || runKind === 0) return;
          ctx.fillStyle = runKind === 2 ? escuridao : orla;
          ctx.fillRect(
            runStart * CELL_SIZE,
            y * CELL_SIZE,
            (endX - runStart) * CELL_SIZE,
            CELL_SIZE
          );
        };

        for (let x = 0; x <= board.width; x++) {
          const k = x < board.width ? cellKey(x, y) : null;
          const kind: 0 | 1 | 2 =
            k === null ? 0 : visible.has(k) ? 0 : edge.has(k) ? 1 : 2;

          if (kind !== runKind) {
            flush(x);
            runStart = x;
            runKind = kind;
          }
        }
      }

      // Contorno discreto da área de visão (delimita o que se vê, sem brilho)
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(201, 166, 92, 0.16)';
      ctx.lineWidth = 1.2 / cameraRef.current.zoom;
      for (const k of visible) {
        const [xs, ys] = k.split(',');
        const x = Number(xs);
        const y = Number(ys);
        const px = x * CELL_SIZE;
        const py = y * CELL_SIZE;
        if (!visible.has(cellKey(x, y - 1))) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + CELL_SIZE, py);
          ctx.stroke();
        }
        if (!visible.has(cellKey(x, y + 1))) {
          ctx.beginPath();
          ctx.moveTo(px, py + CELL_SIZE);
          ctx.lineTo(px + CELL_SIZE, py + CELL_SIZE);
          ctx.stroke();
        }
        if (!visible.has(cellKey(x - 1, y))) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, py + CELL_SIZE);
          ctx.stroke();
        }
        if (!visible.has(cellKey(x + 1, y))) {
          ctx.beginPath();
          ctx.moveTo(px + CELL_SIZE, py);
          ctx.lineTo(px + CELL_SIZE, py + CELL_SIZE);
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  };

  // Centralizar e ajustar câmera ao tamanho do container (Parte 3.3)
  const centerCamera = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const boardPxW = appState.board.width * CELL_SIZE;
    const boardPxH = appState.board.height * CELL_SIZE;
    const pad = 72;
    const fitZoom = Math.min(
      (rect.width - pad * 2) / boardPxW,
      (rect.height - pad * 2) / boardPxH,
      1.15
    );
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom || 1));
    cameraRef.current = {
      zoom,
      offsetX: (rect.width - boardPxW * zoom) / 2,
      offsetY: (rect.height - boardPxH * zoom) / 2,
    };
    setCameraZoomPercent(zoom * 100);
    requestRedraw();
  }, [appState.board.width, appState.board.height, requestRedraw, setCameraZoomPercent]);

  // Inicializa câmera e reage ao botão Centralizar / Tecla 0
  useEffect(() => {
    centerCamera();
  }, [cameraResetNonce, centerCamera]);

  // Botões +/- de zoom na barra superior
  useEffect(() => {
    if (!zoomStepRequest || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const cam = cameraRef.current;
    const newZoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, cam.zoom * zoomStepRequest.factor)
    );
    const wx = (cx - cam.offsetX) / cam.zoom;
    const wy = (cy - cam.offsetY) / cam.zoom;
    cameraRef.current = {
      zoom: newZoom,
      offsetX: cx - wx * newZoom,
      offsetY: cy - wy * newZoom,
    };
    setCameraZoomPercent(newZoom * 100);
    requestRedraw();
  }, [zoomStepRequest, requestRedraw, setCameraZoomPercent]);

  // Redesenha quando o estado lógico muda
  useEffect(() => {
    requestRedraw();
  }, [
    appState,
    selectedCharacterId,
    activeTool,
    movementModeCharacterId,
    attackTargeting,
    reachableMap,
    projectedAttack,
    activeMapStairs,
    requestRedraw,
  ]);

  // Redesenha quando uma imagem Blob termina de decodificar
  useEffect(() => {
    return onImageCacheUpdated(() => requestRedraw());
  }, [requestRedraw]);

  // Redesenha ao redimensionar o painel/janela (ResizeObserver)
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const ro = new ResizeObserver(() => {
      requestRedraw();
    });
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [requestRedraw]);

  // Atalhos de teclado: Escape, 0 (resetar câmera), WASD (pan opcional), Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        interactionRef.current.mode = 'idle';
        cancelActiveModes();
        requestRedraw();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          useGameStore.getState().redo();
        } else {
          useGameStore.getState().undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        useGameStore.getState().redo();
        return;
      }

      if (e.key === '0' && !e.ctrlKey && !e.metaKey) {
        centerCamera();
        return;
      }

      // WASD para pan direcional da câmera (Parte 3.3)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const panStep = 44;
        const k = e.key.toLowerCase();
        if (k === 'w') {
          cameraRef.current.offsetY += panStep;
          requestRedraw();
        } else if (k === 's') {
          cameraRef.current.offsetY -= panStep;
          requestRedraw();
        } else if (k === 'a') {
          cameraRef.current.offsetX += panStep;
          requestRedraw();
        } else if (k === 'd') {
          cameraRef.current.offsetX -= panStep;
          requestRedraw();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancelActiveModes, centerCamera, requestRedraw]);

  // Zoom com scroll centrado no cursor (Parte 3.3: 0,25× a 4×)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const cam = cameraRef.current;
      const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, cam.zoom * zoomFactor)
      );

      const wx = (mx - cam.offsetX) / cam.zoom;
      const wy = (my - cam.offsetY) / cam.zoom;

      cameraRef.current = {
        zoom: newZoom,
        offsetX: mx - wx * newZoom,
        offsetY: my - wy * newZoom,
      };
      setCameraZoomPercent(newZoom * 100);
      requestRedraw();
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [requestRedraw, setCameraZoomPercent]);

  // === Handlers de Mouse no Canvas (Parte 5.1 e 5.2) ===
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { wx, wy, gx, gy } = screenToWorld(sx, sy);
    const inter = interactionRef.current;

    // Botão direito (2) ou botão do meio (1) => Pan livre da câmera
    if (e.button === 2 || e.button === 1) {
      e.preventDefault();
      inter.mode = 'panning';
      inter.startClientX = e.clientX;
      inter.startClientY = e.clientY;
      inter.panStartOffsetX = cameraRef.current.offsetX;
      inter.panStartOffsetY = cameraRef.current.offsetY;
      setIsPanningUi(true);
      return;
    }

    if (e.button !== 0) return;

    // Ferramentas de Pintura de Terreno
    if (activeTool.startsWith('terrain_')) {
      if (!isWithinBoard(appState.board, gx, gy)) return;
      const tType: TerrainType =
        activeTool === 'terrain_impassable'
          ? 'impassable'
          : activeTool === 'terrain_difficult'
          ? 'difficult'
          : 'normal';
      inter.mode = 'painting_terrain';
      inter.terrainDraft = { [cellKey(gx, gy)]: tType };
      requestRedraw();
      return;
    }

    // Ferramenta Régua / LoS
    if (activeTool === 'los_ruler') {
      if (!isWithinBoard(appState.board, gx, gy)) return;
      inter.mode = 'measuring_los';
      inter.rulerStart = { x: gx, y: gy };
      requestRedraw();
      return;
    }

    // Modo de Mira de Ataque (Parte 13)
    if (attackTargeting) {
      if (!isWithinBoard(appState.board, gx, gy)) return;
      // Alt+Clique ajusta manualmente a zona de um quadrado específico (Parte 12.2 Etapa C)
      if (e.altKey && projectedAttack) {
        const existing = projectedAttack.cells.find(
          (c) => c.x === gx && c.y === gy
        );
        const nextOrder: Array<ImpactZone | 'remove'> = [
          'red',
          'orange',
          'yellow',
          'remove',
        ];
        const nextVal = !existing
          ? 'red'
          : nextOrder[(nextOrder.indexOf(existing.zone) + 1) % nextOrder.length];
        toggleAttackCellOverride(gx, gy, nextVal);
        return;
      }

      inter.mode = 'aiming_attack';
      const attacker = appState.characters[attackTargeting.attackerId];
      if (attackTargeting.anchorToAttacker && attacker?.position) {
        const { cx, cy } = getVisualCenter(
          attacker.position,
          attacker.width,
          attacker.height
        );
        const dir = vectorToDirection(gx + 0.5 - cx, gy + 0.5 - cy);
        updateAttackDirection(dir);
      } else {
        updateAttackOrigin({ x: gx, y: gy });
      }
      return;
    }

    // Modo de Movimentação Ativo (Parte 6.4)
    if (movementModeCharacterId && reachableMap) {
      const dest = reachableMap.get(cellKey(gx, gy));
      if (dest) {
        moveCharacter(movementModeCharacterId, { x: dest.x, y: dest.y });
        return;
      }
      const clickedOther = getCharacterAtCell(appState.characters, gx, gy);
      if (clickedOther && clickedOther.id !== movementModeCharacterId) {
        setSelectedCharacter(clickedOther.id);
        return;
      }
      enterMovementMode(null);
      return;
    }

    // 2. Verifica clique em Personagem (Parte 5.2: Clique simples vs Duplo <250ms vs Arrasto >5px)
    const hitChar = getCharacterAtCell(appState.characters, gx, gy);
    if (hitChar && hitChar.position) {
      const now = performance.now();
      const prevClick = lastClickRef.current;

      // Clique simples executa imediatamente
      setSelectedCharacter(hitChar.id);

      if (prevClick && prevClick.charId === hitChar.id && now - prevClick.time < 250) {
        lastClickRef.current = null;
        inter.mode = 'idle';
        enterMovementMode(hitChar.id);
        return;
      }

      lastClickRef.current = { charId: hitChar.id, time: now };
      inter.mode = 'pending_char_action';
      inter.startClientX = e.clientX;
      inter.startClientY = e.clientY;
      inter.targetCharId = hitChar.id;
      inter.dragGrabOffset = {
        dx: gx - hitChar.position.x,
        dy: gy - hitChar.position.y,
      };
      inter.dragCandidatePos = { ...hitChar.position };
      return;
    }

    // 3. Clique em quadrado vazio => desseleciona / cancela modo atual
    cancelActiveModes();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { wx, wy, gx, gy } = screenToWorld(sx, sy);
    hoverWorldRef.current = { wx, wy };

    const prevHover = hoverCellRef.current;
    if (!prevHover || prevHover.x !== gx || prevHover.y !== gy) {
      hoverCellRef.current = { x: gx, y: gy };
      setHoveredCell(
        isWithinBoard(appState.board, gx, gy) ? { x: gx, y: gy } : null
      );
      requestRedraw();
    }

    const inter = interactionRef.current;

    if (inter.mode === 'panning') {
      cameraRef.current.offsetX =
        inter.panStartOffsetX + (e.clientX - inter.startClientX);
      cameraRef.current.offsetY =
        inter.panStartOffsetY + (e.clientY - inter.startClientY);
      requestRedraw();
      return;
    }

    if (inter.mode === 'painting_terrain') {
      if (isWithinBoard(appState.board, gx, gy)) {
        const tType: TerrainType =
          activeTool === 'terrain_impassable'
            ? 'impassable'
            : activeTool === 'terrain_difficult'
            ? 'difficult'
            : 'normal';
        const k = cellKey(gx, gy);
        if (inter.terrainDraft[k] !== tType) {
          inter.terrainDraft[k] = tType;
          requestRedraw();
        }
      }
      return;
    }

    if (inter.mode === 'aiming_attack' && attackTargeting) {
      if (!isWithinBoard(appState.board, gx, gy)) return;
      const attacker = appState.characters[attackTargeting.attackerId];
      if (attackTargeting.anchorToAttacker && attacker?.position) {
        const { cx, cy } = getVisualCenter(
          attacker.position,
          attacker.width,
          attacker.height
        );
        const dir = vectorToDirection(gx + 0.5 - cx, gy + 0.5 - cy);
        if (dir !== attackTargeting.direction) {
          updateAttackDirection(dir);
        }
      } else if (
        attackTargeting.targetOrigin.x !== gx ||
        attackTargeting.targetOrigin.y !== gy
      ) {
        updateAttackOrigin({ x: gx, y: gy });
      }
      return;
    }

    // Direção do personagem selecionado segue o mouse automaticamente (8 direções)
    if (selectedCharacterId) {
      const ch = appState.characters[selectedCharacterId];
      if (ch && ch.position) {
        const { cx, cy } = getVisualCenter(ch.position, ch.width, ch.height);
        const mouseDir = vectorToDirection(
          wx - cx * CELL_SIZE,
          wy - cy * CELL_SIZE
        );
        if (mouseDir !== ch.facing) {
          rotateCharacter(selectedCharacterId, mouseDir);
        }
      }
    }

    // Transição para modo arrastar caso mova > 5px (Parte 5.2)
    if (inter.mode === 'pending_char_action') {
      const movedPx = Math.hypot(
        e.clientX - inter.startClientX,
        e.clientY - inter.startClientY
      );
      if (movedPx > 5) {
        inter.mode = 'dragging_char';
        lastClickRef.current = null;
      }
    }

    if (inter.mode === 'dragging_char' && inter.targetCharId) {
      const candX = gx - inter.dragGrabOffset.dx;
      const candY = gy - inter.dragGrabOffset.dy;
      if (
        !inter.dragCandidatePos ||
        inter.dragCandidatePos.x !== candX ||
        inter.dragCandidatePos.y !== candY
      ) {
        inter.dragCandidatePos = { x: candX, y: candY };
        requestRedraw();
      }
    }
  };

  const finishMouseInteraction = useCallback(() => {
    const inter = interactionRef.current;

    if (inter.mode === 'panning') {
      setIsPanningUi(false);
    } else if (inter.mode === 'painting_terrain') {
      applyTerrainChanges(inter.terrainDraft);
      inter.terrainDraft = {};
    } else if (
      inter.mode === 'dragging_facing' &&
      inter.targetCharId &&
      inter.previewFacing !== null
    ) {
      rotateCharacter(inter.targetCharId, inter.previewFacing);
    } else if (
      inter.mode === 'dragging_char' &&
      inter.targetCharId &&
      inter.dragCandidatePos
    ) {
      moveCharacter(inter.targetCharId, inter.dragCandidatePos);
    }

    inter.mode = 'idle';
    inter.targetCharId = null;
    inter.previewFacing = null;
    inter.dragCandidatePos = null;
    inter.rulerStart = null;
    requestRedraw();
  }, [applyTerrainChanges, moveCharacter, requestRedraw, rotateCharacter]);

  // === Suporte a Arrastar Personagem da Lista Lateral para o Tabuleiro ===
  const handleDragOver = (e: React.DragEvent<HTMLCanvasElement>) => {
    const charId = e.dataTransfer.types.includes('application/x-rpg-character')
      ? (window as any).__draggingCharacterId
      : null;
    if (!charId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const { gx, gy } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const inter = interactionRef.current;
    inter.mode = 'external_drag';
    inter.externalDragCharId = charId;
    inter.dragCandidatePos = { x: gx, y: gy };
    requestRedraw();
  };

  const handleDragLeave = () => {
    if (interactionRef.current.mode === 'external_drag') {
      interactionRef.current.mode = 'idle';
      interactionRef.current.externalDragCharId = null;
      interactionRef.current.dragCandidatePos = null;
      requestRedraw();
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const charId =
      e.dataTransfer.getData('application/x-rpg-character') ||
      (window as any).__draggingCharacterId;
    const rect = e.currentTarget.getBoundingClientRect();
    const { gx, gy } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

    interactionRef.current.mode = 'idle';
    interactionRef.current.externalDragCharId = null;
    interactionRef.current.dragCandidatePos = null;

    if (charId) {
      placeCharacter(charId, { x: gx, y: gy });
    }
    requestRedraw();
  };

  const hoveredTerrain: TerrainType | null = hoveredCell
    ? getTerrainAt(appState.board, hoveredCell.x, hoveredCell.y)
    : null;

  const movingChar = movementModeCharacterId
    ? appState.characters[movementModeCharacterId]
    : null;

  const lastAttack = appState.lastAttack ?? null;
  const hasTopBanner = Boolean(
    movingChar || attackTargeting || activeTool !== 'select'
  );

  return (
    <div ref={wrapperRef} className={styles.canvasWrapper}>
      <canvas
        ref={canvasRef}
        className={`${styles.canvas} ${
          isPanningUi
            ? styles.cursorGrab
            : activeTool !== 'select' || attackTargeting
            ? styles.cursorCrosshair
            : ''
        }`}
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={finishMouseInteraction}
        onMouseLeave={() => {
          hoverCellRef.current = null;
          setHoveredCell(null);
          if (interactionRef.current.mode === 'panning') {
            finishMouseInteraction();
          } else {
            requestRedraw();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />

      {/* Banner Contextual de Movimentação */}
      {movingChar && (
        <div className={styles.modeBanner}>
          <span className={`${styles.modeDot} ${styles.modeMoveDot}`} />
          <span className={styles.modeText}>
            <strong>Modo de Movimento:</strong> {movingChar.name} ({movingChar.movement} quad.)
          </span>
          <span className={styles.modeHint}>
            Clique em um quadrado destacado • Esc para cancelar
          </span>
          <button
            className={styles.bannerBtn}
            onClick={() => enterMovementMode(null)}
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Banner Contextual de Mira de Ataque */}
      {attackTargeting && projectedAttack && (
        <div className={styles.modeBanner}>
          <span className={`${styles.modeDot} ${styles.modeAttackDot}`} />
          <span className={styles.modeText}>
            <strong>Mirando:</strong> {projectedAttack.attack.name} • Direção{' '}
            {DIRECTION_SHORT[attackTargeting.direction]}
          </span>
          <span className={styles.modeHint}>
            {attackTargeting.anchorToAttacker
              ? 'Clique/arraste ao redor para girar'
              : 'Clique no tabuleiro para posicionar a área'}{' '}
            • Alt+Clique edita quadrado
          </span>
          <button
            className={`${styles.bannerBtn} ${styles.bannerBtnPrimary}`}
            onClick={() => confirmAttackResolution(false)}
          >
            Confirmar Ataque
          </button>
          <button className={styles.bannerBtn} onClick={cancelActiveModes}>
            Cancelar
          </button>
        </div>
      )}

      {/* Banner Contextual de Ferramenta de Terreno / LoS */}
      {!movingChar && !attackTargeting && activeTool !== 'select' && (
        <div className={styles.modeBanner}>
          <span className={styles.modeDot} />
          <span className={styles.modeText}>
            {activeTool === 'terrain_impassable' &&
              'Pintando Obstáculo Impassável (bloqueia movimento e LoS)'}
            {activeTool === 'terrain_difficult' &&
              'Pintando Terreno Difícil (custo 2 de movimento)'}
            {activeTool === 'terrain_normal' &&
              'Borracha de Terreno (restaura terreno normal)'}
            {activeTool === 'los_ruler' &&
              'Régua Tática & Linha de Visão (clique e arraste entre dois quadrados)'}
          </span>
          <button className={styles.bannerBtn} onClick={cancelActiveModes}>
            Concluir (Esc)
          </button>
        </div>
      )}

      {/* Último ataque resolvido — área continua visível até ao próximo ataque */}
      {lastAttack && lastAttack.cells.length > 0 && (
        <div
          className={styles.lastAttackHud}
          style={{ top: hasTopBanner ? 62 : 12 }}
          role="status"
        >
          <span className={styles.lastAttackDot} />
          <span className={styles.lastAttackText}>
            <strong>Último ataque:</strong> {lastAttack.attackerName} —{' '}
            {lastAttack.attackName}
            <span className={styles.lastAttackMeta}>
              {' '}
              • {lastAttack.cells.length} quad.
              {attackTargeting
                ? ' • a mirar novo ataque — será substituído ao confirmar'
                : ''}
            </span>
          </span>
          <button
            className={styles.lastAttackClearBtn}
            onClick={clearLastResolvedAttack}
            title="Limpar a marcação do último ataque do tabuleiro (não desfaz o dano)"
          >
            <X size={13} />
            <span>Limpar</span>
          </button>
        </div>
      )}

      {/* Legenda de Zonas de Impacto minimizável (Parte 11.4) */}
      <div className={styles.legendContainer}>
        <div
          className={`${styles.legendHeader} ${
            showZoneLegend ? styles.legendHeaderOpen : ''
          }`}
          onClick={() => setShowZoneLegend(!showZoneLegend)}
        >
          <span>Zonas de Ameaça</span>
          {showZoneLegend ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>
        {showZoneLegend && (
          <div className={styles.legendBody}>
            <div className={styles.legendItem}>
              <span className={`${styles.zoneSwatch} ${styles.swatchRed}`} />
              <div>
                <span className={styles.legendLabel}>Vermelho — Evasão Obrigatória</span>
                <span className={styles.legendDesc}>
                  Abandone o quadrado para evitar impacto direto.
                </span>
              </div>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.zoneSwatch} ${styles.swatchOrange}`} />
              <div>
                <span className={styles.legendLabel}>Laranja — Zona de Reação</span>
                <span className={styles.legendDesc}>
                  Permite esquivar ou defender permanecendo na posição.
                </span>
              </div>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.zoneSwatch} ${styles.swatchYellow}`} />
              <div>
                <span className={styles.legendLabel}>Amarelo — Risco Indireto</span>
                <span className={styles.legendDesc}>
                  Golpe de raspão ou efeito secundário.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Indicador do modo de visão (apenas em Exploração) */}
      {fogEnabled && (
        <div className={styles.fogHud}>
          <span
            className={styles.fogHudIcon}
            aria-hidden="true"
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            <Moon size={13} />
          </span>
          <span>
            Exploração • {visionReference ? visionReference.name : 'sem unidade'} •{' '}
            {vision ? vision.range : fogGlobalRange} quad.
            {fogRangeMode === 'individual' ? ' (individual)' : ' (global)'}
          </span>
        </div>
      )}

      {/* Escada sob a unidade selecionada: dica de ligação entre mapas */}
      {escadaDaUnidade && (
        <div
          className={`${styles.stairHud} ${
            escadaDaUnidade.targetMapId ? styles.stairHudLinked : ''
          }`}
        >
          <span
            className={styles.stairHudIcon}
            aria-hidden="true"
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            {escadaDaUnidade.direction === 'up' ? (
              <ArrowUp size={13} />
            ) : (
              <ArrowDown size={13} />
            )}
          </span>
          <span>
            {escadaDaUnidade.label}
            {escadaDaUnidade.targetMapId
              ? ` → ${mapCatalog.maps[escadaDaUnidade.targetMapId]?.nome ?? 'mapa removido'}`
              : ' • sem ligação definida'}
          </span>
          {escadaDaUnidade.targetMapId &&
            mapCatalog.maps[escadaDaUnidade.targetMapId] &&
            selectedCharacterId && (
              <button
                type="button"
                className={styles.stairHudAction}
                onClick={() =>
                  switchMap(escadaDaUnidade.targetMapId as string, {
                    characterId: selectedCharacterId,
                    arrivalStairId: escadaDaUnidade.targetStairId,
                  })
                }
                title="Mudar de andar agora sem arrastar a unidade"
              >
                {escadaDaUnidade.direction === 'up' ? (
                  <ArrowUp size={12} />
                ) : (
                  <ArrowDown size={12} />
                )}
                <span>
                  {escadaDaUnidade.direction === 'up' ? 'Subir' : 'Descer'} agora
                </span>
              </button>
            )}
        </div>
      )}

      {/* Coordenadas e status do quadrado sob o mouse */}
      <div className={styles.coordsHud}>
        <span>
          Tabuleiro {appState.board.width}×{appState.board.height}
        </span>
        {hoveredCell &&
          hoveredCell.x >= 0 &&
          hoveredCell.y >= 0 &&
          hoveredCell.x < appState.board.width &&
          hoveredCell.y < appState.board.height && (
          <>
            <span>•</span>
            <span>
              Posição ({hoveredCell.x}, {hoveredCell.y})
            </span>
            <span>•</span>
            <span>
              {hoveredTerrain === 'impassable'
                ? 'Impassável'
                : hoveredTerrain === 'difficult'
                ? 'Terreno Difícil (2)'
                : 'Normal (1)'}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
