import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  Copy,
  Edit3,
  LayoutGrid,
  Plus,
  Sparkles,
  Swords,
  Trash2,
  Upload,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { Weapon } from '../../types';
import { ArmaTipoKey } from '../../epitome/epitomeTypes';
import {
  ARMA_TIPO_LABELS,
  inferEpitomeTipoFromWeapon,
} from '../../epitome/epitomeEngine';
import { gerarAtaquesSugeridosParaArma } from '../../data/presets';
import {
  importAndProcessImageFile,
  WEAPON_ICON_PRESETS,
} from '../../utils/imageProcessor';
import { TokenAvatar } from '../common/TokenAvatar';
import styles from './GlossarioArmas.module.css';

const CATEGORY_SUGGESTIONS = [
  'Adaga',
  'Espada',
  'Machado de Guerra',
  'Lança',
  'Arco',
  'Besta',
  'Cajado Mágico',
  'Martelo',
];

const PORTE_OPTIONS: Array<Exclude<ArmaTipoKey, ''>> = [
  'Curta',
  'Media',
  'Longa',
  'Magica',
];

export const GlossarioArmas: React.FC = () => {
  const arsenalCatalog = useGameStore((s) => s.arsenalCatalog);
  const fichasList = useGameStore((s) => s.fichasList);
  const attackEditorModal = useGameStore((s) => s.attackEditorModal);

  const setActiveScreen = useGameStore((s) => s.setActiveScreen);
  const refreshArsenal = useGameStore((s) => s.refreshArsenal);
  const upsertWeapon = useGameStore((s) => s.upsertWeapon);
  const duplicateWeapon = useGameStore((s) => s.duplicateWeapon);
  const deleteWeapon = useGameStore((s) => s.deleteWeapon);
  const upsertAttack = useGameStore((s) => s.upsertAttack);
  const deleteAttack = useGameStore((s) => s.deleteAttack);
  const openAttackEditorModal = useGameStore((s) => s.openAttackEditorModal);
  const showToast = useGameStore((s) => s.showToast);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState('');
  const [porteFilter, setPorteFilter] = useState<
    'ALL' | Exclude<ArmaTipoKey, ''>
  >('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Campos editáveis da arma ativa
  const [name, setName] = useState('');
  const [iconId, setIconId] = useState('wicon_sword');
  const [category, setCategory] = useState('Espada');
  const [epitomeTipo, setEpitomeTipo] =
    useState<Exclude<ArmaTipoKey, ''>>('Media');
  const [baseDamage, setBaseDamage] = useState(4);
  const [range, setRange] = useState(2);
  const [description, setDescription] = useState('');

  useEffect(() => {
    refreshArsenal();
  }, [refreshArsenal]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (attackEditorModal.open) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        setActiveScreen('glossario');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [attackEditorModal.open, setActiveScreen]);

  const allWeapons = useMemo(
    () =>
      Object.values(arsenalCatalog.weapons).filter(
        (wp) => !wp.id.startsWith('wp_ep_')
      ),
    [arsenalCatalog.weapons]
  );

  const filteredWeapons = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allWeapons.filter((wp) => {
      const porte = inferEpitomeTipoFromWeapon(wp);
      if (porteFilter !== 'ALL' && porte !== porteFilter) return false;
      if (!q) return true;
      return (
        wp.name.toLowerCase().includes(q) ||
        (wp.category || '').toLowerCase().includes(q) ||
        ARMA_TIPO_LABELS[porte].toLowerCase().includes(q)
      );
    });
  }, [allWeapons, search, porteFilter]);

  useEffect(() => {
    if (selectedId && arsenalCatalog.weapons[selectedId]) return;
    setSelectedId(allWeapons[0]?.id ?? null);
  }, [allWeapons, selectedId, arsenalCatalog.weapons]);

  const activeWeapon = selectedId
    ? arsenalCatalog.weapons[selectedId] ?? null
    : null;

  useEffect(() => {
    if (!activeWeapon) return;
    setName(activeWeapon.name);
    setIconId(activeWeapon.iconId || 'wicon_sword');
    setCategory(activeWeapon.category || 'Espada');
    setEpitomeTipo(inferEpitomeTipoFromWeapon(activeWeapon));
    setBaseDamage(activeWeapon.baseDamage);
    setRange(activeWeapon.range);
    setDescription(activeWeapon.description || '');
    setConfirmDeleteId(null);
  }, [activeWeapon?.id]);

  const commitWeaponPatch = (partial: Partial<Weapon>, silent = false) => {
    if (!activeWeapon) return;
    const updated: Weapon = {
      ...activeWeapon,
      name: (partial.name ?? name).trim() || 'Arma Sem Nome',
      iconId: partial.iconId ?? iconId,
      category: (partial.category ?? category).trim() || 'Arma',
      epitomeTipo: partial.epitomeTipo ?? epitomeTipo,
      baseDamage: Math.max(
        0,
        Math.round(partial.baseDamage ?? baseDamage)
      ),
      range: Math.max(1, Math.round(partial.range ?? range)),
      description: partial.description ?? description,
    };
    upsertWeapon(updated);
    if (!silent) {
      showToast(`Arma "${updated.name}" salva no Arsenal!`);
    }
  };

  const handleCreateWeapon = () => {
    const newId = `wp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const initialPorte: Exclude<ArmaTipoKey, ''> =
      porteFilter === 'ALL' ? 'Media' : porteFilter;
    const defaultRange =
      initialPorte === 'Longa'
        ? 7
        : initialPorte === 'Magica'
        ? 6
        : initialPorte === 'Media'
        ? 2
        : 1;
    const defaultIcon =
      initialPorte === 'Longa'
        ? 'wicon_bow'
        : initialPorte === 'Magica'
        ? 'wicon_staff'
        : 'wicon_sword';

    const draft: Weapon = {
      id: newId,
      name: 'Nova Arma do Arsenal',
      iconId: defaultIcon,
      category:
        initialPorte === 'Longa'
          ? 'Arco'
          : initialPorte === 'Magica'
          ? 'Cajado Mágico'
          : initialPorte === 'Curta'
          ? 'Adaga'
          : 'Espada',
      epitomeTipo: initialPorte,
      range: defaultRange,
      baseDamage: 4,
      description: '',
      attackIds: [],
    };

    const suggestedAttacks = gerarAtaquesSugeridosParaArma(draft, initialPorte);
    draft.attackIds = suggestedAttacks.map((a) => a.id);

    upsertWeapon(draft);
    for (const atk of suggestedAttacks) {
      upsertAttack(atk, newId);
    }
    setSelectedId(newId);
    showToast('Nova arma criada no Arsenal! Personalize atributos e golpes.');
  };

  const handleGenerateSuggestedAttacks = () => {
    if (!activeWeapon) return;
    const currentSnapshot: Weapon = {
      ...activeWeapon,
      name: name.trim() || activeWeapon.name,
      epitomeTipo,
      baseDamage,
      range,
    };
    const generated = gerarAtaquesSugeridosParaArma(
      currentSnapshot,
      epitomeTipo
    );
    for (const atk of generated) {
      upsertAttack(atk, activeWeapon.id);
    }
    showToast(
      `${generated.length} golpes sugeridos (${ARMA_TIPO_LABELS[epitomeTipo]}) adicionados!`
    );
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imgId = await importAndProcessImageFile(file);
      setIconId(imgId);
      commitWeaponPatch({ iconId: imgId }, true);
      showToast('Ícone da arma atualizado!');
    } catch (err: any) {
      showToast(err.message || 'Erro ao enviar imagem.');
    }
    e.target.value = '';
  };

  const handleDeleteCurrentWeapon = () => {
    if (!activeWeapon) return;
    if (confirmDeleteId === activeWeapon.id) {
      const delId = activeWeapon.id;
      deleteWeapon(delId);
      setSelectedId(null);
      setConfirmDeleteId(null);
      return;
    }
    setConfirmDeleteId(activeWeapon.id);
    setTimeout(() => {
      setConfirmDeleteId((cur) => (cur === activeWeapon.id ? null : cur));
    }, 3200);
  };

  const countFichasCarry = (weaponId: string) =>
    fichasList.filter((f) => f.mochilaArmasIds.includes(weaponId)).length;

  return (
    <div className={styles.screen}>
      <div className={styles.container}>
        {/* Cabeçalho de Navegação */}
        <header className={styles.topBar}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Glossário — Arsenal de Armas</h1>
            <p className={styles.subtitle}>
              Catálogo independente de armas e golpes táticos disponíveis para as Mochilas das Fichas e o Tabuleiro
            </p>
          </div>

          <div className={styles.topActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setActiveScreen('glossario')}
            >
              <ChevronLeft size={13} /> Glossário
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setActiveScreen('fichas')}
            >
              <Swords size={13} /> Fichas (Mochila)
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setActiveScreen('tabuleiro')}
            >
              <LayoutGrid size={13} /> Tabuleiro
            </button>
          </div>
        </header>

        <div className={styles.workspace}>
          {/* COLUNA ESQUERDA: Lista Independente do Arsenal */}
          <aside className={styles.panel}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Armas Forjadas ({allWeapons.length})
              </h2>
              <button
                type="button"
                className={styles.btnPrimary}
                style={{ padding: '5px 10px', fontSize: 10.5 }}
                onClick={handleCreateWeapon}
              >
                <Plus size={13} />
                <span>Nova Arma</span>
              </button>
            </div>

            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar arma por nome ou categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className={styles.filterRow}>
              <button
                type="button"
                className={`${styles.filterChip} ${
                  porteFilter === 'ALL' ? styles.filterChipActive : ''
                }`}
                onClick={() => setPorteFilter('ALL')}
              >
                Todas
              </button>
              {PORTE_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.filterChip} ${
                    porteFilter === p ? styles.filterChipActive : ''
                  }`}
                  onClick={() => setPorteFilter(p)}
                >
                  {ARMA_TIPO_LABELS[p]}
                </button>
              ))}
            </div>

            {filteredWeapons.length === 0 ? (
              <div className={styles.emptyState}>
                Nenhuma arma encontrada neste filtro. Clique em &ldquo;Nova Arma&rdquo; para forjar.
              </div>
            ) : (
              <div className={styles.weaponList}>
                {filteredWeapons.map((wp) => {
                  const porte = inferEpitomeTipoFromWeapon(wp);
                  const carryCount = countFichasCarry(wp.id);
                  const isSel = wp.id === activeWeapon?.id;

                  return (
                    <div
                      key={wp.id}
                      className={`${styles.weaponItem} ${
                        isSel ? styles.weaponItemActive : ''
                      }`}
                      onClick={() => setSelectedId(wp.id)}
                    >
                      <div className={styles.weaponItemLeft}>
                        <TokenAvatar
                          imageId={wp.iconId}
                          alt={wp.name}
                          size={34}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div className={styles.weaponItemName}>{wp.name}</div>
                          <div className={styles.weaponItemMeta}>
                            Dano +{wp.baseDamage} • Alc. {wp.range}q •{' '}
                            {wp.attackIds.length} atq.
                            {carryCount > 0
                              ? ` • Em ${carryCount} mochila${
                                  carryCount > 1 ? 's' : ''
                                }`
                              : ''}
                          </div>
                        </div>
                      </div>
                      <span className={styles.porteBadge}>
                        {ARMA_TIPO_LABELS[porte]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          {/* COLUNA DIREITA: Editor Completo da Arma Independente + Ataques */}
          <main className={styles.editorStack}>
            {!activeWeapon ? (
              <section className={styles.panel}>
                <div className={styles.emptyState}>
                  Selecione uma arma à esquerda ou clique em &ldquo;Nova Arma&rdquo; para iniciar a forja.
                </div>
              </section>
            ) : (
              <>
                <section className={styles.panel}>
                  <div className={styles.iconBar}>
                    <div className={styles.iconLeft}>
                      <TokenAvatar
                        imageId={iconId}
                        alt={name}
                        size={50}
                        borderColor="#e6c67c"
                      />
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 5,
                        }}
                      >
                        {WEAPON_ICON_PRESETS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className={`${styles.filterChip} ${
                              iconId === p.id ? styles.filterChipActive : ''
                            }`}
                            onClick={() => {
                              setIconId(p.id);
                              commitWeaponPatch({ iconId: p.id }, true);
                            }}
                          >
                            {p.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          className={styles.filterChip}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload size={11} style={{ marginRight: 4 }} />
                          Enviar Ícone
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

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => duplicateWeapon(activeWeapon.id)}
                        title="Criar cópia independente desta arma e seus golpes"
                      >
                        <Copy size={13} />
                        <span>Duplicar</span>
                      </button>
                      <button
                        type="button"
                        className={styles.btnDanger}
                        onClick={handleDeleteCurrentWeapon}
                      >
                        <Trash2 size={13} />
                        <span>
                          {confirmDeleteId === activeWeapon.id
                            ? 'Confirmar Exclusão?'
                            : 'Excluir'}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() => commitWeaponPatch({})}
                      >
                        Salvar Arma
                      </button>
                    </div>
                  </div>

                  <div className={styles.formGrid2}>
                    <div className={styles.field}>
                      <label className={styles.label}>Nome da Arma</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={() => commitWeaponPatch({ name }, true)}
                        placeholder="Ex: Lâmina Crepuscular"
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>
                        Porte no Sistema (Spiritual Epitome)
                      </label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {PORTE_OPTIONS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            className={`${styles.filterChip} ${
                              epitomeTipo === p ? styles.filterChipActive : ''
                            }`}
                            style={{ flex: 1, padding: '7px 8px' }}
                            onClick={() => {
                              setEpitomeTipo(p);
                              commitWeaponPatch({ epitomeTipo: p }, true);
                            }}
                          >
                            {ARMA_TIPO_LABELS[p]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={styles.formGrid3}>
                    <div className={styles.field}>
                      <label className={styles.label}>Família / Categoria</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        onBlur={() => commitWeaponPatch({ category }, true)}
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>
                        Dano Base da Arma (+Manualidade×3)
                      </label>
                      <input
                        type="number"
                        min={0}
                        className={styles.input}
                        value={baseDamage}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value) || 0);
                          setBaseDamage(v);
                        }}
                        onBlur={() => commitWeaponPatch({ baseDamage }, true)}
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>
                        Alcance Base (Quadrados)
                      </label>
                      <input
                        type="number"
                        min={1}
                        className={styles.input}
                        value={range}
                        onChange={(e) => {
                          const v = Math.max(1, Number(e.target.value) || 1);
                          setRange(v);
                        }}
                        onBlur={() => commitWeaponPatch({ range }, true)}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 5,
                      marginTop: 8,
                    }}
                  >
                    {CATEGORY_SUGGESTIONS.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        className={`${styles.filterChip} ${
                          category === sug ? styles.filterChipActive : ''
                        }`}
                        onClick={() => {
                          setCategory(sug);
                          commitWeaponPatch({ category: sug }, true);
                        }}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>

                  <div className={styles.field} style={{ marginTop: 12 }}>
                    <label className={styles.label}>
                      Descrição &amp; Propriedades da Arma
                    </label>
                    <textarea
                      className={styles.textarea}
                      placeholder="História, material, runas ou propriedades especiais desta arma..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={() => commitWeaponPatch({ description }, true)}
                    />
                    <span className={styles.hint}>
                      Esta arma é independente: qualquer personagem pode guardá-la na{' '}
                      <strong>Zona de Armas da Mochila</strong> (aba Inventário da Ficha) e marcá-la como{' '}
                      <strong>Equipada</strong>.
                    </span>
                  </div>
                </section>

                {/* Seção de Ataques e Áreas de Impacto */}
                <section className={styles.panel}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2 className={styles.sectionTitle}>
                        Ataques e Áreas de Impacto ({activeWeapon.attackIds.length})
                      </h2>
                      <span className={styles.hint}>
                        Configure formas no grid (cones, linhas, círculos, zonas vermelho/laranja/amarelo) usadas no Tabuleiro.
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={handleGenerateSuggestedAttacks}
                        title="Gera golpes prontos baseados no Porte atual da arma"
                      >
                        <Sparkles size={13} />
                        <span>Golpes pelo Porte</span>
                      </button>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() =>
                          openAttackEditorModal(activeWeapon.id, null)
                        }
                      >
                        <Plus size={13} />
                        <span>Novo Ataque (Área)</span>
                      </button>
                    </div>
                  </div>

                  {activeWeapon.attackIds.length === 0 ? (
                    <div className={styles.emptyState}>
                      Nenhum ataque cadastrado nesta arma. Clique em &ldquo;Novo Ataque (Área)&rdquo; ou &ldquo;Golpes pelo Porte&rdquo;.
                    </div>
                  ) : (
                    <div className={styles.attacksList}>
                      {activeWeapon.attackIds.map((atkId) => {
                        const atk = arsenalCatalog.attacks[atkId];
                        if (!atk) return null;
                        return (
                          <div key={atk.id} className={styles.attackCard}>
                            <div style={{ minWidth: 0 }}>
                              <div
                                className={styles.attackTitle}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                              >
                                <Swords size={12} /> {atk.name}
                              </div>
                              <div className={styles.attackSub}>
                                Alcance {atk.range}q • {atk.impactType || 'Impacto'} •{' '}
                                {atk.area.cells.length} quadrado
                                {atk.area.cells.length === 1 ? '' : 's'} na área
                                {atk.effects.length > 0
                                  ? ` • ${atk.effects.length} efeito(s)`
                                  : ''}
                              </div>
                              {atk.description && (
                                <div className={styles.attackDesc}>
                                  {atk.description}
                                </div>
                              )}
                            </div>

                            <div className={styles.attackRight}>
                              <span className={styles.dmgBadge}>
                                {atk.damage} DMG Base
                              </span>
                              <button
                                type="button"
                                className={styles.btnSecondary}
                                style={{ padding: '5px 10px' }}
                                onClick={() =>
                                  openAttackEditorModal(
                                    activeWeapon.id,
                                    atk.id
                                  )
                                }
                                title="Editar área de impacto, alcance, dano e efeitos"
                              >
                                <Edit3 size={13} />
                                <span>Editar</span>
                              </button>
                              <button
                                type="button"
                                className={styles.btnDanger}
                                style={{ padding: '5px 9px' }}
                                onClick={() =>
                                  deleteAttack(atk.id, activeWeapon.id)
                                }
                                title="Remover ataque desta arma"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
