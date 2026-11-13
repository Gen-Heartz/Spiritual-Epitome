import React, { useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import styles from './GlossarioHub.module.css';

export const GlossarioHub: React.FC = () => {
  const arsenalCatalog = useGameStore((s) => s.arsenalCatalog);
  const setActiveScreen = useGameStore((s) => s.setActiveScreen);
  const refreshArsenal = useGameStore((s) => s.refreshArsenal);
  const showToast = useGameStore((s) => s.showToast);

  useEffect(() => {
    refreshArsenal();
  }, [refreshArsenal]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case 'Escape':
          setActiveScreen('home');
          break;
        case '1':
          setActiveScreen('glossario_armas');
          break;
        case '2':
          showToast('Monstros — seção estruturada, conteúdo em breve.');
          break;
        case '3':
          showToast('Plantas — seção estruturada, conteúdo em breve.');
          break;
        case '4':
          showToast('Locais — seção estruturada, conteúdo em breve.');
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setActiveScreen, showToast]);

  const totalArmas = Object.keys(arsenalCatalog.weapons).length;

  return (
    <div className={styles.screen}>
      <div className={styles.frame}>
        <div className={`${styles.corner} ${styles.cornerTl}`} />
        <div className={`${styles.corner} ${styles.cornerTr}`} />
        <div className={`${styles.corner} ${styles.cornerBl}`} />
        <div className={`${styles.corner} ${styles.cornerBr}`} />

        <header className={styles.header}>
          <div className={styles.ornament}>✦ ‥ ✦ ‥ ✦</div>
          <h1 className={styles.title}>Glossário do Mestre</h1>
          <p className={styles.subtitle}>
            Tomo do Saber — Arsenal, Bestiário, Flora &amp; Regiões
          </p>
          <div className={styles.ornament}>✦ ‥ ✦ ‥ ✦</div>
        </header>

        <hr className={`divisor-dourado ${styles.divider}`} />

        <nav className={styles.grid} aria-label="Categorias do Glossário">
          {/* 1. Armas (Arsenal Independente) */}
          <button
            type="button"
            className={`${styles.cardBtn} ${styles.cardBtnActive}`}
            onClick={() => setActiveScreen('glossario_armas')}
          >
            <span className={styles.badge}>{totalArmas} armas</span>
            <span className={styles.hotkey}>1</span>
            <span className={styles.icon}>&#9876;</span>
            <span className={styles.btnTitle}>Armas</span>
            <span className={styles.btnDesc}>
              Arsenal Independente, Criação &amp; Ataques
            </span>
          </button>

          {/* 2. Monstros */}
          <button
            type="button"
            className={`${styles.cardBtn} ${styles.cardBtnStructure}`}
            onClick={() =>
              showToast('Monstros — seção estruturada, conteúdo em breve.')
            }
          >
            <span className={styles.badgeSoon}>Em breve</span>
            <span className={styles.hotkey}>2</span>
            <span className={styles.icon}>&#9760;</span>
            <span className={styles.btnTitle}>Monstros</span>
            <span className={styles.btnDesc}>Bestiário &amp; Criaturas</span>
          </button>

          {/* 3. Plantas */}
          <button
            type="button"
            className={`${styles.cardBtn} ${styles.cardBtnStructure}`}
            onClick={() =>
              showToast('Plantas — seção estruturada, conteúdo em breve.')
            }
          >
            <span className={styles.badgeSoon}>Em breve</span>
            <span className={styles.hotkey}>3</span>
            <span className={styles.icon}>&#10048;</span>
            <span className={styles.btnTitle}>Plantas</span>
            <span className={styles.btnDesc}>Herbário &amp; Alquimia</span>
          </button>

          {/* 4. Locais */}
          <button
            type="button"
            className={`${styles.cardBtn} ${styles.cardBtnStructure}`}
            onClick={() =>
              showToast('Locais — seção estruturada, conteúdo em breve.')
            }
          >
            <span className={styles.badgeSoon}>Em breve</span>
            <span className={styles.hotkey}>4</span>
            <span className={styles.icon}>&#9968;</span>
            <span className={styles.btnTitle}>Locais</span>
            <span className={styles.btnDesc}>Reinos, Ruínas &amp; Regiões</span>
          </button>
        </nav>

        <hr className={`divisor-dourado ${styles.divider}`} />

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => setActiveScreen('home')}
          >
            &#9664; Voltar ao Grimório
          </button>

          <button
            type="button"
            className={styles.shortcutBtn}
            onClick={() => setActiveScreen('fichas')}
          >
            &#9876; Ir para Fichas
          </button>
        </footer>
      </div>
    </div>
  );
};
