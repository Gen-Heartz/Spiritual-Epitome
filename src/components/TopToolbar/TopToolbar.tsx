import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Crosshair,
  Eraser,
  FolderOpen,
  LocateFixed,
  Mountain,
  MousePointer,
  Redo2,
  RotateCcw,
  Ruler,
  ScrollText,
  Settings,
  Shield,
  SkipForward,
  Swords,
  Trees,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import styles from './TopToolbar.module.css';

export const TopToolbar: React.FC = () => {
  const appState = useGameStore((s) => s.appState);
  const activeTool = useGameStore((s) => s.activeTool);
  const cameraZoomPercent = useGameStore((s) => s.cameraZoomPercent);
  const storageEstimate = useGameStore((s) => s.storageEstimate);

  const setActiveTool = useGameStore((s) => s.setActiveTool);
  const resizeBoard = useGameStore((s) => s.resizeBoard);
  const triggerCameraReset = useGameStore((s) => s.triggerCameraReset);
  const triggerCameraZoomStep = useGameStore((s) => s.triggerCameraZoomStep);
  const setCombatMode = useGameStore((s) => s.setCombatMode);
  const nextTurn = useGameStore((s) => s.nextTurn);
  const newRound = useGameStore((s) => s.newRound);
  const undo = useGameStore((s) => s.undo);
  const redo = useGameStore((s) => s.redo);
  const openArsenalModal = useGameStore((s) => s.openArsenalModal);
  const openMatchesModal = useGameStore((s) => s.openMatchesModal);
  const openSpawnFichaModal = useGameStore((s) => s.openSpawnFichaModal);
  const setActiveScreen = useGameStore((s) => s.setActiveScreen);
  const setSettingsModalOpen = useGameStore((s) => s.setSettingsModalOpen);

  const [dimW, setDimW] = useState(String(appState.board.width));
  const [dimH, setDimH] = useState(String(appState.board.height));

  useEffect(() => {
    setDimW(String(appState.board.width));
    setDimH(String(appState.board.height));
  }, [appState.board.width, appState.board.height]);

  const dimsChanged =
    Number(dimW) !== appState.board.width ||
    Number(dimH) !== appState.board.height;

  const applyDimensions = () => {
    const w = Number(dimW);
    const h = Number(dimH);
    if (!Number.isNaN(w) && !Number.isNaN(h)) {
      resizeBoard(w, h);
    }
  };

  const lastAction =
    appState.history.past[appState.history.past.length - 1] ?? null;
  const nextRedo = appState.history.future[0] ?? null;

  return (
    <header className={styles.toolbar}>
      {/* Identidade e Seletor de Partida */}
      <div className={styles.section}>
        <button
          className={styles.actionBtn}
          onClick={() => setActiveScreen('home')}
          title="Voltar ao Menu Principal do Grimório do Mestre"
        >
          <ArrowLeft size={14} />
          <span>Grimório</span>
        </button>

        <button
          className={styles.brandBtn}
          onClick={() => openMatchesModal('matches')}
          title="Gerenciar partidas salvas, modelos e exportação"
        >
          <Shield size={15} color="#ecc050" />
          <span className={styles.brandTitle}>TABULEIRO</span>
          <span className={styles.matchSubtitle}>• {appState.matchName}</span>
        </button>

        <div className={styles.divider} />

        {/* Ferramentas do Tabuleiro */}
        <div className={styles.toolGroup}>
          <button
            className={`${styles.toolBtn} ${
              activeTool === 'select' ? styles.toolBtnActive : ''
            }`}
            onClick={() => setActiveTool('select')}
            title="Selecionar, mover e girar personagens"
          >
            <MousePointer size={14} />
            <span>Interagir</span>
          </button>
          <button
            className={`${styles.toolBtn} ${
              activeTool === 'terrain_impassable' ? styles.toolBtnActive : ''
            }`}
            onClick={() => setActiveTool('terrain_impassable')}
            title="Pintar terreno impassável (bloqueia movimento e linha de visão)"
          >
            <Mountain size={14} />
            <span>Obstáculo</span>
          </button>
          <button
            className={`${styles.toolBtn} ${
              activeTool === 'terrain_difficult' ? styles.toolBtnActive : ''
            }`}
            onClick={() => setActiveTool('terrain_difficult')}
            title="Pintar terreno difícil (custo 2 de movimento)"
          >
            <Trees size={14} />
            <span>Difícil</span>
          </button>
          <button
            className={`${styles.toolBtn} ${
              activeTool === 'terrain_normal' ? styles.toolBtnActive : ''
            }`}
            onClick={() => setActiveTool('terrain_normal')}
            title="Limpar terreno para Normal (custo 1)"
          >
            <Eraser size={14} />
          </button>
          <button
            className={`${styles.toolBtn} ${
              activeTool === 'los_ruler' ? styles.toolBtnActive : ''
            }`}
            onClick={() => setActiveTool('los_ruler')}
            title="Medir distância e testar Linha de Visão (Bresenham)"
          >
            <Ruler size={14} />
            <span>LoS</span>
          </button>
        </div>

        {/* Dimensões do Grid em Tempo Real */}
        <div className={styles.dimBox} title="Dimensões do Grid (Largura × Altura)">
          <span>Grid</span>
          <input
            type="number"
            min={4}
            max={80}
            className={styles.dimInput}
            value={dimW}
            onChange={(e) => setDimW(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyDimensions()}
          />
          <span>×</span>
          <input
            type="number"
            min={4}
            max={80}
            className={styles.dimInput}
            value={dimH}
            onChange={(e) => setDimH(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyDimensions()}
          />
          {dimsChanged && (
            <button className={styles.dimApplyBtn} onClick={applyDimensions}>
              OK
            </button>
          )}
        </div>
      </div>

      {/* Controle de Combate (Livre vs Turnos) */}
      <div className={styles.section}>
        <div className={styles.toolGroup}>
          <button
            className={`${styles.toolBtn} ${
              appState.combat.mode === 'free' ? styles.toolBtnActive : ''
            }`}
            onClick={() => setCombatMode('free')}
            title="Modo Livre: aja com qualquer personagem livremente"
          >
            <span>Modo Livre</span>
          </button>
          <button
            className={`${styles.toolBtn} ${
              appState.combat.mode === 'turns' ? styles.toolBtnActive : ''
            }`}
            onClick={() => setCombatMode('turns')}
            title="Modo Turnos: iniciativa e rodadas (nunca bloqueia o mestre)"
          >
            <Crosshair size={13} />
            <span>Turnos</span>
          </button>
        </div>

        {appState.combat.mode === 'turns' && (
          <>
            <span className={styles.roundBadge}>
              Rodada {appState.combat.round}
            </span>
            <button
              className={styles.actionBtn}
              onClick={nextTurn}
              title="Avançar para o próximo personagem da iniciativa"
            >
              <SkipForward size={14} />
              <span>Próx. Turno</span>
            </button>
            <button
              className={styles.toolBtn}
              onClick={newRound}
              title="Iniciar nova rodada a partir do primeiro da iniciativa"
            >
              <RotateCcw size={13} />
            </button>
          </>
        )}
      </div>

      {/* Câmera, Undo/Redo, Arsenal e Persistência */}
      <div className={styles.section}>
        {storageEstimate.warning && (
          <button
            className={styles.storageWarning}
            onClick={() => openMatchesModal('matches')}
            title="Armazenamento local acima de 80% da capacidade estimada"
          >
            <AlertTriangle size={14} />
            <span>Storage {Math.round(storageEstimate.percent)}%</span>
          </button>
        )}

        {/* Undo / Redo */}
        <div className={styles.toolGroup}>
          <button
            className={styles.toolBtn}
            disabled={!lastAction}
            onClick={undo}
            title={
              lastAction
                ? `Desfazer: ${lastAction.description} (Ctrl+Z)`
                : 'Nada para desfazer'
            }
          >
            <Undo2 size={14} />
          </button>
          <button
            className={styles.toolBtn}
            disabled={!nextRedo}
            onClick={redo}
            title={
              nextRedo
                ? `Refazer: ${nextRedo.description} (Ctrl+Y)`
                : 'Nada para refazer'
            }
          >
            <Redo2 size={14} />
          </button>
        </div>

        {/* Controles de Câmera */}
        <div className={styles.toolGroup}>
          <button
            className={styles.toolBtn}
            onClick={() => triggerCameraZoomStep(1 / 1.2)}
            title="Reduzir zoom"
          >
            <ZoomOut size={14} />
          </button>
          <span className={styles.zoomLabel}>{cameraZoomPercent}%</span>
          <button
            className={styles.toolBtn}
            onClick={() => triggerCameraZoomStep(1.2)}
            title="Aumentar zoom"
          >
            <ZoomIn size={14} />
          </button>
          <button
            className={styles.toolBtn}
            onClick={triggerCameraReset}
            title="Centralizar e restaurar câmera (Tecla 0)"
          >
            <LocateFixed size={14} />
          </button>
        </div>

        <div className={styles.divider} />

        <button
          className={`${styles.actionBtn} ${styles.actionBtnGold}`}
          onClick={() => openSpawnFichaModal(null)}
          title="Trazer ou sincronizar heróis criados em Fichas (Spiritual Epitome)"
        >
          <ScrollText size={15} />
          <span>Fichas</span>
        </button>

        <button
          className={styles.actionBtn}
          onClick={() => openArsenalModal(null, null)}
          title="Biblioteca de Armas e Editor Visual de Ataques"
        >
          <Swords size={15} />
          <span>Arsenal</span>
        </button>

        <button
          className={styles.actionBtn}
          onClick={() => openMatchesModal('export')}
          title="Partidas, Modelos Reutilizáveis e Exportar/Importar JSON"
        >
          <FolderOpen size={15} />
          <span>Partidas & JSON</span>
        </button>

        <button
          className={styles.toolBtn}
          onClick={() => setSettingsModalOpen(true)}
          title="Configurações de regras (Diagonais, Soma de Dano, LoS)"
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
};
