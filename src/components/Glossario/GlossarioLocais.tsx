import React, { useEffect } from 'react';
import { ChevronLeft, Globe, LayoutGrid, Map } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import styles from './GlossarioHub.module.css';

/**
 * Locais — hub com duas opções:
 * · Mapas (ativo) → editor de mapas do tabuleiro, escadas e preset de visão
 * · Regiões → estrutura pronta, conteúdo "Em breve"
 */
export const GlossarioLocais: React.FC = () => {
  const setActiveScreen = useGameStore((s) => s.setActiveScreen);
  const refreshMaps = useGameStore((s) => s.refreshMaps);
  const showToast = useGameStore((s) => s.showToast);
  const mapCatalog = useGameStore((s) => s.mapCatalog);

  useEffect(() => {
    refreshMaps();
  }, [refreshMaps]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') setActiveScreen('glossario');
      if (e.key === '1') setActiveScreen('glossario_mapas');
      if (e.key === '2')
        showToast('Regiões — seção estruturada, conteúdo em breve.');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setActiveScreen, showToast]);

  const totalMapas = Object.keys(mapCatalog.maps).length;

  return (
    <div className={styles.screen}>
      <div className={styles.frame}>
        <div className={`${styles.corner} ${styles.cornerTl}`} />
        <div className={`${styles.corner} ${styles.cornerTr}`} />
        <div className={`${styles.corner} ${styles.cornerBl}`} />
        <div className={`${styles.corner} ${styles.cornerBr}`} />

        <header className={styles.header}>
          <div className={styles.ornament}>✦ ‥ ✦ ‥ ✦</div>
          <h1 className={styles.title}>Glossário — Locais</h1>
          <p className={styles.subtitle}>
            Mapas do Tabuleiro &amp; Regiões — escadas entre níveis
          </p>
          <div className={styles.ornament}>✦ ‥ ✦ ‥ ✦</div>
        </header>

        <hr className={`divisor-dourado ${styles.divider}`} />

        <nav className={styles.grid} aria-label="Locais">
          {/* 1. Mapas (editor ativo) */}
          <button
            type="button"
            className={`${styles.cardBtn} ${styles.cardBtnActive}`}
            onClick={() => setActiveScreen('glossario_mapas')}
          >
            <span className={styles.badge}>{totalMapas} mapas</span>
            <span className={styles.hotkey}>1</span>
            <span className={styles.icon} style={{ display: 'inline-flex' }}>
              <Map size={26} strokeWidth={1.5} />
            </span>
            <span className={styles.btnTitle}>Mapas</span>
            <span className={styles.btnDesc}>
              Editor de Tabuleiro, Escadas &amp; Preset de Visão
            </span>
          </button>

          {/* 2. Regiões (em breve) */}
          <button
            type="button"
            className={`${styles.cardBtn} ${styles.cardBtnStructure}`}
            onClick={() =>
              showToast('Regiões — seção estruturada, conteúdo em breve.')
            }
          >
            <span className={styles.badgeSoon}>Em breve</span>
            <span className={styles.hotkey}>2</span>
            <span className={styles.icon} style={{ display: 'inline-flex' }}>
              <Globe size={26} strokeWidth={1.5} />
            </span>
            <span className={styles.btnTitle}>Regiões</span>
            <span className={styles.btnDesc}>Reinos, Biomas &amp; Fronteiras</span>
          </button>
        </nav>

        <hr className={`divisor-dourado ${styles.divider}`} />

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => setActiveScreen('glossario')}
          >
            <ChevronLeft size={13} /> Voltar ao Glossário
          </button>
          <button
            type="button"
            className={styles.shortcutBtn}
            onClick={() => setActiveScreen('tabuleiro')}
          >
            <LayoutGrid size={13} /> Ir para o Tabuleiro
          </button>
        </footer>
      </div>
    </div>
  );
};
