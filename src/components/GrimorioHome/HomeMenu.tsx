import React, { useEffect, useRef } from 'react';
import {
  BookOpen,
  LayoutGrid,
  Save,
  Settings,
  Swords,
  Upload,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import {
  exportGrimorioCompletoJSON,
  importGrimorioOuPartidaJSON,
} from '../../db/database';
import styles from './HomeMenu.module.css';

export const HomeMenu: React.FC = () => {
  const appState = useGameStore((s) => s.appState);
  const arsenalCatalog = useGameStore((s) => s.arsenalCatalog);
  const fichasList = useGameStore((s) => s.fichasList);
  const systemGuideModalOpen = useGameStore((s) => s.systemGuideModalOpen);

  const setActiveScreen = useGameStore((s) => s.setActiveScreen);
  const setSystemGuideModalOpen = useGameStore((s) => s.setSystemGuideModalOpen);
  const refreshFichas = useGameStore((s) => s.refreshFichas);
  const loadMatchState = useGameStore((s) => s.loadMatchState);
  const showToast = useGameStore((s) => s.showToast);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSalvar = async () => {
    try {
      const { json, totalFichas, nomeArquivo } =
        await exportGrimorioCompletoJSON(appState);
      const blob = new Blob([json], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(
        `Grimório salvo! (${totalFichas} ficha${
          totalFichas === 1 ? '' : 's'
        } + Tabuleiro exportados)`
      );
    } catch (err: any) {
      showToast(err.message || 'Erro ao exportar Grimório.');
    }
  };

  const handleCarregarArquivo = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { fichasImportadas, partidaImportada } =
        await importGrimorioOuPartidaJSON(text);
      await refreshFichas();
      if (partidaImportada) {
        await loadMatchState(
          `match_grimorio_${Date.now()}`,
          partidaImportada.matchName,
          partidaImportada
        );
      }
      const partes: string[] = [];
      if (fichasImportadas > 0) {
        partes.push(
          `${fichasImportadas} ficha${fichasImportadas === 1 ? '' : 's'}`
        );
      }
      if (partidaImportada) {
        partes.push(`partida "${partidaImportada.matchName}"`);
      }
      showToast(
        partes.length > 0
          ? `Dados restaurados: ${partes.join(' e ')}!`
          : 'Arquivo importado com sucesso!'
      );
    } catch (err: any) {
      showToast(err.message || 'Erro ao ler arquivo JSON.');
    }
    e.target.value = '';
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (systemGuideModalOpen) {
        if (e.key === 'Escape') setSystemGuideModalOpen(false);
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case '1':
          setActiveScreen('glossario');
          break;
        case '2':
          setActiveScreen('fichas');
          break;
        case '3':
          setSystemGuideModalOpen(true);
          break;
        case '4':
          setActiveScreen('tabuleiro');
          break;
        case '5':
          handleSalvar();
          break;
        case '6':
          fileInputRef.current?.click();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [systemGuideModalOpen, appState]);

  const boardUnitCount = Object.keys(appState.characters).length;
  const arsenalCount = Object.keys(arsenalCatalog.weapons).length;

  return (
    <div className={styles.screen}>
      <div className={styles.frame}>
        <div className={`${styles.corner} ${styles.cornerTl}`} />
        <div className={`${styles.corner} ${styles.cornerTr}`} />
        <div className={`${styles.corner} ${styles.cornerBl}`} />
        <div className={`${styles.corner} ${styles.cornerBr}`} />

        <header className={styles.header}>
          <div className={styles.ornament}>✦ ‥ ✦ ‥ ✦</div>
          <h1 className={styles.title}>Grimório do Mestre</h1>
          <p className={styles.subtitle}>
            Forjado nas Chamas do Conhecimento Arcano
          </p>
          <div className={styles.ornament}>✦ ‥ ✦ ‥ ✦</div>
        </header>

        <hr className={`divisor-dourado ${styles.divider}`} />

        <nav className={styles.grid} aria-label="Menu Principal do Grimório">
          {/* 1. Glossário */}
          <button
            type="button"
            className={`${styles.cardBtn} ${styles.cardBtnFeatured}`}
            onClick={() => setActiveScreen('glossario')}
          >
            <span className={styles.badgeCount}>{arsenalCount} armas</span>
            <span className={styles.hotkey}>1</span>
            <span className={styles.icon} style={{ display: 'inline-flex' }}>
              <BookOpen size={26} strokeWidth={1.5} />
            </span>
            <span className={styles.label}>Glossário</span>
            <span className={styles.desc}>Armas, Monstros &amp; Lore</span>
          </button>

          {/* 2. Fichas */}
          <button
            type="button"
            className={`${styles.cardBtn} ${styles.cardBtnFeatured}`}
            onClick={() => setActiveScreen('fichas')}
          >
            <span className={styles.badgeCount}>{fichasList.length}</span>
            <span className={styles.hotkey}>2</span>
            <span className={styles.icon} style={{ display: 'inline-flex' }}>
              <Swords size={26} strokeWidth={1.5} />
            </span>
            <span className={styles.label}>Fichas</span>
            <span className={styles.desc}>Heróis &amp; Vilões</span>
          </button>

          {/* 3. Sistema */}
          <button
            type="button"
            className={styles.cardBtn}
            onClick={() => setSystemGuideModalOpen(true)}
          >
            <span className={styles.hotkey}>3</span>
            <span className={styles.icon} style={{ display: 'inline-flex' }}>
              <Settings size={26} strokeWidth={1.5} />
            </span>
            <span className={styles.label}>Sistema</span>
            <span className={styles.desc}>Leis do Mundo</span>
          </button>

          {/* 4. Tabuleiro (substitui Construção) */}
          <button
            type="button"
            className={`${styles.cardBtn} ${styles.cardBtnFeatured}`}
            onClick={() => setActiveScreen('tabuleiro')}
          >
            <span className={styles.badgeCount}>{boardUnitCount} unid.</span>
            <span className={styles.hotkey}>4</span>
            <span className={styles.icon} style={{ display: 'inline-flex' }}>
              <LayoutGrid size={26} strokeWidth={1.5} />
            </span>
            <span className={styles.label}>Tabuleiro</span>
            <span className={styles.desc}>Campo de Batalha</span>
          </button>

          {/* 5. Salvar */}
          <button
            type="button"
            className={styles.cardBtn}
            onClick={handleSalvar}
          >
            <span className={styles.hotkey}>5</span>
            <span className={styles.icon} style={{ display: 'inline-flex' }}>
              <Save size={26} strokeWidth={1.5} />
            </span>
            <span className={styles.label}>Salvar</span>
            <span className={styles.desc}>Guardar Progresso</span>
          </button>

          {/* 6. Carregar */}
          <button
            type="button"
            className={styles.cardBtn}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className={styles.hotkey}>6</span>
            <span className={styles.icon} style={{ display: 'inline-flex' }}>
              <Upload size={26} strokeWidth={1.5} />
            </span>
            <span className={styles.label}>Carregar</span>
            <span className={styles.desc}>Restaurar Dados</span>
          </button>
        </nav>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleCarregarArquivo}
        />

        <hr className={`divisor-dourado ${styles.divider}`} />

        <footer className={styles.footer}>
          <p className={styles.footerText}>
            &ldquo;Que os dados rolem a seu favor, aventureiro.&rdquo;
          </p>
        </footer>
      </div>

      {/* Modal de Referência Rápida: Leis do Mundo (Spiritual-Epitome + Tabuleiro) */}
      {systemGuideModalOpen && (
        <div
          className={styles.guideBackdrop}
          onClick={() => setSystemGuideModalOpen(false)}
        >
          <div
            className={styles.guideModal}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.guideTitle}>
              Leis do Mundo — Spiritual Epitome &amp; Tabuleiro
            </h3>
            <div className={styles.guideSection}>
              <h4>Matriz de Perícias &amp; Os 4 Campos</h4>
              <p>
                • <strong>Perícias Totais:</strong> <code>6 + (Nível × 3)</code>{' '}
                distribuídas em 6 Tríades (Físico, Mental, Espiritual, Sentidos,
                Social e Combate).
              </p>
              <p>
                • <strong>Circulação Mágica (2×2):</strong> <strong>X</strong>{' '}
                concede Estamina (+1 sup / +2 inf), <strong>O</strong> concede
                Mana (+2 cada em par horizontal), <strong>Quadrado (Q)</strong>{' '}
                concede Vida (+2 cada em par vertical).
              </p>
              <p>
                • <strong>Recursos:</strong> Vida (<code>10 + Circ + Vigor×3</code>
                ), Mana (<code>5 + Circ + Ancoragem×2 + Integ×0.5 + Canal×0.5</code>{' '}
                menos Slots ativos), Estamina (<code>3 + Circ + Tolerância×2</code>
                ) e Raciocínio (<code>5 + Conc×2.5 + Análise×0.5 + Foco×0.5</code>
                ).
              </p>
            </div>
            <div className={styles.guideSection}>
              <h4>Sinergia Direta entre Fichas e Tabuleiro Tático</h4>
              <p>
                • Qualquer herói ou vilão criado em <strong>Fichas</strong> pode
                ser enviado ao <strong>Tabuleiro</strong> com um clique,
                convertendo automaticamente <em>Vida</em>, <em>Deslocamento</em>{' '}
                (<code>2 + Atletismo×1.5</code>), <em>Agilidade de Combate</em>{' '}
                (para ordenar Iniciativa) e <em>Arma equipada</em>.
              </p>
              <p>
                • O <strong>Alcance Mágico</strong> gera automaticamente ataques
                táticos com zonas graduadas (Vermelho / Laranja / Amarelo): tanto{' '}
                <strong>Projeção Direcional</strong> (respeitando o ângulo de{' '}
                <code>180°</code> até <code>15°</code> ou <code>0° Reta</code> que
                acompanha o cursor do mouse) quanto{' '}
                <strong>Domínio Circular</strong> e técnicas dos{' '}
                <strong>Slots Internos/Externos</strong>.
              </p>
              <p>
                • Danos, curas, gastos de Estamina e Raciocínio permanecem
                sincronizados entre o Tabuleiro e a Ficha!
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className={styles.guideCloseBtn}
                onClick={() => setSystemGuideModalOpen(false)}
              >
                Fechar Compêndio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
