import React, { useEffect, useState } from 'react';
import { ChevronLeft, LayoutGrid } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { FichaSheet } from './FichaSheet';

export const JogarSplitView: React.FC = () => {
  const playingFichaIds = useGameStore((s) => s.playingFichaIds);
  const setActiveScreen = useGameStore((s) => s.setActiveScreen);
  const spawnOrSyncFichaOnBoard = useGameStore(
    (s) => s.spawnOrSyncFichaOnBoard
  );

  const [name1, setName1] = useState('...');
  const [name2, setName2] = useState('...');

  const id1 = playingFichaIds[0] || null;
  const id2 = playingFichaIds[1] || null;
  const isSolo = !id2;

  useEffect(() => {
    if (!id1) {
      setActiveScreen('fichas');
    }
  }, [id1, setActiveScreen]);

  const handleBringActiveToBoard = async () => {
    for (const fid of playingFichaIds) {
      if (fid) {
        await spawnOrSyncFichaOnBoard(fid, {
          placeOnBoard: true,
          updateExisting: true,
        });
      }
    }
    setActiveScreen('tabuleiro');
  };

  if (!id1) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--color-metal-800)',
      }}
    >
      {/* Barra superior da Mesa de Jogo */}
      <header
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          height: 40,
          padding: '0 12px',
          background: 'var(--color-terra-900)',
          borderBottom: '1px solid var(--color-dourado-700)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveScreen('fichas')}
          style={{
            padding: '5px 12px',
            fontFamily: 'var(--font-titulo1)',
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '0.9px',
            textTransform: 'uppercase',
            color: 'var(--color-pergaminho-300)',
            background: 'transparent',
            border: '1px solid var(--color-terra-500)',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          <ChevronLeft
            size={12}
            style={{ display: 'inline-block', verticalAlign: '-2px' }}
          />{' '}
          Fichas
        </button>

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-titulo1)',
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--color-dourado-300)',
              letterSpacing: '1px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name1}
          </span>
          {!isSolo && (
            <>
              <span style={{ color: 'var(--color-dourado-600)', fontSize: 12 }}>
                &#10022;
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-titulo1)',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: 'var(--color-dourado-300)',
                  letterSpacing: '1px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {name2}
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleBringActiveToBoard}
          title="Envia as fichas ativas da Mesa para o Tabuleiro Tático"
          style={{
            padding: '5px 12px',
            fontFamily: 'var(--font-titulo1)',
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            color: 'var(--color-dourado-200)',
            background: 'rgba(122, 80, 18, 0.38)',
            border: '1px solid var(--color-dourado-600)',
            borderRadius: 4,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <LayoutGrid size={12} /> Combate no Tabuleiro
        </button>
      </header>

      {/* Painel dividido (1 ou 2 fichas lado a lado com auto-save) */}
      <div
        style={{
          flex: '1 1 auto',
          display: 'flex',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flex: isSolo ? '1 1 100%' : '1 1 50%',
            minWidth: 0,
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <FichaSheet
            fichaId={id1}
            mode="jogar"
            onNameChanged={(n) => setName1(n)}
          />
        </div>

        {!isSolo && id2 && (
          <>
            <div
              style={{
                flex: '0 0 2px',
                background:
                  'linear-gradient(180deg, transparent, var(--color-dourado-600), var(--color-dourado-400), var(--color-dourado-600), transparent)',
              }}
            />
            <div
              style={{
                flex: '1 1 50%',
                minWidth: 0,
                height: '100%',
                overflow: 'hidden',
              }}
            >
              <FichaSheet
                fichaId={id2}
                mode="jogar"
                onNameChanged={(n) => setName2(n)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
