import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Crosshair,
  Eraser,
  ArrowDown,
  ArrowUp,
  CornerUpLeft,
  FolderOpen,
  Layers,
  LocateFixed,
  Mountain,
  Lock,
  Moon,
  MousePointer,
  Redo2,
  RotateCcw,
  Ruler,
  ScrollText,
  Settings,
  Shield,
  SkipForward,
  Sun,
  Swords,
  Trees,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import {
  mapasDoConjunto,
  vizinhosDeAndar,
} from '../../maps/mapEngine';
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
  const setFogMode = useGameStore((s) => s.setFogMode);
  const setFogRangeMode = useGameStore((s) => s.setFogRangeMode);
  const setFogGlobalRange = useGameStore((s) => s.setFogGlobalRange);
  const switchMap = useGameStore((s) => s.switchMap);

  const [dimW, setDimW] = useState(String(appState.board.width));
  const [dimH, setDimH] = useState(String(appState.board.height));

  // Seletor de mapas do tabuleiro (Glossário → Locais → Mapas)
  const activeMapId = useGameStore((s) => s.activeMapId);
  const activeFolderId = useGameStore((s) => s.activeFolderId);
  const mapCatalog = useGameStore((s) => s.mapCatalog);
  const openMapFloorsModal = useGameStore((s) => s.openMapFloorsModal);
  const lastMapId = useGameStore((s) => s.lastMapId);
  const switchToPreviousMap = useGameStore((s) => s.switchToPreviousMap);

  // Conjunto do mapa ativo: pasta de mapas ligados (ou mapas unidos por escadas)
  const mapList = useMemo(
    () => mapasDoConjunto(mapCatalog, activeMapId),
    [mapCatalog, activeMapId]
  );
  const vizinhos = useMemo(
    () => vizinhosDeAndar(mapCatalog, activeMapId),
    [mapCatalog, activeMapId]
  );
  const pastaAtiva = activeFolderId
    ? mapCatalog.folders[activeFolderId] ?? null
    : null;

  // Lista compacta: atual + andar superior + andar inferior
  const mapaAtual = activeMapId ? mapCatalog.maps[activeMapId] ?? null : null;
  const opcoesCompactas = useMemo(() => {
    const vistos = new Set<string>();
    const out: typeof mapList = [];
    for (const m of [mapaAtual, vizinhos.acima, vizinhos.abaixo]) {
      if (!m || vistos.has(m.id)) continue;
      vistos.add(m.id);
      out.push(m);
    }
    // Sem escadas de subida/descida: mostra os mapas mais próximos da pasta
    if (out.length === 1) {
      const idx = mapaAtual
        ? mapList.findIndex((m) => m.id === mapaAtual.id)
        : -1;
      if (idx >= 0) {
        for (const passo of [-1, 1]) {
          const vizinho = mapList[idx + passo];
          if (!vizinho || vistos.has(vizinho.id)) continue;
          vistos.add(vizinho.id);
          out.push(vizinho);
          if (out.length >= 3) break;
        }
      }
    }
    return out;
  }, [mapaAtual, vizinhos.acima, vizinhos.abaixo, mapList]);
  const haMaisMapas = mapList.length > opcoesCompactas.length;

  const fogMode = appState.settings.fogMode ?? 'day';
  // Mapa ativo com predefinição de visão trancada: controlos desativados em jogo
  const fogLocked = appState.settings.fogLocked === true;
  const fogRangeMode = appState.settings.fogRangeMode ?? 'global';
  const fogGlobalRange = appState.settings.fogGlobalRange ?? 8;
  const [fogRangeInput, setFogRangeInput] = useState(String(fogGlobalRange));

  useEffect(() => {
    setFogRangeInput(String(fogGlobalRange));
  }, [fogGlobalRange]);

  const applyFogRange = () => {
    const n = Number(fogRangeInput);
    if (!Number.isNaN(n)) setFogGlobalRange(n);
  };

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

        {lastMapId && lastMapId !== activeMapId && mapCatalog.maps[lastMapId] && (
          <button
            className={styles.actionBtn}
            onClick={switchToPreviousMap}
            title={`Voltar ao andar anterior: ${mapCatalog.maps[lastMapId].nome}`}
          >
            <CornerUpLeft size={14} />
            <span>Andar anterior</span>
          </button>
        )}

        {mapList.length > 0 && (
          <div
            className={styles.mapSelectBox}
            title={
              pastaAtiva
                ? `Pasta "${pastaAtiva.nome}" — andares ligados deste conjunto`
                : 'Andares ligados por escadas'
            }
          >
            <Layers size={13} />
            {pastaAtiva && (
              <span className={styles.folderChip}>{pastaAtiva.nome}</span>
            )}
            <select
              className={styles.mapSelect}
              value={activeMapId ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                if (id && id !== activeMapId) switchMap(id);
              }}
            >
              {!activeMapId && <option value="">Sem mapa</option>}
              {opcoesCompactas.map((m) => {
                const papel =
                  m.id === activeMapId
                    ? 'Andar atual'
                    : m.id === vizinhos.acima?.id
                    ? '▲ Andar superior'
                    : m.id === vizinhos.abaixo?.id
                    ? '▼ Andar inferior'
                    : 'Mapa da pasta';
                return (
                  <option key={m.id} value={m.id}>
                    {papel}: {m.nome}
                  </option>
                );
              })}
            </select>
            {vizinhos.acima && vizinhos.acima.id !== activeMapId && (
              <button
                className={styles.floorBtn}
                onClick={() => switchMap(vizinhos.acima!.id)}
                title={`Subir para "${vizinhos.acima.nome}"`}
              >
                <ArrowUp size={13} />
              </button>
            )}
            {vizinhos.abaixo && vizinhos.abaixo.id !== activeMapId && (
              <button
                className={styles.floorBtn}
                onClick={() => switchMap(vizinhos.abaixo!.id)}
                title={`Descer para "${vizinhos.abaixo.nome}"`}
              >
                <ArrowDown size={13} />
              </button>
            )}
            {(haMaisMapas || mapList.length > 1) && (
              <button
                className={styles.floorBtn}
                onClick={openMapFloorsModal}
                title={`Ver todos os mapas deste conjunto (${mapList.length})`}
              >
                <Layers size={13} />
                <span style={{ fontSize: 10.5 }}>{mapList.length}</span>
              </button>
            )}
          </div>
        )}

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

        {/* Névoa de Visão (Exploração) */}
        <div
          className={`${styles.toolGroup} ${
            fogLocked ? styles.toolGroupLocked : ''
          }`}
          title={
            fogLocked
              ? 'Visão trancada pela predefinição deste mapa — altera em Glossário → Locais → Mapas'
              : 'Modo de visualização do tabuleiro: Dia (mapa completo) ou Exploração (visão limitada)'
          }
        >
          <button
            className={`${styles.toolBtn} ${
              fogMode === 'day' ? styles.toolBtnActive : ''
            }`}
            onClick={() => setFogMode('day')}
            disabled={fogLocked}
          >
            <Sun size={14} />
            <span>Dia</span>
          </button>
          <button
            className={`${styles.toolBtn} ${
              fogMode === 'exploration' ? styles.toolBtnActive : ''
            }`}
            onClick={() => setFogMode('exploration')}
            disabled={fogLocked}
          >
            <Moon size={14} />
            <span>Exploração</span>
          </button>
          {fogLocked && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                paddingRight: 4,
                opacity: 0.85,
              }}
              title="Visão trancada pela predefinição deste mapa"
            >
              <Lock size={12} />
            </span>
          )}
        </div>

        {fogMode === 'exploration' && (
          <div
            className={`${styles.dimBox} ${
              fogLocked ? styles.toolGroupLocked : ''
            }`}
            title={
              fogLocked
                ? 'Visão trancada pela predefinição deste mapa'
                : fogRangeMode === 'global'
                ? 'Alcance de visão global (quadrados)'
                : 'Alcance global — cada unidade pode ter o seu valor na barra lateral'
            }
          >
            <span>Visão</span>
            <input
              type="number"
              min={1}
              max={40}
              className={styles.dimInput}
              value={fogRangeInput}
              onChange={(e) => setFogRangeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFogRange()}
              onBlur={applyFogRange}
              disabled={fogLocked}
            />
            <div className={styles.toolGroup} style={{ padding: 0, border: 'none', background: 'transparent' }}>
              <button
                className={`${styles.toolBtn} ${
                  fogRangeMode === 'global' ? styles.toolBtnActive : ''
                }`}
                onClick={() => setFogRangeMode('global')}
                disabled={fogLocked}
                title="Usar um alcance único para todas as unidades"
                style={{ fontSize: 10.5, padding: '3px 6px' }}
              >
                Global
              </button>
              <button
                className={`${styles.toolBtn} ${
                  fogRangeMode === 'individual' ? styles.toolBtnActive : ''
                }`}
                onClick={() => setFogRangeMode('individual')}
                disabled={fogLocked}
                title="Cada unidade usa o seu próprio alcance (definido na barra lateral direita)"
                style={{ fontSize: 10.5, padding: '3px 6px' }}
              >
                Individual
              </button>
            </div>
          </div>
        )}

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
