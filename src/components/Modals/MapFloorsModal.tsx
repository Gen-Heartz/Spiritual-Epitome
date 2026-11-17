import React, { useMemo } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  FolderOpen,
  Layers,
  Lock,
  MapPin,
  Moon,
  Sun,
  X,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import {
  listarPastas,
  mapasDaPasta,
  mapasDoConjunto,
  vizinhosDeAndar,
} from '../../maps/mapEngine';
import styles from './ModalShared.module.css';

/**
 * Janela "todos os mapas": lista completa da pasta/andar do mapa ativo.
 * É aberta pelo seletor de andares da barra superior.
 */
export const MapFloorsModal: React.FC = () => {
  const open = useGameStore((s) => s.mapFloorsModalOpen);
  const close = useGameStore((s) => s.closeMapFloorsModal);
  const mapCatalog = useGameStore((s) => s.mapCatalog);
  const activeMapId = useGameStore((s) => s.activeMapId);
  const activeFolderId = useGameStore((s) => s.activeFolderId);
  const switchMap = useGameStore((s) => s.switchMap);
  const setActiveFolder = useGameStore((s) => s.setActiveFolder);

  const pastas = useMemo(() => listarPastas(mapCatalog), [mapCatalog]);
  const mapas = useMemo(
    () => mapasDoConjunto(mapCatalog, activeMapId),
    [mapCatalog, activeMapId]
  );
  const vizinhos = useMemo(
    () => vizinhosDeAndar(mapCatalog, activeMapId),
    [mapCatalog, activeMapId]
  );
  const pastaAtiva = activeFolderId ? mapCatalog.folders[activeFolderId] : null;

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={close}>
      <div
        className={`${styles.modal} ${styles.modalWide}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.title}>
            <Layers size={17} />
            <span>Andares &amp; Mapas Ligados</span>
          </div>
          <button className={styles.closeBtn} onClick={close}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderOpen size={15} color="#ecc050" />
              <span style={{ fontWeight: 700, color: 'var(--gold-bright)' }}>
                {pastaAtiva ? pastaAtiva.nome : 'Sem pasta'}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                {pastaAtiva?.descricao || 'Mapas ligados por escadas'}
              </span>
            </div>

            {pastas.length > 0 && (
              <div className={styles.chipRow} style={{ marginTop: 10 }}>
                {pastas.map((p) => {
                  const qtd = mapasDaPasta(mapCatalog, p.id).length;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`${styles.chip} ${
                        p.id === activeFolderId ? styles.chipActive : ''
                      }`}
                      onClick={() => setActiveFolder(p.id)}
                      title={`${qtd} mapa(s) nesta pasta`}
                    >
                      {p.nome} ({qtd})
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`${styles.chip} ${
                    !activeFolderId ? styles.chipActive : ''
                  }`}
                  onClick={() => setActiveFolder(null)}
                >
                  Sem pasta
                </button>
              </div>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.label}>
              Mapas deste conjunto ({mapas.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mapas.map((m) => {
                const atual = m.id === activeMapId;
                const ehAcima = vizinhos.acima?.id === m.id;
                const ehAbaixo = vizinhos.abaixo?.id === m.id;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (!atual) switchMap(m.id);
                      close();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 6,
                      border: `1px solid ${
                        atual
                          ? 'var(--border-strong)'
                          : 'rgba(148,163,184,0.22)'
                      }`,
                      background: atual
                        ? 'rgba(201,166,92,0.14)'
                        : 'rgba(18,22,28,0.6)',
                      color: 'inherit',
                      cursor: atual ? 'default' : 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                    title={atual ? 'Mapa ativo' : `Ir para "${m.nome}"`}
                  >
                    <span
                      style={{ display: 'flex', alignItems: 'center', gap: 9 }}
                    >
                      {atual ? (
                        <MapPin size={15} color="#ecc050" />
                      ) : (
                        <Layers size={15} color="#94a3b8" />
                      )}
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                          {m.nome}
                          {ehAcima && (
                            <span
                              style={{
                                marginLeft: 7,
                                fontSize: 10.5,
                                color: '#86efac',
                              }}
                            >
                              andar superior
                            </span>
                          )}
                          {ehAbaixo && (
                            <span
                              style={{
                                marginLeft: 7,
                                fontSize: 10.5,
                                color: '#fca5a5',
                              }}
                            >
                              andar inferior
                            </span>
                          )}
                        </span>
                        <span
                          style={{ fontSize: 11, color: 'var(--text-muted)' }}
                        >
                          {m.largura}×{m.altura} • {m.stairs.length} escada
                          {m.stairs.length === 1 ? '' : 's'}
                          {m.descricao ? ` • ${m.descricao}` : ''}
                        </span>
                      </span>
                    </span>

                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        flexShrink: 0,
                      }}
                    >
                      {m.fog.mode === 'exploration' ? (
                        <Moon size={12} />
                      ) : (
                        <Sun size={12} />
                      )}
                      {m.fog.mode === 'exploration'
                        ? `${m.fog.range} quad.`
                        : 'Dia'}
                      {m.fog.locked && <Lock size={11} />}
                      {m.stairs.some((st) => st.direction === 'up') && (
                        <ArrowUp size={12} color="#86efac" />
                      )}
                      {m.stairs.some((st) => st.direction === 'down') && (
                        <ArrowDown size={12} color="#fca5a5" />
                      )}
                      {atual && <Check size={14} color="#ecc050" />}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 11,
                color: 'var(--text-muted)',
              }}
            >
              Os mapas de uma pasta são os andares ligados entre si. Cria e
              organiza pastas em Glossário → Locais → Mapas.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
