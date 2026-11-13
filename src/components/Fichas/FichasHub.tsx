import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import {
  calcularFicha,
  LINHAGEM_LABELS,
  sugerirEmblemaPorFicha,
} from '../../epitome/epitomeEngine';
import { TokenAvatar } from '../common/TokenAvatar';
import styles from './FichasHub.module.css';

export const FichasHub: React.FC = () => {
  const fichasList = useGameStore((s) => s.fichasList);
  const appState = useGameStore((s) => s.appState);

  const setActiveScreen = useGameStore((s) => s.setActiveScreen);
  const openFichaEditor = useGameStore((s) => s.openFichaEditor);
  const startJogarFichas = useGameStore((s) => s.startJogarFichas);
  const deleteFichaRecord = useGameStore((s) => s.deleteFichaRecord);
  const spawnOrSyncFichaOnBoard = useGameStore(
    (s) => s.spawnOrSyncFichaOnBoard
  );
  const refreshFichas = useGameStore((s) => s.refreshFichas);
  const showToast = useGameStore((s) => s.showToast);

  const [listMode, setListMode] = useState<'none' | 'editar' | 'jogar'>(
    'editar'
  );
  const [selectedPlayIds, setSelectedPlayIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    refreshFichas();
  }, [refreshFichas]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (listMode !== 'none') {
          setListMode('none');
          setSelectedPlayIds([]);
        } else {
          setActiveScreen('home');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [listMode, setActiveScreen]);

  const togglePlaySelection = (id: string) => {
    setSelectedPlayIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 2) {
        showToast(
          'Máximo de 2 fichas simultâneas. Desmarque uma para trocar.'
        );
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleDeleteClick = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmDeleteId === id) {
      await deleteFichaRecord(id);
      setConfirmDeleteId(null);
      setSelectedPlayIds((prev) => prev.filter((x) => x !== id));
      showToast('Ficha removida do Grimório.');
      return;
    }
    setConfirmDeleteId(id);
    setTimeout(() => {
      setConfirmDeleteId((cur) => (cur === id ? null : cur));
    }, 3000);
  };

  const handleSendToBoard = async (e: React.MouseEvent, fichaId: string) => {
    e.stopPropagation();
    await spawnOrSyncFichaOnBoard(fichaId, {
      placeOnBoard: true,
      updateExisting: true,
    });
    setActiveScreen('tabuleiro');
  };

  const isOnBoard = (fichaId: string) =>
    Object.values(appState.characters).some((c) => c.fichaId === fichaId);

  return (
    <div className={styles.screen}>
      <div className={styles.frame}>
        <div className={`${styles.corner} ${styles.cornerTl}`} />
        <div className={`${styles.corner} ${styles.cornerTr}`} />
        <div className={`${styles.corner} ${styles.cornerBl}`} />
        <div className={`${styles.corner} ${styles.cornerBr}`} />

        <header className={styles.header}>
          <div className={styles.ornament}>✦ ‥ ✦ ‥ ✦</div>
          <h1 className={styles.title}>Fichas de Personagem</h1>
          <p className={styles.subtitle}>Registro dos Heróis e Vilões</p>
          <div className={styles.ornament}>✦ ‥ ✦ ‥ ✦</div>
        </header>

        <hr className={`divisor-dourado ${styles.divider}`} />

        <nav className={styles.grid} aria-label="Opções de Fichas">
          <button
            type="button"
            className={styles.modeBtn}
            onClick={() => openFichaEditor(null)}
          >
            <span className={styles.icon}>&#10010;</span>
            <span className={styles.btnTitle}>Criar Ficha</span>
            <span className={styles.btnDesc}>Novo Herói</span>
          </button>

          <button
            type="button"
            className={`${styles.modeBtn} ${
              listMode === 'editar' ? styles.modeBtnActive : ''
            }`}
            onClick={() => {
              setSelectedPlayIds([]);
              setListMode(listMode === 'editar' ? 'none' : 'editar');
            }}
          >
            <span className={styles.icon}>&#9998;</span>
            <span className={styles.btnTitle}>Editar Ficha</span>
            <span className={styles.btnDesc}>
              Alterar Dados ({fichasList.length})
            </span>
          </button>

          <button
            type="button"
            className={`${styles.modeBtn} ${
              listMode === 'jogar' ? styles.modeBtnActive : ''
            }`}
            onClick={() => {
              setSelectedPlayIds([]);
              setListMode(listMode === 'jogar' ? 'none' : 'jogar');
            }}
          >
            <span className={styles.icon}>&#9876;</span>
            <span className={styles.btnTitle}>Jogar</span>
            <span className={styles.btnDesc}>Mesa Dividida (1–2)</span>
          </button>
        </nav>

        {listMode !== 'none' && (
          <section className={styles.listSection}>
            <h2 className={styles.listTitle}>
              {listMode === 'editar'
                ? 'Selecione uma Ficha para Editar ou Enviar ao Tabuleiro'
                : 'Selecione 1 ou 2 Fichas para a Mesa de Jogo'}
            </h2>

            {listMode === 'jogar' && (
              <div className={styles.selectionBar}>
                <span className={styles.selectionInfo}>
                  {selectedPlayIds.length === 0 && '0 de 2 selecionadas'}
                  {selectedPlayIds.length === 1 &&
                    '1 ficha selecionada (selecione mais 1 ou inicie solo)'}
                  {selectedPlayIds.length === 2 &&
                    '2 fichas selecionadas (tela dividida lado a lado)'}
                </span>
                <button
                  type="button"
                  className={styles.startPlayBtn}
                  disabled={selectedPlayIds.length === 0}
                  onClick={() => startJogarFichas(selectedPlayIds)}
                >
                  Iniciar Mesa
                </button>
              </div>
            )}

            {fichasList.length === 0 ? (
              <p className={styles.emptyMsg}>
                Nenhuma ficha criada ainda. Clique em &ldquo;Criar Ficha&rdquo;
                para forjar o primeiro personagem.
              </p>
            ) : (
              <div className={styles.cardsContainer}>
                {fichasList.map((ficha) => {
                  const stats = calcularFicha(ficha);
                  const playOrder = selectedPlayIds.indexOf(ficha.id);
                  const isSelectedPlay = playOrder !== -1;
                  const alreadyInBoard = isOnBoard(ficha.id);

                  return (
                    <div
                      key={ficha.id}
                      className={`${styles.card} ${
                        isSelectedPlay ? styles.cardSelectedPlay : ''
                      }`}
                      onClick={() => {
                        if (listMode === 'jogar') {
                          togglePlaySelection(ficha.id);
                        } else {
                          openFichaEditor(ficha.id);
                        }
                      }}
                    >
                      <div className={styles.cardLeft}>
                        {listMode === 'jogar' && isSelectedPlay ? (
                          <span className={styles.orderBadge}>
                            {playOrder + 1}
                          </span>
                        ) : (
                          <TokenAvatar
                            imageId={sugerirEmblemaPorFicha(ficha)}
                            alt={ficha.nome || 'Herói'}
                            size={34}
                          />
                        )}
                        <div className={styles.cardInfo}>
                          <div className={styles.cardName}>
                            {ficha.nome || 'Sem nome'}
                          </div>
                          <div className={styles.cardDetails}>
                            Nv {ficha.nivel} •{' '}
                            {LINHAGEM_LABELS[ficha.linhagem].replace(
                              'Linhagem ',
                              ''
                            )}{' '}
                            • Vida {stats.vidaAtual}/{stats.vidaEfetivaMax} •
                            Desl {stats.deslocamento}q • Agi{' '}
                            {stats.agilidadeCombate}
                            {ficha.nomeJogador
                              ? ` • Jogador: ${ficha.nomeJogador}`
                              : ''}
                          </div>
                        </div>
                      </div>

                      {listMode === 'editar' && (
                        <div className={styles.cardActions}>
                          <button
                            type="button"
                            className={styles.boardSendBtn}
                            onClick={(e) => handleSendToBoard(e, ficha.id)}
                            title="Converte perícias, arma e magias e posiciona no Tabuleiro Tático"
                          >
                            {alreadyInBoard ? '↻ Sinc. Tabuleiro' : '♜ No Tabuleiro'}
                          </button>
                          <button
                            type="button"
                            className={`${styles.deleteBtn} ${
                              confirmDeleteId === ficha.id
                                ? styles.deleteBtnConfirm
                                : ''
                            }`}
                            onClick={(e) => handleDeleteClick(e, ficha.id)}
                            title="Remover ficha"
                          >
                            {confirmDeleteId === ficha.id
                              ? 'Confirmar?'
                              : '✕'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

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
            className={styles.boardSendBtn}
            style={{ padding: '8px 16px', fontSize: 11.5 }}
            onClick={() => setActiveScreen('tabuleiro')}
          >
            ♜ Abrir Tabuleiro Tático
          </button>
        </footer>
      </div>
    </div>
  );
};
