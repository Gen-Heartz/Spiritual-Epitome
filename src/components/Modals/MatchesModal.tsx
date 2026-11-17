import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  FolderOpen,
  HardDrive,
  Layers,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import {
  CharacterTemplateRecord,
  SavedMatchRecord,
  WeaponTemplateRecord,
} from '../../types';
import {
  deleteCharacterTemplate,
  deleteMatchRecord,
  deleteWeaponTemplate,
  exportStateToJSON,
  importStateFromJSON,
  listCharacterTemplates,
  listMatchRecords,
  listWeaponTemplates,
} from '../../db/database';
import { listarPastas, mapasDaPasta, mapasDoConjunto } from '../../maps/mapEngine';
import { TokenAvatar } from '../common/TokenAvatar';
import styles from './ModalShared.module.css';

export const MatchesModal: React.FC = () => {
  const modal = useGameStore((s) => s.matchesModal);
  const activeMatchId = useGameStore((s) => s.activeMatchId);
  const appState = useGameStore((s) => s.appState);
  const storageEstimate = useGameStore((s) => s.storageEstimate);

  const closeMatchesModal = useGameStore((s) => s.closeMatchesModal);
  const createNewMatch = useGameStore((s) => s.createNewMatch);
  const loadMatchState = useGameStore((s) => s.loadMatchState);
  const setMatchName = useGameStore((s) => s.setMatchName);
  const upsertCharacter = useGameStore((s) => s.upsertCharacter);
  const autoPlaceCharacter = useGameStore((s) => s.autoPlaceCharacter);
  const upsertWeapon = useGameStore((s) => s.upsertWeapon);
  const upsertAttack = useGameStore((s) => s.upsertAttack);
  const refreshStorageEstimate = useGameStore((s) => s.refreshStorageEstimate);
  const mapCatalog = useGameStore((s) => s.mapCatalog);
  const activeMapId = useGameStore((s) => s.activeMapId);
  const activeFolderId = useGameStore((s) => s.activeFolderId);
  const switchMap = useGameStore((s) => s.switchMap);
  const setActiveFolder = useGameStore((s) => s.setActiveFolder);
  const setActiveScreen = useGameStore((s) => s.setActiveScreen);
  const openMapFloorsModal = useGameStore((s) => s.openMapFloorsModal);
  const showToast = useGameStore((s) => s.showToast);

  const [tab, setTab] = useState<
    'matches' | 'templates' | 'export' | 'maps'
  >('matches');
  const [matches, setMatches] = useState<SavedMatchRecord[]>([]);
  const [charTemplates, setCharTemplates] = useState<CharacterTemplateRecord[]>([]);
  const [weaponTemplates, setWeaponTemplates] = useState<WeaponTemplateRecord[]>([]);

  const [newName, setNewName] = useState('Nova Batalha');
  const [newWidth, setNewWidth] = useState(20);
  const [newHeight, setNewHeight] = useState(15);
  const [importError, setImportError] = useState<string | null>(null);

  const importInputRef = useRef<HTMLInputElement | null>(null);

  const reloadLists = async () => {
    const [m, ct, wt] = await Promise.all([
      listMatchRecords(),
      listCharacterTemplates(),
      listWeaponTemplates(),
    ]);
    setMatches(m);
    setCharTemplates(ct);
    setWeaponTemplates(wt);
    await refreshStorageEstimate();
  };

  useEffect(() => {
    if (!modal.open) return;
    setTab(modal.initialTab);
    setImportError(null);
    reloadLists();
  }, [modal.open, modal.initialTab]);

  const pastasMapas = listarPastas(mapCatalog);
  const mapasConjunto = mapasDoConjunto(mapCatalog, activeMapId);

  if (!modal.open) return null;

  const handleExportJSON = async () => {
    try {
      const json = await exportStateToJSON(appState);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTitle = (appState.matchName || 'partida-rpg')
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-');
      a.href = url;
      a.download = `${safeTitle}-v1.0.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Partida exportada como arquivo JSON!');
    } catch (err: any) {
      showToast(err.message || 'Erro ao exportar JSON.');
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const imported = await importStateFromJSON(text);
      const newMatchId = `match_imp_${Date.now()}`;
      await loadMatchState(newMatchId, imported.matchName, imported);
      await reloadLists();
      showToast(`Partida "${imported.matchName}" importada com sucesso!`);
      closeMatchesModal();
    } catch (err: any) {
      setImportError(err.message || 'Falha ao importar JSON.');
    }
    e.target.value = '';
  };

  const spawnFromCharTemplate = (tpl: CharacterTemplateRecord) => {
    const id = `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    // Filtra apenas weaponIds existentes na partida atual
    const validWeapons = tpl.character.weaponIds.filter((wid) =>
      Boolean(appState.weapons[wid])
    );
    upsertCharacter({
      ...tpl.character,
      id,
      weaponIds: validWeapons,
      position: null,
    });
    autoPlaceCharacter(id);
    showToast(`"${tpl.name}" instanciado na partida!`);
    closeMatchesModal();
  };

  const spawnFromWeaponTemplate = (tpl: WeaponTemplateRecord) => {
    const newWeaponId = `wp_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const newAttackIds: string[] = [];

    for (const atk of tpl.attacks) {
      const newAtkId = `atk_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      upsertAttack({
        ...atk,
        id: newAtkId,
        area: {
          origin: { ...atk.area.origin },
          cells: atk.area.cells.map((c) => ({ ...c })),
        },
        effects: [...atk.effects],
      });
      newAttackIds.push(newAtkId);
    }

    upsertWeapon({
      ...tpl.weapon,
      id: newWeaponId,
      attackIds: newAttackIds,
    });
    showToast(`Arma "${tpl.name}" adicionada ao Arsenal da partida!`);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className={styles.backdrop} onClick={closeMatchesModal}>
      <div
        className={`${styles.modal} ${styles.modalWide}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.title}>
            <FolderOpen size={17} />
            <span>Partidas, Modelos Reutilizáveis & Persistência</span>
          </div>
          <button className={styles.closeBtn} onClick={closeMatchesModal}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {/* Navegação entre abas */}
          <div className={styles.chipRow}>
            <button
              type="button"
              className={`${styles.chip} ${
                tab === 'matches' ? styles.chipActive : ''
              }`}
              onClick={() => setTab('matches')}
            >
              Múltiplas Partidas ({matches.length})
            </button>
            <button
              type="button"
              className={`${styles.chip} ${
                tab === 'templates' ? styles.chipActive : ''
              }`}
              onClick={() => setTab('templates')}
            >
              Modelos de Personagens & Armas (
              {charTemplates.length + weaponTemplates.length})
            </button>
            <button
              type="button"
              className={`${styles.chip} ${
                tab === 'maps' ? styles.chipActive : ''
              }`}
              onClick={() => setTab('maps')}
            >
              Mapas &amp; Pastas ({mapasConjunto.length})
            </button>
            <button
              type="button"
              className={`${styles.chip} ${
                tab === 'export' ? styles.chipActive : ''
              }`}
              onClick={() => setTab('export')}
            >
              Exportar / Importar JSON & Armazenamento
            </button>
          </div>

          {/* ABA 1: MÚLTIPLAS PARTIDAS */}
          {tab === 'matches' && (
            <>
              <div className={styles.card}>
                <div className={styles.label}>Renomear Partida Atual</div>
                <input
                  className={styles.input}
                  value={appState.matchName}
                  onChange={(e) => setMatchName(e.target.value)}
                />
              </div>

              <div className={styles.card}>
                <div className={styles.label}>Criar Novo Tabuleiro / Partida</div>
                <div className={styles.row3}>
                  <div className={styles.field}>
                    <label className={styles.label}>Nome da Partida</label>
                    <input
                      className={styles.input}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Largura</label>
                    <input
                      type="number"
                      min={4}
                      max={80}
                      className={styles.input}
                      value={newWidth}
                      onChange={(e) => setNewWidth(Number(e.target.value))}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Altura</label>
                    <input
                      type="number"
                      min={4}
                      max={80}
                      className={styles.input}
                      value={newHeight}
                      onChange={(e) => setNewHeight(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={async () => {
                      await createNewMatch(
                        newName.trim() || 'Tabuleiro Limpo',
                        newWidth,
                        newHeight,
                        false
                      );
                      closeMatchesModal();
                    }}
                  >
                    <Plus size={14} />
                    <span>Criar Tabuleiro Limpo</span>
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={async () => {
                      await createNewMatch(
                        'Emboscada nas Ruínas Antigas',
                        20,
                        15,
                        true
                      );
                      closeMatchesModal();
                    }}
                  >
                    <Sparkles size={14} />
                    <span>Criar com Cenário Demonstrativo</span>
                  </button>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.label}>Partidas Salvas no Navegador</div>
                {matches.map((m) => {
                  const isCurrent = m.id === activeMatchId;
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: isCurrent
                          ? 'rgba(201, 166, 92, 0.14)'
                          : 'var(--bg-input)',
                        border: isCurrent
                          ? '1px solid var(--gold-primary)'
                          : '1px solid var(--border-subtle)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          {m.name} {isCurrent ? '(Ativa)' : ''}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          Grid {m.state.board.width}×{m.state.board.height} •{' '}
                          {Object.keys(m.state.characters).length} personagens •
                          Salvo em{' '}
                          {new Date(m.updatedAt).toLocaleString('pt-BR')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {!isCurrent && (
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            onClick={async () => {
                              await loadMatchState(m.id, m.name, m.state);
                              closeMatchesModal();
                            }}
                          >
                            Carregar
                          </button>
                        )}
                        {matches.length > 1 && !isCurrent && (
                          <button
                            type="button"
                            className={styles.btnDanger}
                            onClick={async () => {
                              await deleteMatchRecord(m.id);
                              reloadLists();
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ABA 2: MODELOS DE PERSONAGENS E ARMAS */}
          {tab === 'templates' && (
            <div className={styles.row2}>
              <div className={styles.card}>
                <div className={styles.label}>
                  Modelos de Personagens ({charTemplates.length})
                </div>
                {charTemplates.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Nenhum modelo salvo ainda. No painel de um personagem, clique em "Salvar Modelo".
                  </div>
                ) : (
                  charTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '7px 9px',
                        borderRadius: 6,
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TokenAvatar
                          imageId={tpl.character.imageId}
                          alt={tpl.name}
                          size={32}
                        />
                        <div>
                          <div style={{ fontWeight: 600 }}>{tpl.name}</div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--text-secondary)',
                            }}
                          >
                            HP {tpl.character.hpMax} • {tpl.character.width}×
                            {tpl.character.height} • Mov {tpl.character.movement}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          onClick={() => spawnFromCharTemplate(tpl)}
                        >
                          Usar
                        </button>
                        <button
                          type="button"
                          className={styles.btnDanger}
                          onClick={async () => {
                            await deleteCharacterTemplate(tpl.id);
                            reloadLists();
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className={styles.card}>
                <div className={styles.label}>
                  Modelos de Armas ({weaponTemplates.length})
                </div>
                {weaponTemplates.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Nenhum modelo de arma salvo ainda. No Arsenal, clique em "Modelo" para reutilizar armas e ataques entre partidas.
                  </div>
                ) : (
                  weaponTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '7px 9px',
                        borderRadius: 6,
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TokenAvatar
                          imageId={tpl.weapon.iconId}
                          alt={tpl.name}
                          size={32}
                        />
                        <div>
                          <div style={{ fontWeight: 600 }}>{tpl.name}</div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {tpl.weapon.category} • {tpl.attacks.length} ataques
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          onClick={() => spawnFromWeaponTemplate(tpl)}
                        >
                          Importar
                        </button>
                        <button
                          type="button"
                          className={styles.btnDanger}
                          onClick={async () => {
                            await deleteWeaponTemplate(tpl.id);
                            reloadLists();
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ABA 4: MAPAS & PASTAS (andares ligados da partida) */}
          {tab === 'maps' && (
            <>
              <div className={styles.card}>
                <div style={{ fontWeight: 700, color: 'var(--gold-bright)' }}>
                  Pasta de mapas ligados da partida
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  A pasta reúne os andares que comunicam por escadas. Ao carregar
                  um mapa, o tabuleiro passa a mostrar só as unidades desse
                  andar — as restantes ficam guardadas no andar delas.
                </div>

                <div className={styles.chipRow}>
                  {pastasMapas.map((p) => {
                    const qtd = mapasDaPasta(mapCatalog, p.id).length;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`${styles.chip} ${
                          p.id === activeFolderId ? styles.chipActive : ''
                        }`}
                        onClick={() => setActiveFolder(p.id)}
                        title={`Carregar a pasta "${p.nome}" (${qtd} mapas)`}
                      >
                        <Layers size={12} style={{ marginRight: 4 }} />
                        {p.nome} ({qtd})
                      </button>
                    );
                  })}
                  {pastasMapas.length === 0 && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Ainda não há pastas. Cria-as em Glossário → Locais →
                      Mapas.
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.label}>
                  Mapas do conjunto ativo ({mapasConjunto.length})
                </div>

                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 7 }}
                >
                  {mapasConjunto.map((m) => {
                    const atual = m.id === activeMapId;
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '8px 10px',
                          borderRadius: 6,
                          border: `1px solid ${
                            atual
                              ? 'var(--border-strong)'
                              : 'rgba(148,163,184,0.2)'
                          }`,
                          background: atual
                            ? 'rgba(201,166,92,0.12)'
                            : 'rgba(18,22,28,0.55)',
                        }}
                      >
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            minWidth: 0,
                          }}
                        >
                          {atual ? (
                            <MapPin size={14} color="#ecc050" />
                          ) : (
                            <Layers size={14} color="#94a3b8" />
                          )}
                          <span style={{ minWidth: 0 }}>
                            <div
                              style={{ fontSize: 12.5, fontWeight: 600 }}
                            >
                              {m.nome}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                              }}
                            >
                              {m.largura}×{m.altura} •{' '}
                              {m.stairs.some((st) => st.direction === 'up') && (
                                <ArrowUp
                                  size={10}
                                  color="#86efac"
                                  style={{ verticalAlign: 'middle' }}
                                />
                              )}
                              {m.stairs.some((st) => st.direction === 'down') && (
                                <ArrowDown
                                  size={10}
                                  color="#fca5a5"
                                  style={{ verticalAlign: 'middle' }}
                                />
                              )}
                              {m.stairs.length} escada
                              {m.stairs.length === 1 ? '' : 's'} •{' '}
                              {m.fog.mode === 'exploration'
                                ? `Névoa ${m.fog.range}q`
                                : 'Dia'}
                              {atual ? ' • em jogo' : ''}
                            </div>
                          </span>
                        </span>

                        <button
                          type="button"
                          className={styles.btnSecondary}
                          style={{ padding: '4px 10px', fontSize: 11 }}
                          onClick={() => {
                            if (!atual) switchMap(m.id);
                            closeMatchesModal();
                            setActiveScreen('tabuleiro');
                          }}
                          title={
                            atual
                              ? 'Ir para o tabuleiro neste mapa'
                              : `Carregar "${m.nome}" no tabuleiro`
                          }
                        >
                          {atual ? <Check size={12} /> : <Layers size={12} />}
                          <span>{atual ? 'Em jogo' : 'Carregar'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => {
                      closeMatchesModal();
                      openMapFloorsModal();
                    }}
                  >
                    <Layers size={13} />
                    <span>Ver todos os andares</span>
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => {
                      closeMatchesModal();
                      setActiveScreen('glossario_mapas');
                    }}
                  >
                    <FolderOpen size={13} />
                    <span>Editar mapas &amp; pastas</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ABA 3: EXPORTAR / IMPORTAR JSON E MONITORAMENTO DE STORAGE */}
          {tab === 'export' && (
            <>
              <div className={styles.row2}>
                <div className={styles.card}>
                  <div style={{ fontWeight: 700, color: 'var(--gold-bright)' }}>
                    Exportar Partida Completa (JSON v1.0)
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Gera um arquivo JSON versionado contendo tabuleiro, terrenos, personagens, armas, ataques, imagens recortadas e estado do combate.
                  </div>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={handleExportJSON}
                  >
                    <Download size={15} />
                    <span>Baixar Arquivo JSON</span>
                  </button>
                </div>

                <div className={styles.card}>
                  <div style={{ fontWeight: 700, color: 'var(--gold-bright)' }}>
                    Importar Partida de Arquivo JSON
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Carrega um arquivo JSON exportado anteriormente, restaurando inclusive as imagens dos personagens no IndexedDB.
                  </div>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => importInputRef.current?.click()}
                  >
                    <Upload size={15} />
                    <span>Selecionar Arquivo JSON</span>
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    style={{ display: 'none' }}
                    onChange={handleImportJSON}
                  />
                  {importError && (
                    <div style={{ color: '#f87171', fontSize: 12 }}>
                      {importError}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.card}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span className={styles.label}>
                    <HardDrive size={13} style={{ marginRight: 5 }} />
                    Monitoramento de Armazenamento Local (IndexedDB)
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {formatBytes(storageEstimate.usage)} /{' '}
                    {storageEstimate.quota
                      ? formatBytes(storageEstimate.quota)
                      : 'Disponível'}{' '}
                    ({storageEstimate.percent.toFixed(2)}%)
                  </span>
                </div>

                <div
                  style={{
                    height: 10,
                    borderRadius: 5,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, storageEstimate.percent)}%`,
                      background: storageEstimate.warning
                        ? '#ef4444'
                        : '#22c55e',
                    }}
                  />
                </div>
                {storageEstimate.warning && (
                  <div className={styles.warnNote}>
                    Atenção: o armazenamento local ultrapassou 80% da capacidade estimada do navegador. Exporte backups em JSON e remova partidas antigas se necessário.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={closeMatchesModal}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
