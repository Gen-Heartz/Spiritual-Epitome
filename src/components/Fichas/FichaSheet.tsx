import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import {
  AnguloMagicoStr,
  ArmaTipoKey,
  CircSimbolo,
  EpitomeFicha,
  LinhagemKey,
  PericiaKey,
  SlotKey,
} from '../../epitome/epitomeTypes';
import {
  ANGULOS_OPCOES,
  ARMA_TIPO_LABELS,
  calcularFicha,
  criarFichaEmBranco,
  equiparArmaDoArsenalNaFicha,
  inferEpitomeTipoFromWeapon,
  LINHAGEM_LABELS,
  normalizarFicha,
  PERICIAS_GRUPOS,
  SLOTS_EXTERNOS,
  SLOTS_INTERNOS,
  sugerirEmblemaPorFicha,
} from '../../epitome/epitomeEngine';
import { getFicha } from '../../db/database';
import { useGameStore } from '../../store/useGameStore';
import {
  EMBLEM_PRESETS,
  importAndProcessImageFile,
} from '../../utils/imageProcessor';
import { TokenAvatar } from '../common/TokenAvatar';
import styles from './FichaSheet.module.css';

type FichaTab =
  | 'identidade'
  | 'pericias'
  | 'campos'
  | 'combate'
  | 'magia'
  | 'inventario';

interface TooltipBadgeProps {
  text: string;
}

const TooltipBadge: React.FC<TooltipBadgeProps> = ({ text }) => {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={styles.tooltipWrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen((v) => !v);
      }}
    >
      <span className={styles.tooltipTrigger}>?</span>
      {open && <span className={styles.tooltipBubble}>{text}</span>}
    </span>
  );
};

export interface FichaSheetProps {
  fichaId: string | null;
  mode: 'editor' | 'jogar' | 'modal';
  onBack?: () => void;
  onNameChanged?: (name: string) => void;
}

export const FichaSheet: React.FC<FichaSheetProps> = ({
  fichaId,
  mode,
  onBack,
  onNameChanged,
}) => {
  const arsenalCatalog = useGameStore((s) => s.arsenalCatalog);
  const saveFichaRecord = useGameStore((s) => s.saveFichaRecord);
  const spawnOrSyncFichaOnBoard = useGameStore(
    (s) => s.spawnOrSyncFichaOnBoard
  );
  const setActiveScreen = useGameStore((s) => s.setActiveScreen);
  const openArsenalModal = useGameStore((s) => s.openArsenalModal);
  const setQuickSheetFichaId = useGameStore((s) => s.setQuickSheetFichaId);
  const showToast = useGameStore((s) => s.showToast);

  const [tab, setTab] = useState<FichaTab>('identidade');
  const [ficha, setFicha] = useState<EpitomeFicha>(() => criarFichaEmBranco());
  const [loaded, setLoaded] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [selectedArsenalToAdd, setSelectedArsenalToAdd] = useState<string>('');

  // Inputs de ação nos 4 Campos (Enter aplica e limpa, exatamente como no Spiritual-Epitome)
  const [vidaPerdidaIn, setVidaPerdidaIn] = useState('');
  const [vidaVendidaIn, setVidaVendidaIn] = useState('');
  const [descCustomIn, setDescCustomIn] = useState('');
  const [manaVendidaIn, setManaVendidaIn] = useState('');
  const [estaminaGastoIn, setEstaminaGastoIn] = useState('');
  const [estaminaRecIn, setEstaminaRecIn] = useState('');
  const [racGastoIn, setRacGastoIn] = useState('');
  const [racRecIn, setRacRecIn] = useState('');

  const [openSlotPopup, setOpenSlotPopup] = useState<'int' | 'ext' | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    if (!fichaId) {
      const fresh = criarFichaEmBranco();
      setFicha(fresh);
      setLoaded(true);
      onNameChanged?.(fresh.nome || 'Sem nome');
      return;
    }
    getFicha(fichaId).then((found) => {
      if (cancelled) return;
      const target = found ? normalizarFicha(found) : criarFichaEmBranco();
      setFicha(target);
      setLoaded(true);
      onNameChanged?.(target.nome || 'Sem nome');
    });
    return () => {
      cancelled = true;
    };
  }, [fichaId]);

  const stats = useMemo(() => calcularFicha(ficha), [ficha]);

  // Armas independentes do Arsenal (Glossário -> Armas) disponíveis para guardar na Mochila
  const allArsenalWeapons = useMemo(
    () =>
      Object.values(arsenalCatalog.weapons).filter(
        (wp) => !wp.id.startsWith('wp_ep_')
      ),
    [arsenalCatalog.weapons]
  );

  const availableArsenalToAdd = useMemo(
    () =>
      allArsenalWeapons.filter((wp) => !ficha.mochilaArmasIds.includes(wp.id)),
    [allArsenalWeapons, ficha.mochilaArmasIds]
  );

  useEffect(() => {
    if (
      selectedArsenalToAdd &&
      availableArsenalToAdd.some((w) => w.id === selectedArsenalToAdd)
    ) {
      return;
    }
    setSelectedArsenalToAdd(availableArsenalToAdd[0]?.id || '');
  }, [availableArsenalToAdd, selectedArsenalToAdd]);

  const mochilaWeapons = useMemo(
    () =>
      ficha.mochilaArmasIds
        .map((id) => arsenalCatalog.weapons[id])
        .filter((w): w is NonNullable<typeof w> => Boolean(w)),
    [ficha.mochilaArmasIds, arsenalCatalog.weapons]
  );

  const persistAutoIfNeeded = (nextFicha: EpitomeFicha) => {
    if (mode !== 'jogar' && mode !== 'modal') return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveFichaRecord(nextFicha, true);
    }, 320);
  };

  const updateFicha = (updater: (prev: EpitomeFicha) => EpitomeFicha) => {
    setFicha((prev) => {
      const updated = updater(prev);
      if (updated.nome !== prev.nome) {
        onNameChanged?.(updated.nome || 'Sem nome');
      }
      persistAutoIfNeeded(updated);
      return updated;
    });
  };

  const handleManualSave = async () => {
    const saved = await saveFichaRecord(ficha, true);
    setFicha(saved);
    setSavedFeedback(true);
    showToast(`Ficha "${saved.nome || 'Sem nome'}" salva!`);
    setTimeout(() => setSavedFeedback(false), 1500);
    return saved;
  };

  const handleSaveAndSendToBoard = async () => {
    const saved = await handleManualSave();
    await spawnOrSyncFichaOnBoard(saved.id, {
      placeOnBoard: true,
      updateExisting: true,
    });
    setActiveScreen('tabuleiro');
  };

  // === Handlers da Zona de Armas na Mochila ===
  const handleAddWeaponToMochila = () => {
    const wp = arsenalCatalog.weapons[selectedArsenalToAdd];
    if (!wp) return;
    updateFicha((prev) => {
      if (prev.mochilaArmasIds.includes(wp.id)) return prev;
      // Se ainda não houver nenhuma arma equipada, equipa automaticamente a primeira adicionada
      if (!prev.armaEquipadaId && !prev.nomeArma.trim()) {
        return equiparArmaDoArsenalNaFicha(
          { ...prev, mochilaArmasIds: [...prev.mochilaArmasIds, wp.id] },
          wp
        );
      }
      return {
        ...prev,
        mochilaArmasIds: [...prev.mochilaArmasIds, wp.id],
      };
    });
    showToast(`"${wp.name}" adicionada à Zona de Armas da Mochila!`);
  };

  const handleToggleEquipMochilaWeapon = (weaponId: string) => {
    const wp = arsenalCatalog.weapons[weaponId];
    if (!wp) return;
    const isCurrentlyEquipped = ficha.armaEquipadaId === weaponId;
    updateFicha((prev) =>
      isCurrentlyEquipped
        ? equiparArmaDoArsenalNaFicha(prev, null)
        : equiparArmaDoArsenalNaFicha(prev, wp)
    );
    showToast(
      isCurrentlyEquipped
        ? `"${wp.name}" desequipada.`
        : `"${wp.name}" equipada! Aba Combate atualizada.`
    );
  };

  const handleRemoveWeaponFromMochila = (weaponId: string) => {
    const wp = arsenalCatalog.weapons[weaponId];
    updateFicha((prev) => {
      const nextIds = prev.mochilaArmasIds.filter((id) => id !== weaponId);
      if (prev.armaEquipadaId === weaponId) {
        return {
          ...equiparArmaDoArsenalNaFicha(prev, null),
          mochilaArmasIds: nextIds,
        };
      }
      return { ...prev, mochilaArmasIds: nextIds };
    });
    if (wp) {
      showToast(`"${wp.name}" removida da Mochila.`);
    }
  };

  const handleOpenArsenalFromSheet = async () => {
    if (mode === 'modal') {
      await saveFichaRecord(ficha, true);
      setQuickSheetFichaId(null);
      openArsenalModal(ficha.armaEquipadaId || null, null);
      return;
    }
    if (mode === 'editor') {
      await saveFichaRecord(ficha, true);
    }
    setActiveScreen('glossario_armas');
  };

  useEffect(() => {
    if (mode !== 'editor') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, ficha]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imgId = await importAndProcessImageFile(file);
      updateFicha((p) => ({ ...p, avatarImageId: imgId }));
      showToast('Retrato circular 256×256 vinculado à ficha!');
    } catch (err: any) {
      showToast(err.message || 'Falha ao importar imagem.');
    }
    e.target.value = '';
  };

  // === Handlers dos 4 Campos ===
  const applyVidaPerdida = () => {
    const v = parseFloat(vidaPerdidaIn) || 0;
    setVidaPerdidaIn('');
    if (v === 0) return;
    updateFicha((prev) => {
      const s = calcularFicha(prev);
      const nova = Math.max(
        0,
        Math.min(s.vidaEfetivaMax, s.vidaAtual - v)
      );
      return { ...prev, _estado: { ...prev._estado, vidaAtual: nova } };
    });
  };

  const applyVidaVendida = () => {
    const v = parseFloat(vidaVendidaIn) || 0;
    setVidaVendidaIn('');
    if (v === 0) return;
    updateFicha((prev) => {
      const s = calcularFicha(prev);
      const vendida = Math.max(
        0,
        Math.min(s.vidaTotal - 1, prev._estado.vidaVendida + v)
      );
      const novoMax = Math.max(0, s.vidaTotal - vendida);
      return {
        ...prev,
        _estado: {
          ...prev._estado,
          vidaVendida: vendida,
          vidaAtual: Math.min(prev._estado.vidaAtual, novoMax),
        },
      };
    });
  };

  const applyRecuperarVida = (valor: number) => {
    if (!valor) return;
    updateFicha((prev) => {
      const s = calcularFicha(prev);
      const nova = Math.max(
        0,
        Math.min(s.vidaEfetivaMax, s.vidaAtual + valor)
      );
      return { ...prev, _estado: { ...prev._estado, vidaAtual: nova } };
    });
  };

  const applyManaVendida = () => {
    const v = parseFloat(manaVendidaIn) || 0;
    setManaVendidaIn('');
    if (v === 0) return;
    updateFicha((prev) => {
      const s = calcularFicha(prev);
      const vendida = Math.max(
        0,
        Math.min(s.manaTotal - 1, prev._estado.manaVendida + v)
      );
      return { ...prev, _estado: { ...prev._estado, manaVendida: vendida } };
    });
  };

  const applyEstaminaGasto = () => {
    const v = parseFloat(estaminaGastoIn) || 0;
    setEstaminaGastoIn('');
    if (v <= 0) return;
    updateFicha((prev) => {
      const s = calcularFicha(prev);
      const gastoEfetivo = Math.min(v, s.estaminaMaxGasto);
      const nova = Math.max(0, s.estaminaAtual - gastoEfetivo);
      return { ...prev, _estado: { ...prev._estado, estaminaAtual: nova } };
    });
  };

  const applyEstaminaRecuperar = () => {
    const raw = estaminaRecIn.trim();
    setEstaminaRecIn('');
    updateFicha((prev) => {
      const s = calcularFicha(prev);
      const ganho =
        raw === '' ? s.estaminaRecuperarPadrao : parseFloat(raw) || 0;
      const nova = Math.max(
        0,
        Math.min(s.estaminaTotal, s.estaminaAtual + ganho)
      );
      return { ...prev, _estado: { ...prev._estado, estaminaAtual: nova } };
    });
  };

  const applyRacGasto = () => {
    const v = parseFloat(racGastoIn) || 0;
    setRacGastoIn('');
    if (v <= 0) return;
    updateFicha((prev) => {
      const s = calcularFicha(prev);
      const nova = Math.max(0, s.racAtual - v);
      return { ...prev, _estado: { ...prev._estado, racAtual: nova } };
    });
  };

  const applyRacRecuperar = () => {
    const raw = racRecIn.trim();
    setRacRecIn('');
    updateFicha((prev) => {
      const s = calcularFicha(prev);
      const ganho = raw === '' ? s.racRecuperarPadrao : parseFloat(raw) || 0;
      const nova = Math.max(0, Math.min(s.racTotal, s.racAtual + ganho));
      return { ...prev, _estado: { ...prev._estado, racAtual: nova } };
    });
  };

  if (!loaded) {
    return (
      <div className={styles.compactWrapper}>
        <p style={{ textAlign: 'center', color: 'var(--color-pergaminho-400)' }}>
          Carregando pergaminho...
        </p>
      </div>
    );
  }

  const setPericia = (key: PericiaKey, rawVal: number) => {
    const clamped = Math.max(0, Math.min(10, Math.round(rawVal || 0)));
    updateFicha((prev) => {
      const next: EpitomeFicha = {
        ...prev,
        _pericias: {
          ...prev._pericias,
          [key]: clamped,
        },
      };
      // Se Vigor/Tolerância/Concentração aumentaram, mantém recursos dentro dos novos tetos
      const prevStats = calcularFicha(prev);
      const nextStats = calcularFicha(next);
      const nextEstado = { ...next._estado };
      if (prevStats.vidaAtual === prevStats.vidaEfetivaMax) {
        nextEstado.vidaAtual = nextStats.vidaEfetivaMax;
      } else {
        nextEstado.vidaAtual = Math.min(
          nextEstado.vidaAtual,
          nextStats.vidaEfetivaMax
        );
      }
      if (prevStats.estaminaAtual === prevStats.estaminaTotal) {
        nextEstado.estaminaAtual = nextStats.estaminaTotal;
      } else {
        nextEstado.estaminaAtual = Math.min(
          nextEstado.estaminaAtual,
          nextStats.estaminaTotal
        );
      }
      if (prevStats.racAtual === prevStats.racTotal) {
        nextEstado.racAtual = nextStats.racTotal;
      } else {
        nextEstado.racAtual = Math.min(nextEstado.racAtual, nextStats.racTotal);
      }
      return { ...next, _estado: nextEstado };
    });
  };

  const setSlotText = (slot: SlotKey, val: string) => {
    updateFicha((prev) => ({
      ...prev,
      _slots: { ...prev._slots, [slot]: val },
    }));
  };

  const setSlotCost = (slot: SlotKey, val: number) => {
    updateFicha((prev) => ({
      ...prev,
      _slotCustos: {
        ...prev._slotCustos,
        [slot]: Math.max(0, Math.round(val || 0)),
      },
    }));
  };

  const wrapperClass =
    mode === 'editor' ? styles.pageWrapper : styles.compactWrapper;

  return (
    <div className={wrapperClass} onClick={() => setOpenSlotPopup(null)}>
      <div className={styles.container}>
        {/* Navegação das 6 Abas */}
        <nav className={styles.tabsNav} aria-label="Abas da Ficha">
          {(
            [
              ['identidade', 'Identidade'],
              ['pericias', 'Perícias'],
              ['campos', 'Campos'],
              ['combate', 'Combate'],
              ['magia', 'Magia'],
              ['inventario', 'Inventário'],
            ] as Array<[FichaTab, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`${styles.tabBtn} ${
                tab === id ? styles.tabBtnActive : ''
              }`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* ===================== ABA 1: IDENTIDADE ===================== */}
        {tab === 'identidade' && (
          <section className={styles.panelFrame}>
            <div className={`${styles.corner} ${styles.cornerTl}`} />
            <div className={`${styles.corner} ${styles.cornerTr}`} />
            <div className={`${styles.corner} ${styles.cornerBl}`} />
            <div className={`${styles.corner} ${styles.cornerBr}`} />

            <header className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Identidade &amp; Registros</h2>
              <p className={styles.panelSubtitle}>A Essência do Herói</p>
            </header>
            <hr className={`divisor-dourado ${styles.divider}`} />

            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                Nome do Jogador <TooltipBadge text="Nome real do jogador." />
              </label>
              <input
                type="text"
                className={styles.input}
                placeholder="Ex: João Silva"
                maxLength={60}
                value={ficha.nomeJogador}
                onChange={(e) =>
                  updateFicha((p) => ({ ...p, nomeJogador: e.target.value }))
                }
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                Nome do Personagem{' '}
                <TooltipBadge text="Nome fictício do herói ou vilão." />
              </label>
              <input
                type="text"
                className={`${styles.input} ${styles.inputLarge}`}
                placeholder="Ex: Kael, o Andarilho"
                maxLength={60}
                value={ficha.nome}
                onChange={(e) =>
                  updateFicha((p) => ({ ...p, nome: e.target.value }))
                }
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                Conceito / História{' '}
                <TooltipBadge text="Breve descrição e origem do personagem." />
              </label>
              <textarea
                className={styles.textarea}
                placeholder="Ex: Mercenário solitário..."
                rows={4}
                maxLength={600}
                value={ficha.conceito}
                onChange={(e) =>
                  updateFicha((p) => ({ ...p, conceito: e.target.value }))
                }
              />
            </div>

            <hr className={`divisor-dourado ${styles.divider}`} />

            <div className={styles.row2}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  Linhagem{' '}
                  <TooltipBadge text="Define a origem da energia sobrenatural do personagem." />
                </label>
                <select
                  className={styles.select}
                  value={ficha.linhagem}
                  onChange={(e) =>
                    updateFicha((p) => ({
                      ...p,
                      linhagem: e.target.value as LinhagemKey,
                    }))
                  }
                >
                  <option value="">-- Escolha --</option>
                  <option value="pungente">Pungente</option>
                  <option value="erudita">Erudita</option>
                  <option value="agraco">Agraço</option>
                  <option value="desperta">Desperta</option>
                  <option value="espectro">Espectro</option>
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  Tribo <TooltipBadge text="Facção ou clã do personagem." />
                </label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Ex: Filhos do Crepúsculo"
                  maxLength={60}
                  value={ficha.tribo}
                  onChange={(e) =>
                    updateFicha((p) => ({ ...p, tribo: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className={styles.linhagemBox}>
              <span
                className={`${styles.linhagemBadge} ${
                  ficha.linhagem
                    ? (styles as any)[`linhagem_${ficha.linhagem}`] || ''
                    : ''
                }`}
              >
                {LINHAGEM_LABELS[ficha.linhagem]}
              </span>
            </div>

            {/* Token do Tabuleiro */}
            <div className={styles.avatarRow}>
              <TokenAvatar
                imageId={sugerirEmblemaPorFicha(ficha)}
                alt={ficha.nome || 'Token'}
                size={48}
                borderColor="#ecc050"
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span className={`${styles.label} ${styles.labelSm}`}>
                    Token para o Tabuleiro Tático
                  </span>
                  <button
                    type="button"
                    className={styles.smallActionBtn}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload
                      size={11}
                      style={{ marginRight: 4, verticalAlign: 'middle' }}
                    />
                    Enviar Foto
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div className={styles.emblemChips}>
                  {EMBLEM_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`${styles.emblemChip} ${
                        sugerirEmblemaPorFicha(ficha) === p.id
                          ? styles.emblemChipActive
                          : ''
                      }`}
                      onClick={() =>
                        updateFicha((prev) => ({
                          ...prev,
                          avatarImageId: p.id,
                        }))
                      }
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ===================== ABA 2: PERÍCIAS ===================== */}
        {tab === 'pericias' && (
          <section className={styles.panelFrame}>
            <div className={`${styles.corner} ${styles.cornerTl}`} />
            <div className={`${styles.corner} ${styles.cornerTr}`} />
            <div className={`${styles.corner} ${styles.cornerBl}`} />
            <div className={`${styles.corner} ${styles.cornerBr}`} />

            <header className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Matriz de Perícias</h2>
              <p className={styles.panelSubtitle}>Organizada por Tríades</p>
            </header>
            <hr className={`divisor-dourado ${styles.divider}`} />

            <div className={styles.row4}>
              <div className={styles.fieldGroup}>
                <label className={`${styles.label} ${styles.labelSm}`}>
                  Nível{' '}
                  <TooltipBadge text="Nível do personagem. Perícias Totais = 6 + (Nível × 3)." />
                </label>
                <input
                  type="number"
                  min={0}
                  className={`${styles.input} ${styles.inputCenter}`}
                  value={ficha.nivel}
                  onChange={(e) =>
                    updateFicha((p) => ({
                      ...p,
                      nivel: Math.max(0, parseInt(e.target.value, 10) || 0),
                    }))
                  }
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={`${styles.label} ${styles.labelSm}`}>
                  XP{' '}
                  <TooltipBadge text="Experiência acumulada. Auxilia o mestre a decidir quando subir de nível." />
                </label>
                <input
                  type="number"
                  min={0}
                  className={`${styles.input} ${styles.inputCenter}`}
                  value={ficha.xp}
                  onChange={(e) =>
                    updateFicha((p) => ({
                      ...p,
                      xp: Math.max(0, parseInt(e.target.value, 10) || 0),
                    }))
                  }
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={`${styles.label} ${styles.labelSm}`}>
                  Totais{' '}
                  <TooltipBadge text="Total de pontos de perícia disponíveis = 6 + (Nível × 3)." />
                </label>
                <input
                  type="number"
                  readOnly
                  className={`${styles.input} ${styles.inputCenter} ${styles.inputReadonly}`}
                  value={stats.periciasTotais}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={`${styles.label} ${styles.labelSm}`}>
                  Restantes{' '}
                  <TooltipBadge text="Pontos de perícia ainda não distribuídos. Fica vermelho se negativo." />
                </label>
                <input
                  type="number"
                  readOnly
                  className={`${styles.input} ${styles.inputCenter} ${
                    styles.inputReadonly
                  } ${stats.periciasRestantes < 0 ? styles.inputNegative : ''}`}
                  value={stats.periciasRestantes}
                />
              </div>
            </div>

            <hr className={`divisor-dourado ${styles.divider}`} />

            <div className={styles.triadsGrid}>
              {PERICIAS_GRUPOS.map((grupo) => (
                <div key={grupo.id} className={styles.triadCard}>
                  <h3 className={styles.triadTitle}>{grupo.titulo}</h3>
                  {grupo.pericias.map((per) => {
                    const val = ficha._pericias[per.key] || 0;
                    return (
                      <div key={per.key} className={styles.periciaRow}>
                        <div className={styles.periciaInfo}>
                          <span className={styles.periciaName}>{per.label}</span>
                          <span className={styles.periciaType}>{per.tipo}</span>
                          <TooltipBadge text={per.tooltip} />
                        </div>
                        <div className={styles.periciaValues}>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            className={styles.periciaInput}
                            value={val}
                            onChange={(e) =>
                              setPericia(per.key, Number(e.target.value))
                            }
                          />
                          <span style={{ color: 'var(--color-pergaminho-600)' }}>
                            &#8594;
                          </span>
                          <span className={styles.periciaMod}>
                            {val >= 0 ? `+${val}` : val}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===================== ABA 3: OS 4 CAMPOS ===================== */}
        {tab === 'campos' && (
          <section className={styles.panelFrame}>
            <div className={`${styles.corner} ${styles.cornerTl}`} />
            <div className={`${styles.corner} ${styles.cornerTr}`} />
            <div className={`${styles.corner} ${styles.cornerBl}`} />
            <div className={`${styles.corner} ${styles.cornerBr}`} />

            <header className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Os 4 Campos</h2>
              <p className={styles.panelSubtitle}>Recursos Vitais</p>
            </header>
            <hr className={`divisor-dourado ${styles.divider}`} />

            <div className={styles.camposGrid}>
              {/* 1. VIDA */}
              <div className={styles.campoBloco}>
                <label className={styles.label}>
                  Vida{' '}
                  <TooltipBadge text="Total = 10 + Bônus Circulação + (Vigor × 3). Perdida: Enter aplica dano (negativo = cura). Vendida: Enter aplica (negativo cancela)." />
                </label>
                <div className={styles.recursoDisplay}>
                  <div className={styles.recursoCelula}>
                    <span className={styles.recursoRotulo}>Total</span>
                    <span className={styles.recursoValor}>{stats.vidaTotal}</span>
                  </div>
                  <div
                    className={`${styles.recursoCelula} ${styles.recursoCelulaDestaque}`}
                  >
                    <span className={styles.recursoRotulo}>Atual</span>
                    <span className={`${styles.recursoValor} ${styles.valVida}`}>
                      {stats.vidaAtual}
                    </span>
                  </div>
                </div>

                <div className={styles.row2}>
                  <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                    <label className={`${styles.label} ${styles.labelSm}`}>
                      Perdida{' '}
                      <TooltipBadge text="Dano recebido. Enter aplica e limpa. Negativo = cura." />
                    </label>
                    <input
                      type="number"
                      className={`${styles.input} ${styles.inputCenter}`}
                      placeholder="Enter..."
                      value={vidaPerdidaIn}
                      onChange={(e) => setVidaPerdidaIn(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && applyVidaPerdida()}
                    />
                  </div>
                  <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                    <label className={`${styles.label} ${styles.labelSm}`}>
                      Vendida ({ficha._estado.vidaVendida}){' '}
                      <TooltipBadge text="Vender vida permanentemente. Negativo cancela." />
                    </label>
                    <input
                      type="number"
                      className={`${styles.input} ${styles.inputCenter}`}
                      placeholder="Enter..."
                      value={vidaVendidaIn}
                      onChange={(e) => setVidaVendidaIn(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && applyVidaVendida()}
                    />
                  </div>
                </div>

                <label className={`${styles.label} ${styles.labelSm}`}>
                  Descanso
                </label>
                <div className={styles.smallBtnRow}>
                  <button
                    type="button"
                    className={styles.smallActionBtn}
                    title={`Recupera ${stats.descansoCurto} de Vida (Vigor)`}
                    onClick={() => applyRecuperarVida(stats.descansoCurto)}
                  >
                    Curto (+{stats.descansoCurto})
                  </button>
                  <button
                    type="button"
                    className={styles.smallActionBtn}
                    title={`Recupera ${stats.descansoMedio} de Vida (Vigor × 2)`}
                    onClick={() => applyRecuperarVida(stats.descansoMedio)}
                  >
                    Médio (+{stats.descansoMedio})
                  </button>
                  <button
                    type="button"
                    className={styles.smallActionBtn}
                    title={`Recupera ${stats.descansoLongo} de Vida (Vigor × 3)`}
                    onClick={() => applyRecuperarVida(stats.descansoLongo)}
                  >
                    Longo (+{stats.descansoLongo})
                  </button>
                </div>
                <input
                  type="number"
                  className={`${styles.input} ${styles.inputCenter}`}
                  placeholder="Cura customizada + Enter"
                  value={descCustomIn}
                  onChange={(e) => setDescCustomIn(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      applyRecuperarVida(parseFloat(descCustomIn) || 0);
                      setDescCustomIn('');
                    }
                  }}
                />
              </div>

              {/* 2. MANA */}
              <div
                className={styles.campoBloco}
                onClick={(e) => e.stopPropagation()}
              >
                <label className={styles.label}>
                  Mana{' '}
                  <TooltipBadge text="Total = 5 + Bônus Circulação + (Ancoragem × 2) + (Integração × 0.5) + (Canalização × 0.5). Atual = Total - Vendida - Slots." />
                </label>
                <div className={styles.recursoDisplay}>
                  <div className={styles.recursoCelula}>
                    <span className={styles.recursoRotulo}>Total</span>
                    <span className={styles.recursoValor}>{stats.manaTotal}</span>
                  </div>
                  <div
                    className={`${styles.recursoCelula} ${styles.recursoCelulaDestaque}`}
                  >
                    <span className={styles.recursoRotulo}>Atual</span>
                    <span className={`${styles.recursoValor} ${styles.valMana}`}>
                      {stats.manaAtual}
                    </span>
                  </div>
                </div>

                <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                  <label className={`${styles.label} ${styles.labelSm}`}>
                    Vendida ({ficha._estado.manaVendida}) • Custo Slots:{' '}
                    {stats.manaCustoSlots}{' '}
                    <TooltipBadge text="Vender mana permanentemente. Negativo cancela." />
                  </label>
                  <input
                    type="number"
                    className={`${styles.input} ${styles.inputCenter}`}
                    placeholder="Enter..."
                    value={manaVendidaIn}
                    onChange={(e) => setManaVendidaIn(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyManaVendida()}
                  />
                </div>

                <div className={styles.row2}>
                  <button
                    type="button"
                    className={styles.smallActionBtn}
                    onClick={() =>
                      setOpenSlotPopup(openSlotPopup === 'int' ? null : 'int')
                    }
                  >
                    Slots Internos ▾
                  </button>
                  <button
                    type="button"
                    className={styles.smallActionBtn}
                    onClick={() =>
                      setOpenSlotPopup(openSlotPopup === 'ext' ? null : 'ext')
                    }
                  >
                    Slots Externos ▾
                  </button>
                </div>

                {openSlotPopup === 'int' && (
                  <div className={styles.slotsBox}>
                    <div className={`${styles.label} ${styles.labelSm}`}>
                      Slots Internos{' '}
                      <TooltipBadge text="Slots 3–4 desbloqueiam com Integração >= 3 e >= 6. O custo desconta do Mana Atual." />
                    </div>
                    {SLOTS_INTERNOS.map((sk) => {
                      const unlocked = stats.slotsDesbloqueados[sk];
                      return (
                        <div key={sk} className={styles.slotLine}>
                          <input
                            type="text"
                            disabled={!unlocked}
                            className={styles.input}
                            placeholder={
                              unlocked ? `Slot ${sk}` : `${sk} (Bloqueado)`
                            }
                            value={ficha._slots[sk]}
                            onChange={(e) => setSlotText(sk, e.target.value)}
                          />
                          <input
                            type="number"
                            min={0}
                            disabled={!unlocked}
                            className={`${styles.input} ${styles.slotCostInput}`}
                            value={ficha._slotCustos[sk]}
                            onChange={(e) =>
                              setSlotCost(sk, Number(e.target.value))
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {openSlotPopup === 'ext' && (
                  <div className={styles.slotsBox}>
                    <div className={`${styles.label} ${styles.labelSm}`}>
                      Slots Externos{' '}
                      <TooltipBadge text="Slot 4: Integração >= 3. Slot 5: Canalização >= 3. Slot 6: Canalização >= 6." />
                    </div>
                    {SLOTS_EXTERNOS.map((sk) => {
                      const unlocked = stats.slotsDesbloqueados[sk];
                      return (
                        <div key={sk} className={styles.slotLine}>
                          <input
                            type="text"
                            disabled={!unlocked}
                            className={styles.input}
                            placeholder={
                              unlocked ? `Slot ${sk}` : `${sk} (Bloqueado)`
                            }
                            value={ficha._slots[sk]}
                            onChange={(e) => setSlotText(sk, e.target.value)}
                          />
                          <input
                            type="number"
                            min={0}
                            disabled={!unlocked}
                            className={`${styles.input} ${styles.slotCostInput}`}
                            value={ficha._slotCustos[sk]}
                            onChange={(e) =>
                              setSlotCost(sk, Number(e.target.value))
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. ESTAMINA */}
              <div className={styles.campoBloco}>
                <label className={styles.label}>
                  Estamina{' '}
                  <TooltipBadge text="Total = (Tolerância × 2) + 3 + Bônus Circulação. Gasto limitado por ação. Recuperar vazio = Atletismo×0.5 + Prontidão×0.5." />
                </label>
                <div className={styles.recursoDisplay}>
                  <div className={styles.recursoCelula}>
                    <span className={styles.recursoRotulo}>Total</span>
                    <span className={styles.recursoValor}>
                      {stats.estaminaTotal}
                    </span>
                  </div>
                  <div
                    className={`${styles.recursoCelula} ${styles.recursoCelulaDestaque}`}
                  >
                    <span className={styles.recursoRotulo}>Atual</span>
                    <span
                      className={`${styles.recursoValor} ${styles.valEstamina}`}
                    >
                      {stats.estaminaAtual}
                    </span>
                  </div>
                </div>

                <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                  <label className={`${styles.label} ${styles.labelSm}`}>
                    Gasto (Máx/Ação: {stats.estaminaMaxGasto})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={stats.estaminaMaxGasto}
                    className={`${styles.input} ${styles.inputCenter}`}
                    placeholder={`Máx: ${stats.estaminaMaxGasto} (Enter)`}
                    value={estaminaGastoIn}
                    onChange={(e) => setEstaminaGastoIn(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyEstaminaGasto()}
                  />
                </div>

                <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                  <label className={`${styles.label} ${styles.labelSm}`}>
                    Recuperar (Padrão: +{stats.estaminaRecuperarPadrao})
                  </label>
                  <input
                    type="number"
                    className={`${styles.input} ${styles.inputCenter}`}
                    placeholder={`Vazio = +${stats.estaminaRecuperarPadrao} (Enter)`}
                    value={estaminaRecIn}
                    onChange={(e) => setEstaminaRecIn(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && applyEstaminaRecuperar()
                    }
                  />
                </div>
              </div>

              {/* 4. RACIOCÍNIO */}
              <div className={styles.campoBloco}>
                <label className={styles.label}>
                  Raciocínio{' '}
                  <TooltipBadge text="Total = 5 + (Concentração × 2.5) + (Análise × 0.5) + (Foco × 0.5). Recuperar vazio = Concentração × 2." />
                </label>
                <div className={styles.recursoDisplay}>
                  <div className={styles.recursoCelula}>
                    <span className={styles.recursoRotulo}>Total</span>
                    <span className={styles.recursoValor}>{stats.racTotal}</span>
                  </div>
                  <div
                    className={`${styles.recursoCelula} ${styles.recursoCelulaDestaque}`}
                  >
                    <span className={styles.recursoRotulo}>Atual</span>
                    <span className={`${styles.recursoValor} ${styles.valRac}`}>
                      {stats.racAtual}
                    </span>
                  </div>
                </div>

                <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                  <label className={`${styles.label} ${styles.labelSm}`}>
                    Gasto
                  </label>
                  <input
                    type="number"
                    min={0}
                    className={`${styles.input} ${styles.inputCenter}`}
                    placeholder="Enter aplica e limpa..."
                    value={racGastoIn}
                    onChange={(e) => setRacGastoIn(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyRacGasto()}
                  />
                </div>

                <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                  <label className={`${styles.label} ${styles.labelSm}`}>
                    Recuperar (Padrão: +{stats.racRecuperarPadrao})
                  </label>
                  <input
                    type="number"
                    className={`${styles.input} ${styles.inputCenter}`}
                    placeholder={`Vazio = +${stats.racRecuperarPadrao} (Enter)`}
                    value={racRecIn}
                    onChange={(e) => setRacRecIn(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyRacRecuperar()}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ===================== ABA 4: COMBATE ===================== */}
        {tab === 'combate' && (
          <section className={styles.panelFrame}>
            <div className={`${styles.corner} ${styles.cornerTl}`} />
            <div className={`${styles.corner} ${styles.cornerTr}`} />
            <div className={`${styles.corner} ${styles.cornerBl}`} />
            <div className={`${styles.corner} ${styles.cornerBr}`} />

            <header className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Combate</h2>
              <p className={styles.panelSubtitle}>Valores Calculados</p>
            </header>
            <hr className={`divisor-dourado ${styles.divider}`} />

            <div className={styles.row2}>
              <div>
                <div className={styles.fieldGroup}>
                  <label className={`${styles.label} ${styles.labelSm}`}>
                    Dano Físico{' '}
                    <TooltipBadge text="Força × 1.5 + Atletismo × 0.4 + Tolerância × 0.7 + Prontidão × 0.4" />
                  </label>
                  <input
                    readOnly
                    className={`${styles.input} ${styles.inputCenter} ${styles.inputReadonly}`}
                    value={stats.danoFisico}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={`${styles.label} ${styles.labelSm}`}>
                    Dano Mágico{' '}
                    <TooltipBadge text="Integração × 1.5 + Foco × 0.5 + Canalização × 0.5" />
                  </label>
                  <input
                    readOnly
                    className={`${styles.input} ${styles.inputCenter} ${styles.inputReadonly}`}
                    value={stats.danoMagico}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={`${styles.label} ${styles.labelSm}`}>
                    Deslocamento{' '}
                    <TooltipBadge text="2 + Atletismo × 1.5 (quadrados de movimento no Tabuleiro)" />
                  </label>
                  <input
                    readOnly
                    className={`${styles.input} ${styles.inputCenter} ${styles.inputReadonly}`}
                    value={stats.deslocamento}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={`${styles.label} ${styles.labelSm}`}>
                    Agilidade Combate{' '}
                    <TooltipBadge text="Atletismo + Prontidão × 1.5 + Foco × 0.5 + Agilidade × 1.5" />
                  </label>
                  <input
                    readOnly
                    className={`${styles.input} ${styles.inputCenter} ${styles.inputReadonly}`}
                    value={stats.agilidadeCombate}
                  />
                </div>
              </div>

              <div>
                <div className={styles.fieldGroup}>
                  <label className={`${styles.label} ${styles.labelSm}`}>
                    Vel. Mágica{' '}
                    <TooltipBadge text="Canalização × 1.5 + Integração + Foco × 0.5 + Sensibilidade" />
                  </label>
                  <input
                    readOnly
                    className={`${styles.input} ${styles.inputCenter} ${styles.inputReadonly}`}
                    value={stats.velocidadeMagica}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={`${styles.label} ${styles.labelSm}`}>
                    Dens. Mágica{' '}
                    <TooltipBadge text="Ancoragem × 1.5 + Integração × 0.5 + Concentração" />
                  </label>
                  <input
                    readOnly
                    className={`${styles.input} ${styles.inputCenter} ${styles.inputReadonly}`}
                    value={stats.densidadeMagica}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={`${styles.label} ${styles.labelSm}`}>
                    Desl. Magia{' '}
                    <TooltipBadge text="(Canalização × 2.5) + 5" />
                  </label>
                  <input
                    readOnly
                    className={`${styles.input} ${styles.inputCenter} ${styles.inputReadonly}`}
                    value={stats.deslocamentoMagia}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={`${styles.label} ${styles.labelSm}`}>
                    Dano Arma Total{' '}
                    <TooltipBadge text="Dano Base da Arma + Manualidade × 3" />
                  </label>
                  <input
                    readOnly
                    className={`${styles.input} ${styles.inputCenter} ${styles.inputReadonly}`}
                    value={stats.danoArmaTotal}
                  />
                </div>
              </div>
            </div>

            <hr className={`divisor-dourado ${styles.divider}`} />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <label className={`${styles.label} ${styles.labelSm}`}>
                Arma Equipada{' '}
                {ficha.armaEquipadaId &&
                arsenalCatalog.weapons[ficha.armaEquipadaId] ? (
                  <span className={styles.mochilaBadgePorte}>
                    Vinculada à Mochila
                  </span>
                ) : null}
              </label>

              {mochilaWeapons.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--color-pergaminho-400)',
                    }}
                  >
                    Da Mochila:
                  </span>
                  <select
                    className={styles.select}
                    style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
                    value={ficha.armaEquipadaId || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        updateFicha((p) => equiparArmaDoArsenalNaFicha(p, null));
                      } else {
                        const wp = arsenalCatalog.weapons[val];
                        if (wp) {
                          updateFicha((p) => equiparArmaDoArsenalNaFicha(p, wp));
                        }
                      }
                    }}
                  >
                    <option value="">-- Nenhuma (Manual / Desarmado) --</option>
                    {mochilaWeapons.map((wp) => (
                      <option key={wp.id} value={wp.id}>
                        {wp.name} ({ARMA_TIPO_LABELS[inferEpitomeTipoFromWeapon(wp)]}{' '}
                        • +{wp.baseDamage})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className={styles.row3} style={{ marginTop: 6 }}>
              <select
                className={styles.select}
                value={ficha.tipoArma}
                onChange={(e) =>
                  updateFicha((p) => ({
                    ...p,
                    armaEquipadaId: null,
                    tipoArma: e.target.value as ArmaTipoKey,
                  }))
                }
              >
                <option value="">Tipo</option>
                <option value="Curta">Curta</option>
                <option value="Media">Média</option>
                <option value="Longa">Longa</option>
                <option value="Magica">Mágica</option>
              </select>

              <input
                type="text"
                className={`${styles.input} ${styles.inputCenter}`}
                placeholder="Nome da Arma"
                maxLength={40}
                value={ficha.nomeArma}
                onChange={(e) =>
                  updateFicha((p) => ({
                    ...p,
                    armaEquipadaId: null,
                    nomeArma: e.target.value,
                  }))
                }
              />

              <input
                type="number"
                min={0}
                className={`${styles.input} ${styles.inputCenter}`}
                placeholder="Dano Base"
                value={ficha.danoArma}
                onChange={(e) =>
                  updateFicha((p) => ({
                    ...p,
                    armaEquipadaId: null,
                    danoArma: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </div>
          </section>
        )}

        {/* ===================== ABA 5: MAGIA ===================== */}
        {tab === 'magia' && (
          <section className={styles.panelFrame}>
            <div className={`${styles.corner} ${styles.cornerTl}`} />
            <div className={`${styles.corner} ${styles.cornerTr}`} />
            <div className={`${styles.corner} ${styles.cornerBl}`} />
            <div className={`${styles.corner} ${styles.cornerBr}`} />

            <header className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Magia</h2>
              <p className={styles.panelSubtitle}>Circulação &amp; Alcance</p>
            </header>
            <hr className={`divisor-dourado ${styles.divider}`} />

            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                Circulação Mágica{' '}
                <TooltipBadge text="4 quadrantes. X = Estamina (+2 inferior, +1 superior). O = Mana (+2 cada se par horizontal). Q = Vida (+2 cada se par vertical)." />
              </label>
            </div>

            <div className={styles.circGrid}>
              {(
                [
                  ['quadSE', 'Sup. Esq.'],
                  ['quadSD', 'Sup. Dir.'],
                  ['quadIE', 'Inf. Esq.'],
                  ['quadID', 'Inf. Dir.'],
                ] as Array<
                  ['quadSE' | 'quadSD' | 'quadIE' | 'quadID', string]
                >
              ).map(([field, titulo]) => (
                <div key={field} className={styles.circCell}>
                  <span className={`${styles.label} ${styles.labelSm}`}>
                    {titulo}
                  </span>
                  <select
                    className={styles.select}
                    value={ficha[field]}
                    onChange={(e) =>
                      updateFicha((p) => ({
                        ...p,
                        [field]: e.target.value as CircSimbolo,
                      }))
                    }
                  >
                    <option value="">-</option>
                    <option value="X">X (Agilidade / Estamina)</option>
                    <option value="O">O (Flexibilidade / Mana)</option>
                    <option value="Q">Quadrado (Resistência / Vida)</option>
                  </select>
                </div>
              ))}
            </div>

            <div className={styles.circBonusRow}>
              <div>
                <span className={styles.recursoRotulo}>B. Vida</span>
                <strong className={styles.valVida}>
                  +{stats.bonusCirc.vida}
                </strong>
              </div>
              <div>
                <span className={styles.recursoRotulo}>B. Mana</span>
                <strong className={styles.valMana}>
                  +{stats.bonusCirc.mana}
                </strong>
              </div>
              <div>
                <span className={styles.recursoRotulo}>B. Estamina</span>
                <strong className={styles.valEstamina}>
                  +{stats.bonusCirc.estamina}
                </strong>
              </div>
            </div>

            <hr className={`divisor-dourado ${styles.divider}`} />

            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                Alcance Mágico{' '}
                <TooltipBadge text="Raio = (Foco × 2.5) + (Sensibilidade × 1.7) + (Canalização × 2.8). Área = π × Raio². Gera cones e domínios circulares automaticamente no Tabuleiro!" />
              </label>
            </div>

            <div className={styles.row2}>
              <div>
                <div className={styles.fieldGroup}>
                  <label className={`${styles.label} ${styles.labelSm}`}>
                    Raio Circular
                  </label>
                  <input
                    readOnly
                    className={`${styles.input} ${styles.inputCenter} ${styles.inputReadonly}`}
                    value={stats.raioCircular}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={`${styles.label} ${styles.labelSm}`}>
                    Área Circular
                  </label>
                  <input
                    readOnly
                    className={`${styles.input} ${styles.inputCenter} ${styles.inputReadonly}`}
                    value={stats.areaCircular}
                  />
                </div>
              </div>

              <div>
                <div className={styles.fieldGroup}>
                  <label className={`${styles.label} ${styles.labelSm}`}>
                    Ângulo Direcional
                  </label>
                  <select
                    className={styles.select}
                    value={ficha.anguloDirecional}
                    onChange={(e) =>
                      updateFicha((p) => ({
                        ...p,
                        anguloDirecional: e.target.value as AnguloMagicoStr,
                      }))
                    }
                  >
                    {ANGULOS_OPCOES.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>

                {ficha.anguloDirecional === '0' && (
                  <div className={styles.fieldGroup}>
                    <label className={`${styles.label} ${styles.labelSm}`}>
                      Largura (reta)
                    </label>
                    <input
                      type="number"
                      min={1}
                      className={`${styles.input} ${styles.inputCenter}`}
                      value={ficha.larguraReta}
                      onChange={(e) =>
                        updateFicha((p) => ({
                          ...p,
                          larguraReta: Math.max(
                            1,
                            Number(e.target.value) || 1
                          ),
                        }))
                      }
                    />
                  </div>
                )}

                <div className={styles.fieldGroup}>
                  <label className={`${styles.label} ${styles.labelSm}`}>
                    Alc. Direcional
                  </label>
                  <input
                    readOnly
                    className={`${styles.input} ${styles.inputCenter} ${styles.inputReadonly}`}
                    value={stats.alcanceDirecional}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ===================== ABA 6: INVENTÁRIO (MOCHILA + ZONA DE ARMAS) ===================== */}
        {tab === 'inventario' && (
          <section className={styles.panelFrame}>
            <div className={`${styles.corner} ${styles.cornerTl}`} />
            <div className={`${styles.corner} ${styles.cornerTr}`} />
            <div className={`${styles.corner} ${styles.cornerBl}`} />
            <div className={`${styles.corner} ${styles.cornerBr}`} />

            <header className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Inventário &amp; Mochila</h2>
              <p className={styles.panelSubtitle}>
                Zona de Armas do Arsenal &amp; Bolsa de Equipamentos
              </p>
            </header>
            <hr className={`divisor-dourado ${styles.divider}`} />

            {/* ZONA DE ARMAS DA MOCHILA */}
            <div className={styles.mochilaWeaponsBox}>
              <div className={styles.mochilaWeaponsHeader}>
                <label className={styles.label} style={{ margin: 0 }}>
                  &#9876; Zona de Armas (Mochila){' '}
                  <TooltipBadge text="Selecione armas criadas no Glossário -> Armas para guardar na mochila do personagem. Marque qual está Equipada para preencher automaticamente a aba Combate (somando Manualidade × 3) e levar seus golpes e áreas ao Tabuleiro." />
                </label>

                <button
                  type="button"
                  className={styles.mochilaEquipBtn}
                  onClick={handleOpenArsenalFromSheet}
                >
                  &#9874; Forjar / Editar no Arsenal
                </button>
              </div>

              <div className={styles.mochilaPickerRow}>
                {availableArsenalToAdd.length > 0 ? (
                  <>
                    <select
                      className={styles.select}
                      style={{ flex: 1, minWidth: 210 }}
                      value={selectedArsenalToAdd}
                      onChange={(e) => setSelectedArsenalToAdd(e.target.value)}
                    >
                      {availableArsenalToAdd.map((wp) => {
                        const porte = inferEpitomeTipoFromWeapon(wp);
                        return (
                          <option key={wp.id} value={wp.id}>
                            {wp.name} — {ARMA_TIPO_LABELS[porte]} • Base +
                            {wp.baseDamage} • Alc. {wp.range}q (
                            {wp.attackIds.length} atq.)
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      style={{ padding: '7px 14px' }}
                      onClick={handleAddWeaponToMochila}
                    >
                      + Guardar na Mochila
                    </button>
                  </>
                ) : (
                  <span
                    style={{
                      fontSize: 12.5,
                      fontStyle: 'italic',
                      color: 'var(--color-pergaminho-400)',
                    }}
                  >
                    {allArsenalWeapons.length === 0
                      ? 'Nenhuma arma cadastrada no Arsenal ainda. Clique em "Forjar / Editar no Arsenal".'
                      : 'Todas as armas disponíveis do Arsenal já estão guardadas nesta mochila.'}
                  </span>
                )}
              </div>

              {mochilaWeapons.length === 0 ? (
                <div
                  style={{
                    padding: '10px 6px',
                    textAlign: 'center',
                    fontSize: 13,
                    fontStyle: 'italic',
                    color: 'var(--color-pergaminho-500)',
                  }}
                >
                  Nenhuma arma guardada na mochila. Escolha uma arma criada no
                  Arsenal acima para adicionar ao personagem.
                </div>
              ) : (
                <div className={styles.mochilaWeaponList}>
                  {mochilaWeapons.map((wp) => {
                    const isEquipped = ficha.armaEquipadaId === wp.id;
                    const porte = inferEpitomeTipoFromWeapon(wp);
                    const danoComManualidade =
                      wp.baseDamage + ficha._pericias.manualidade * 3;
                    const attackNames = wp.attackIds
                      .map((aid) => arsenalCatalog.attacks[aid]?.name)
                      .filter(Boolean);

                    return (
                      <div
                        key={wp.id}
                        className={`${styles.mochilaWeaponCard} ${
                          isEquipped ? styles.mochilaWeaponCardEquipped : ''
                        }`}
                      >
                        <div className={styles.mochilaWeaponLeft}>
                          <TokenAvatar
                            imageId={wp.iconId}
                            alt={wp.name}
                            size={34}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div className={styles.mochilaWeaponName}>
                              <span>{wp.name}</span>
                              <span className={styles.mochilaBadgePorte}>
                                {ARMA_TIPO_LABELS[porte]}
                              </span>
                              {isEquipped && (
                                <span className={styles.mochilaBadgeEquipped}>
                                  ✓ Equipada
                                </span>
                              )}
                            </div>
                            <div className={styles.mochilaWeaponMeta}>
                              Dano Base +{wp.baseDamage} →{' '}
                              <strong>
                                Total c/ Manualidade: {danoComManualidade}
                              </strong>{' '}
                              • Alcance {wp.range}q
                            </div>
                            {attackNames.length > 0 && (
                              <div className={styles.mochilaWeaponAttacks}>
                                Golpes: {attackNames.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className={styles.mochilaActions}>
                          <button
                            type="button"
                            className={styles.mochilaEquipBtn}
                            onClick={() => handleToggleEquipMochilaWeapon(wp.id)}
                          >
                            {isEquipped ? 'Desequipar' : 'Equipar'}
                          </button>
                          <button
                            type="button"
                            className={styles.mochilaRemoveBtn}
                            onClick={() => handleRemoveWeaponFromMochila(wp.id)}
                            title="Retirar arma da mochila"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                Bolsa de Itens Gerais{' '}
                <TooltipBadge text="Liste os itens, relíquias, poções e suprimentos que o personagem carrega." />
              </label>
              <textarea
                className={styles.textarea}
                rows={7}
                placeholder="Itens gerais da bolsa..."
                value={ficha.bolsa}
                onChange={(e) =>
                  updateFicha((p) => ({ ...p, bolsa: e.target.value }))
                }
              />
            </div>
          </section>
        )}

        {/* Rodapé (apenas no modo editor completo) */}
        {mode === 'editor' && (
          <footer className={styles.footerActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onBack}
            >
              &#9664; Voltar às Fichas
            </button>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleSaveAndSendToBoard}
                title="Salva a ficha e envia o personagem direto para o Tabuleiro Tático"
              >
                ♜ Salvar &amp; Enviar ao Tabuleiro
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleManualSave}
              >
                {savedFeedback ? '✓ Salvo!' : 'Salvar Ficha'}
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};
