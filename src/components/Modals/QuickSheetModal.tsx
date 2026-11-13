import React from 'react';
import { ScrollText, X } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { FichaSheet } from '../Fichas/FichaSheet';
import styles from './ModalShared.module.css';

export const QuickSheetModal: React.FC = () => {
  const quickSheetFichaId = useGameStore((s) => s.quickSheetFichaId);
  const setQuickSheetFichaId = useGameStore((s) => s.setQuickSheetFichaId);

  if (!quickSheetFichaId) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={() => setQuickSheetFichaId(null)}
    >
      <div
        className={`${styles.modal} ${styles.modalWide}`}
        style={{ maxWidth: 920, maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.title}>
            <ScrollText size={17} />
            <span>
              Ficha Spiritual Epitome (Sincronização Automática com o Tabuleiro)
            </span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => setQuickSheetFichaId(null)}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <FichaSheet fichaId={quickSheetFichaId} mode="modal" />
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setQuickSheetFichaId(null)}
          >
            Concluir &amp; Voltar ao Combate
          </button>
        </div>
      </div>
    </div>
  );
};
