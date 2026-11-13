import React, { useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { HomeMenu } from './components/GrimorioHome/HomeMenu';
import { GlossarioHub } from './components/Glossario/GlossarioHub';
import { GlossarioArmas } from './components/Glossario/GlossarioArmas';
import { FichasHub } from './components/Fichas/FichasHub';
import { FichaSheet } from './components/Fichas/FichaSheet';
import { JogarSplitView } from './components/Fichas/JogarSplitView';
import { TopToolbar } from './components/TopToolbar/TopToolbar';
import { LeftSidebar } from './components/LeftSidebar/LeftSidebar';
import { BoardCanvas } from './components/BoardCanvas/BoardCanvas';
import { RightSidebar } from './components/RightSidebar/RightSidebar';
import { CharacterModal } from './components/Modals/CharacterModal';
import { ArsenalModal } from './components/Modals/ArsenalModal';
import { AttackEditorModal } from './components/Modals/AttackEditorModal';
import { MatchesModal } from './components/Modals/MatchesModal';
import { SettingsModal } from './components/Modals/SettingsModal';
import { SpawnFichaModal } from './components/Modals/SpawnFichaModal';
import { QuickSheetModal } from './components/Modals/QuickSheetModal';
import styles from './App.module.css';

export const App: React.FC = () => {
  const initialized = useGameStore((s) => s.initialized);
  const activeScreen = useGameStore((s) => s.activeScreen);
  const editingFichaId = useGameStore((s) => s.editingFichaId);
  const toastMessage = useGameStore((s) => s.toastMessage);
  const initApp = useGameStore((s) => s.initApp);
  const setActiveScreen = useGameStore((s) => s.setActiveScreen);

  useEffect(() => {
    initApp();
  }, [initApp]);

  if (!initialized) {
    return (
      <div className={styles.loadingScreen}>
        <div>Abrindo Grimório do Mestre &amp; Tabuleiro Tático...</div>
      </div>
    );
  }

  return (
    <div className={styles.appShell}>
      {activeScreen === 'home' && <HomeMenu />}

      {activeScreen === 'glossario' && <GlossarioHub />}

      {activeScreen === 'glossario_armas' && (
        <>
          <GlossarioArmas />
          <AttackEditorModal />
        </>
      )}

      {activeScreen === 'fichas' && <FichasHub />}

      {activeScreen === 'ficha_editor' && (
        <FichaSheet
          fichaId={editingFichaId}
          mode="editor"
          onBack={() => setActiveScreen('fichas')}
        />
      )}

      {activeScreen === 'ficha_jogar' && <JogarSplitView />}

      {activeScreen === 'tabuleiro' && (
        <>
          <TopToolbar />

          <main className={styles.workspace}>
            <LeftSidebar />
            <BoardCanvas />
            <RightSidebar />
          </main>

          {/* Modais sobrepostos sem substituir o tabuleiro */}
          <SpawnFichaModal />
          <QuickSheetModal />
          <CharacterModal />
          <ArsenalModal />
          <AttackEditorModal />
          <MatchesModal />
          <SettingsModal />
        </>
      )}

      {toastMessage && <div className={styles.toast}>{toastMessage}</div>}
    </div>
  );
};

export default App;
