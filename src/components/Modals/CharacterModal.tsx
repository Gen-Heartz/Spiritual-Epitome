import React, { useEffect, useRef, useState } from 'react';
import { Upload, UserPlus, X } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { Character, Direction } from '../../types';
import { DIRECTION_LABELS } from '../../engine/geometry';
import {
  EMBLEM_PRESETS,
  importAndProcessImageFile,
} from '../../utils/imageProcessor';
import { TokenAvatar } from '../common/TokenAvatar';
import styles from './ModalShared.module.css';

export const CharacterModal: React.FC = () => {
  const modal = useGameStore((s) => s.characterModal);
  const appState = useGameStore((s) => s.appState);
  const closeCharacterModal = useGameStore((s) => s.closeCharacterModal);
  const upsertCharacter = useGameStore((s) => s.upsertCharacter);
  const autoPlaceCharacter = useGameStore((s) => s.autoPlaceCharacter);
  const saveCharacterAsTemplate = useGameStore((s) => s.saveCharacterAsTemplate);
  const showToast = useGameStore((s) => s.showToast);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const existing = modal.editCharacterId
    ? appState.characters[modal.editCharacterId] ?? null
    : null;

  const [name, setName] = useState('');
  const [imageId, setImageId] = useState('preset_knight');
  const [hpMax, setHpMax] = useState(100);
  const [hpCurrent, setHpCurrent] = useState(100);
  const [movement, setMovement] = useState(5);
  const [baseDamage, setBaseDamage] = useState(4);
  const [width, setWidth] = useState(1);
  const [height, setHeight] = useState(1);
  const [facing, setFacing] = useState<Direction>(Direction.South);
  const [weaponIds, setWeaponIds] = useState<string[]>([]);
  const [placeImmediately, setPlaceImmediately] = useState(true);
  const [alsoSaveTemplate, setAlsoSaveTemplate] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!modal.open) return;
    setUploadError(null);
    setAlsoSaveTemplate(false);
    if (existing) {
      setName(existing.name);
      setImageId(existing.imageId || 'preset_knight');
      setHpMax(existing.hpMax);
      setHpCurrent(existing.hpCurrent);
      setMovement(existing.movement);
      setBaseDamage(existing.baseDamage);
      setWidth(existing.width);
      setHeight(existing.height);
      setFacing(existing.facing);
      setWeaponIds([...existing.weaponIds]);
      setPlaceImmediately(Boolean(existing.position));
    } else {
      setName('');
      setImageId('preset_knight');
      setHpMax(80);
      setHpCurrent(80);
      setMovement(5);
      setBaseDamage(4);
      setWidth(1);
      setHeight(1);
      setFacing(Direction.South);
      setWeaponIds([]);
      setPlaceImmediately(true);
    }
  }, [modal.open, existing]);

  if (!modal.open) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const processedId = await importAndProcessImageFile(file);
      setImageId(processedId);
      showToast('Imagem recortada em 256×256 circular e salva no IndexedDB!');
    } catch (err: any) {
      setUploadError(err.message || 'Erro ao importar imagem.');
    }
    e.target.value = '';
  };

  const toggleWeapon = (wid: string) => {
    setWeaponIds((prev) =>
      prev.includes(wid) ? prev.filter((x) => x !== wid) : [...prev, wid]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id =
      existing?.id ||
      `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const safeMaxHp = Math.max(1, Math.round(hpMax));
    const safeCurHp = Math.max(0, Math.min(safeMaxHp, Math.round(hpCurrent)));
    const safeW = Math.max(1, Math.min(10, Math.round(width)));
    const safeH = Math.max(1, Math.min(10, Math.round(height)));

    const character: Character = {
      id,
      name: name.trim() || 'Unidade Sem Nome',
      imageId,
      hpMax: safeMaxHp,
      hpCurrent: safeCurHp,
      movement: Math.max(0, Math.round(movement)),
      baseDamage: Math.max(0, Math.round(baseDamage)),
      weaponIds,
      position: existing ? existing.position : null,
      facing,
      width: safeW,
      height: safeH,
    };

    upsertCharacter(character);

    if (!existing && placeImmediately) {
      autoPlaceCharacter(id);
    }

    if (alsoSaveTemplate) {
      await saveCharacterAsTemplate(id);
    }

    closeCharacterModal();
  };

  const weaponsList = Object.values(appState.weapons);

  return (
    <div className={styles.backdrop} onClick={closeCharacterModal}>
      <form
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className={styles.header}>
          <div className={styles.title}>
            <UserPlus size={17} />
            <span>
              {existing ? `Editar: ${existing.name}` : 'Criar Novo Personagem / NPC'}
            </span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={closeCharacterModal}
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {/* Retrato e Upload */}
          <div className={styles.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <TokenAvatar
                imageId={imageId}
                alt={name || 'Token'}
                size={68}
                borderColor="#e6c67c"
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className={styles.label}>
                  Imagem Circular (JPG, PNG ou WebP — máx. 256×256 automático)
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={14} />
                    <span>Importar Imagem do Computador</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                </div>
                {uploadError && (
                  <span style={{ color: '#f87171', fontSize: 11.5 }}>
                    {uploadError}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.label}>Ou escolha um brasão predefinido:</div>
            <div className={styles.chipRow}>
              {EMBLEM_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.chip} ${
                    imageId === p.id ? styles.chipActive : ''
                  }`}
                  onClick={() => setImageId(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nome e Orientação */}
          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label}>Nome do Personagem / Criatura</label>
              <input
                className={styles.input}
                placeholder="Ex: Cavaleiro Cinzento, Goblin Batedor..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Orientação Inicial (8 Direções)</label>
              <select
                className={styles.select}
                value={facing}
                onChange={(e) => setFacing(Number(e.target.value) as Direction)}
              >
                {Object.entries(DIRECTION_LABELS).map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Atributos Livres */}
          <div className={styles.row4}>
            <div className={styles.field}>
              <label className={styles.label}>Vida Máxima (HP)</label>
              <input
                type="number"
                min={1}
                className={styles.input}
                value={hpMax}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setHpMax(v);
                  if (!existing) setHpCurrent(v);
                }}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Vida Atual</label>
              <input
                type="number"
                min={0}
                className={styles.input}
                value={hpCurrent}
                onChange={(e) => setHpCurrent(Number(e.target.value))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Movimento (quad.)</label>
              <input
                type="number"
                min={0}
                className={styles.input}
                value={movement}
                onChange={(e) => setMovement(Number(e.target.value))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Dano Base</label>
              <input
                type="number"
                min={0}
                className={styles.input}
                value={baseDamage}
                onChange={(e) => setBaseDamage(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Dimensões de Criaturas (Parte 4.5) */}
          <div className={styles.card}>
            <div className={styles.label}>
              Dimensões da Criatura no Grid (Largura × Altura em quadrados)
            </div>
            <div className={styles.chipRow}>
              {[
                { label: 'Comum (1×1)', w: 1, h: 1 },
                { label: 'Grande (2×2)', w: 2, h: 2 },
                { label: 'Enorme (3×3)', w: 3, h: 3 },
                { label: 'Colossal (4×4)', w: 4, h: 4 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={`${styles.chip} ${
                    width === preset.w && height === preset.h
                      ? styles.chipActive
                      : ''
                  }`}
                  onClick={() => {
                    setWidth(preset.w);
                    setHeight(preset.h);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className={styles.row2} style={{ marginTop: 4 }}>
              <div className={styles.field}>
                <label className={styles.label}>Largura Personalizada</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className={styles.input}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Altura Personalizada</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className={styles.input}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Inventário de Armas */}
          <div className={styles.card}>
            <div className={styles.label}>
              Armas Equipadas ({weaponIds.length} selecionada
              {weaponIds.length === 1 ? '' : 's'})
            </div>
            {weaponsList.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Nenhuma arma criada ainda. Você pode criar armas no botão "Arsenal".
              </div>
            ) : (
              <div className={styles.chipRow}>
                {weaponsList.map((wp) => (
                  <button
                    key={wp.id}
                    type="button"
                    className={`${styles.chip} ${
                      weaponIds.includes(wp.id) ? styles.chipActive : ''
                    }`}
                    onClick={() => toggleWeapon(wp.id)}
                  >
                    ⚔️ {wp.name} ({wp.category || 'Arma'})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Opções Extras */}
          <div style={{ display: 'flex', gap: 18, fontSize: 12.5 }}>
            {!existing && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={placeImmediately}
                  onChange={(e) => setPlaceImmediately(e.target.checked)}
                />
                <span>Posicionar automaticamente no tabuleiro</span>
              </label>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={alsoSaveTemplate}
                onChange={(e) => setAlsoSaveTemplate(e.target.checked)}
              />
              <span>Salvar também nos Modelos Reutilizáveis</span>
            </label>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={closeCharacterModal}
          >
            Cancelar
          </button>
          <button type="submit" className={styles.btnPrimary}>
            {existing ? 'Salvar Alterações' : 'Criar Personagem'}
          </button>
        </div>
      </form>
    </div>
  );
};
