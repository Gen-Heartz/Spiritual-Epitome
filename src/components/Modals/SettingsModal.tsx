import React from 'react';
import { Settings, X } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import styles from './ModalShared.module.css';

export const SettingsModal: React.FC = () => {
  const open = useGameStore((s) => s.settingsModalOpen);
  const settings = useGameStore((s) => s.appState.settings);
  const setSettingsModalOpen = useGameStore((s) => s.setSettingsModalOpen);
  const updateSettings = useGameStore((s) => s.updateSettings);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={() => setSettingsModalOpen(false)}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>
            <Settings size={17} />
            <span>Configurações de Regras & Visualização</span>
          </div>
          <button
            className={styles.closeBtn}
            onClick={() => setSettingsModalOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {/* Parte 6.3: Movimentação Diagonal */}
          <div className={styles.card}>
            <div style={{ fontWeight: 700, color: 'var(--gold-bright)' }}>
              Regra de Movimentação Diagonal (Parte 6.3)
            </div>
            <div className={styles.chipRow}>
              <button
                type="button"
                className={`${styles.chip} ${
                  settings.diagonalRule === 'chebyshev' ? styles.chipActive : ''
                }`}
                onClick={() => updateSettings({ diagonalRule: 'chebyshev' })}
              >
                1 Quadrado — Padrão (Chebyshev / Área Quadrada)
              </button>
              <button
                type="button"
                className={`${styles.chip} ${
                  settings.diagonalRule === 'alternating'
                    ? styles.chipActive
                    : ''
                }`}
                onClick={() => updateSettings({ diagonalRule: 'alternating' })}
              >
                Alternada 1-2-1-2 (Geométrica / Área Octogonal)
              </button>
            </div>
          </div>

          {/* Parte 10.3: Relação entre Danos */}
          <div className={styles.card}>
            <div style={{ fontWeight: 700, color: 'var(--gold-bright)' }}>
              Cálculo de Dano dos Ataques (Parte 10.3)
            </div>
            <div className={styles.chipRow}>
              <button
                type="button"
                className={`${styles.chip} ${
                  settings.damageRule === 'attack_only' ? styles.chipActive : ''
                }`}
                onClick={() => updateSettings({ damageRule: 'attack_only' })}
              >
                Padrão: Dano do ataque = valor final
              </button>
              <button
                type="button"
                className={`${styles.chip} ${
                  settings.damageRule === 'sum_all' ? styles.chipActive : ''
                }`}
                onClick={() => updateSettings({ damageRule: 'sum_all' })}
              >
                Soma: Ataque + Base da Arma + Base do Personagem
              </button>
            </div>
          </div>

          {/* Opções Visuais e LoS */}
          <div className={styles.card}>
            <div style={{ fontWeight: 700, color: 'var(--gold-bright)' }}>
              Tabuleiro & Linha de Visão
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.showGrid}
                onChange={(e) => updateSettings({ showGrid: e.target.checked })}
              />
              <span>Exibir linhas quadriculadas do Grid</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.showCoordinates}
                onChange={(e) =>
                  updateSettings({ showCoordinates: e.target.checked })
                }
              />
              <span>Exibir coordenadas de referência (X, Y) nas bordas</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.checkLoSOnAttacks}
                onChange={(e) =>
                  updateSettings({ checkLoSOnAttacks: e.target.checked })
                }
              />
              <span>
                Exibir verificação de Linha de Visão (Bresenham) ao mirar ataques
              </span>
            </label>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            className={styles.btnPrimary}
            onClick={() => setSettingsModalOpen(false)}
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
