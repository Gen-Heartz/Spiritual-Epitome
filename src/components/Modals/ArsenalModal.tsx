import React, { useEffect, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Copy,
  Edit3,
  Plus,
  Swords,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { Weapon } from '../../types';
import { ArmaTipoKey } from '../../epitome/epitomeTypes';
import {
  ARMA_TIPO_LABELS,
  inferEpitomeTipoFromWeapon,
} from '../../epitome/epitomeEngine';
import {
  importAndProcessImageFile,
  WEAPON_ICON_PRESETS,
} from '../../utils/imageProcessor';
import { TokenAvatar } from '../common/TokenAvatar';
import styles from './ModalShared.module.css';

const CATEGORY_SUGGESTIONS = [
  'Adaga',
  'Espada',
  'Lança',
  'Arco',
  'Cajado Mágico',
  'Martelo',
  'Arma Natural',
];

export const ArsenalModal: React.FC = () => {
  const modal = useGameStore((s) => s.arsenalModal);
  const appState = useGameStore((s) => s.appState);
  const closeArsenalModal = useGameStore((s) => s.closeArsenalModal);
  const upsertWeapon = useGameStore((s) => s.upsertWeapon);
  const duplicateWeapon = useGameStore((s) => s.duplicateWeapon);
  const deleteWeapon = useGameStore((s) => s.deleteWeapon);
  const deleteAttack = useGameStore((s) => s.deleteAttack);
  const toggleEquipWeapon = useGameStore((s) => s.toggleEquipWeapon);
  const openAttackEditorModal = useGameStore((s) => s.openAttackEditorModal);
  const saveWeaponAsTemplate = useGameStore((s) => s.saveWeaponAsTemplate);
  const showToast = useGameStore((s) => s.showToast);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const weaponsList = Object.values(appState.weapons).filter(
    (wp) => !wp.id.startsWith('wp_ep_') || wp.id === modal.focusWeaponId
  );

  const [activeWeaponId, setActiveWeaponId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [iconId, setIconId] = useState('wicon_sword');
  const [category, setCategory] = useState('Espada');
  const [epitomeTipo, setEpitomeTipo] =
    useState<Exclude<ArmaTipoKey, ''>>('Media');
  const [range, setRange] = useState(2);
  const [baseDamage, setBaseDamage] = useState(4);

  const equipChar = modal.equipToCharacterId
    ? appState.characters[modal.equipToCharacterId] ?? null
    : null;

  useEffect(() => {
    if (!modal.open) return;
    const initialId =
      modal.focusWeaponId || weaponsList[0]?.id || null;
    setActiveWeaponId(initialId);
  }, [modal.open, modal.focusWeaponId]);

  const currentWeapon = activeWeaponId
    ? appState.weapons[activeWeaponId] ?? null
    : null;

  useEffect(() => {
    if (currentWeapon) {
      setName(currentWeapon.name);
      setIconId(currentWeapon.iconId || 'wicon_sword');
      setCategory(currentWeapon.category);
      setEpitomeTipo(inferEpitomeTipoFromWeapon(currentWeapon));
      setRange(currentWeapon.range);
      setBaseDamage(currentWeapon.baseDamage);
    }
  }, [currentWeapon?.id]);

  if (!modal.open) return null;

  const handleCreateNewWeapon = () => {
    const newId = `wp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const created: Weapon = {
      id: newId,
      name: 'Nova Arma Personalizada',
      iconId: 'wicon_sword',
      category: 'Espada',
      epitomeTipo: 'Media',
      range: 2,
      baseDamage: 3,
      attackIds: [],
    };
    upsertWeapon(created);
    if (equipChar) {
      toggleEquipWeapon(equipChar.id, newId);
    }
    setActiveWeaponId(newId);
  };

  const handleSaveWeaponFields = () => {
    if (!currentWeapon) return;
    upsertWeapon({
      ...currentWeapon,
      name: name.trim() || 'Arma Sem Nome',
      iconId,
      category: category.trim() || 'Geral',
      epitomeTipo,
      range: Math.max(0, Math.round(range)),
      baseDamage: Math.max(0, Math.round(baseDamage)),
    });
    showToast(`Arma "${name}" atualizada.`);
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imgId = await importAndProcessImageFile(file);
      setIconId(imgId);
      if (currentWeapon) {
        upsertWeapon({ ...currentWeapon, iconId: imgId });
      }
    } catch (err: any) {
      showToast(err.message || 'Erro no upload do ícone.');
    }
    e.target.value = '';
  };

  // Exibe 3 slots visuais por padrão, mas suporta ataques ilimitados (Parte 10.1)
  const slotCount = currentWeapon
    ? Math.max(3, currentWeapon.attackIds.length)
    : 3;

  return (
    <div className={styles.backdrop} onClick={closeArsenalModal}>
      <div
        className={`${styles.modal} ${styles.modalWide}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.title}>
            <Swords size={17} />
            <span>
              Biblioteca de Armas & Ataques
              {equipChar ? ` — Inventário de ${equipChar.name}` : ''}
            </span>
          </div>
          <button className={styles.closeBtn} onClick={closeArsenalModal}>
            <X size={16} />
          </button>
        </div>

        <div
          className={styles.body}
          style={{
            display: 'grid',
            gridTemplateColumns: '280px 1fr',
            gap: 16,
            minHeight: 460,
          }}
        >
          {/* Coluna Esquerda: Lista de Armas */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              borderRight: '1px solid var(--border-subtle)',
              paddingRight: 14,
            }}
          >
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleCreateNewWeapon}
            >
              <Plus size={15} />
              <span>Criar Nova Arma</span>
            </button>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                overflowY: 'auto',
              }}
            >
              {weaponsList.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 10 }}>
                  Nenhuma arma cadastrada.
                </div>
              ) : (
                weaponsList.map((wp) => {
                  const isActive = wp.id === activeWeaponId;
                  const isEquipped = equipChar?.weaponIds.includes(wp.id) ?? false;
                  return (
                    <div
                      key={wp.id}
                      onClick={() => setActiveWeaponId(wp.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 7,
                        cursor: 'pointer',
                        border: isActive
                          ? '1px solid var(--gold-primary)'
                          : '1px solid var(--border-subtle)',
                        background: isActive
                          ? 'rgba(201, 166, 92, 0.14)'
                          : 'var(--bg-surface)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <TokenAvatar imageId={wp.iconId} alt={wp.name} size={32} />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 12.5,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {wp.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {wp.category} • Alc. {wp.range} • {wp.attackIds.length} atq.
                          </div>
                        </div>
                      </div>

                      {equipChar && (
                        <button
                          type="button"
                          className={`${styles.chip} ${
                            isEquipped ? styles.chipActive : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleEquipWeapon(equipChar.id, wp.id);
                          }}
                        >
                          {isEquipped ? 'Equipada' : 'Equipar'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Coluna Direita: Editor da Arma e Lista Ilimitada de Ataques */}
          {currentWeapon ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className={styles.card}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <TokenAvatar
                      imageId={iconId}
                      alt={name}
                      size={48}
                      borderColor="#e6c67c"
                    />
                    <div className={styles.chipRow}>
                      {WEAPON_ICON_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`${styles.chip} ${
                            iconId === p.id ? styles.chipActive : ''
                          }`}
                          onClick={() => setIconId(p.id)}
                        >
                          {p.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={styles.chip}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={11} /> Ícone
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                        onChange={handleIconUpload}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => saveWeaponAsTemplate(currentWeapon.id)}
                      title="Salvar arma e seus ataques como Modelo Reutilizável"
                    >
                      <BookmarkPlus size={14} />
                      <span>Modelo</span>
                    </button>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => duplicateWeapon(currentWeapon.id)}
                      title="Duplicar arma"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      className={styles.btnDanger}
                      onClick={() => {
                        const delId = currentWeapon.id;
                        deleteWeapon(delId);
                        setActiveWeaponId(null);
                      }}
                      title="Excluir arma"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label className={styles.label}>Nome da Arma</label>
                    <input
                      className={styles.input}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      Categoria Livre (ex: Adaga, Espada, Arco, Cajado...)
                    </label>
                    <input
                      className={styles.input}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      list="weapon-cat-list"
                    />
                    <datalist id="weapon-cat-list">
                      {CATEGORY_SUGGESTIONS.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className={styles.row4}>
                  <div className={styles.field}>
                    <label className={styles.label}>Porte (Ficha)</label>
                    <select
                      className={styles.select}
                      value={epitomeTipo}
                      onChange={(e) =>
                        setEpitomeTipo(
                          e.target.value as Exclude<ArmaTipoKey, ''>
                        )
                      }
                    >
                      {(
                        ['Curta', 'Media', 'Longa', 'Magica'] as Array<
                          Exclude<ArmaTipoKey, ''>
                        >
                      ).map((p) => (
                        <option key={p} value={p}>
                          {ARMA_TIPO_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Alcance Geral (quad.)</label>
                    <input
                      type="number"
                      min={0}
                      className={styles.input}
                      value={range}
                      onChange={(e) => setRange(Number(e.target.value))}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Dano Base da Arma</label>
                    <input
                      type="number"
                      min={0}
                      className={styles.input}
                      value={baseDamage}
                      onChange={(e) => setBaseDamage(Number(e.target.value))}
                    />
                  </div>
                  <div className={styles.field} style={{ justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={handleSaveWeaponFields}
                    >
                      Salvar Arma
                    </button>
                  </div>
                </div>
              </div>

              {/* Ataques vinculados à arma */}
              <div className={styles.card}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--gold-bright)' }}>
                      Ataques da Arma ({currentWeapon.attackIds.length})
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      3 slots visuais padrão • Quantidade ilimitada de ataques permitida
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => openAttackEditorModal(currentWeapon.id, null)}
                  >
                    <Plus size={14} />
                    <span>Adicionar Ataque</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {Array.from({ length: slotCount }, (_, idx) => {
                    const atkId = currentWeapon.attackIds[idx];
                    const atk = atkId ? appState.attacks[atkId] : null;
                    if (!atk) {
                      return (
                        <div
                          key={`slot_empty_${idx}`}
                          style={{
                            padding: '9px 12px',
                            border: '1px dashed var(--border-subtle)',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            color: 'var(--text-muted)',
                            fontSize: 12,
                          }}
                        >
                          <span>Slot Visual #{idx + 1} (Disponível)</span>
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            onClick={() =>
                              openAttackEditorModal(currentWeapon.id, null)
                            }
                          >
                            + Configurar Ataque
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={atk.id}
                        style={{
                          padding: '9px 12px',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>
                            #{idx + 1} • {atk.name}{' '}
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: 'var(--gold-bright)',
                              }}
                            >
                              ({atk.damage} Dano • Alcance {atk.range} •{' '}
                              {atk.impactType || 'Impacto'})
                            </span>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                            {atk.description || 'Sem descrição'} • Área:{' '}
                            {atk.area.cells.length} quadrado
                            {atk.area.cells.length === 1 ? '' : 's'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            onClick={() =>
                              openAttackEditorModal(currentWeapon.id, atk.id)
                            }
                          >
                            <Edit3 size={13} />
                            <span>Editar Área</span>
                          </button>
                          <button
                            type="button"
                            className={styles.btnDanger}
                            onClick={() =>
                              deleteAttack(atk.id, currentWeapon.id)
                            }
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
              }}
            >
              Selecione ou crie uma arma à esquerda para configurar seus ataques.
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={closeArsenalModal}
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
