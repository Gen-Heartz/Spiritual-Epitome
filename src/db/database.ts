import Dexie, { Table } from 'dexie';
import {
  AppState,
  ArsenalCatalog,
  Attack,
  Character,
  CharacterTemplateRecord,
  ExportedImage,
  ExportedMatchJSON,
  SavedMatchRecord,
  StoredImage,
  Weapon,
  WeaponTemplateRecord,
} from '../types';
import { createDefaultArsenalCatalog } from '../data/presets';
import { createDefaultBestiaryCatalog } from '../data/bestiaryPresets';
import { createDefaultMapCatalog } from '../data/mapPresets';
import {
  BestiaryCatalog,
  BestiaryMonster,
} from '../bestiary/bestiaryTypes';
import { normalizarMonstro } from '../bestiary/bestiaryEngine';
import { GameMap, MapCatalog } from '../maps/mapTypes';
import { normalizarCatalogoMapas, normalizarMapa } from '../maps/mapEngine';
import { EpitomeFicha } from '../epitome/epitomeTypes';
import {
  DEFAULT_SAMPLE_FICHAS,
  gerarFichaId,
  normalizarFicha,
} from '../epitome/epitomeEngine';

export interface MetaEntry {
  key: string;
  value: any;
}

class GrimorioETabuleiroDatabase extends Dexie {
  images!: Table<StoredImage, string>;
  matches!: Table<SavedMatchRecord, string>;
  characterTemplates!: Table<CharacterTemplateRecord, string>;
  weaponTemplates!: Table<WeaponTemplateRecord, string>;
  meta!: Table<MetaEntry, string>;

  // Tabelas originais do Grimório do Mestre (Spiritual-Epitome)
  fichas!: Table<EpitomeFicha, string>;
  sistema!: Table<Record<string, any>, string>;
  glossario!: Table<Record<string, any>, string>;
  construcao!: Table<Record<string, any>, string>;
  config!: Table<Record<string, any>, string>;

  constructor() {
    super('TacticalRpgCombatDB_v3');
    this.version(1).stores({
      images: 'id, createdAt',
      matches: 'id, updatedAt',
      characterTemplates: 'id, createdAt',
      weaponTemplates: 'id, createdAt',
      meta: 'key',
    });
    this.version(2).stores({
      images: 'id, createdAt',
      matches: 'id, updatedAt',
      characterTemplates: 'id, createdAt',
      weaponTemplates: 'id, createdAt',
      meta: 'key',
      fichas: 'id, nome, _ts',
      sistema: 'id',
      glossario: 'id, termo',
      construcao: 'id',
      config: 'chave',
    });
  }
}

export const db = new GrimorioETabuleiroDatabase();

// === Imagens ===

export async function saveImageBlob(
  id: string,
  blob: Blob,
  mimeType = 'image/png'
): Promise<void> {
  await db.images.put({
    id,
    blob,
    mimeType,
    createdAt: Date.now(),
  });
}

export async function getImageBlob(id: string): Promise<Blob | null> {
  if (!id) return null;
  const record = await db.images.get(id);
  return record ? record.blob : null;
}

// === Partidas do Tabuleiro ===

export async function saveMatchRecord(
  id: string,
  name: string,
  state: AppState
): Promise<void> {
  await db.matches.put({
    id,
    name,
    updatedAt: Date.now(),
    state,
  });
  await db.meta.put({ key: 'activeMatchId', value: id });
}

export async function getActiveMatchRecord(): Promise<SavedMatchRecord | null> {
  const meta = await db.meta.get('activeMatchId');
  if (meta?.value) {
    const match = await db.matches.get(meta.value);
    if (match) return match;
  }
  const latest = await db.matches.orderBy('updatedAt').reverse().first();
  return latest ?? null;
}

export async function listMatchRecords(): Promise<SavedMatchRecord[]> {
  return db.matches.orderBy('updatedAt').reverse().toArray();
}

export async function deleteMatchRecord(id: string): Promise<void> {
  await db.matches.delete(id);
}

// === Fichas de Personagem (Spiritual-Epitome) ===

export async function seedDefaultFichasIfEmpty(): Promise<void> {
  const flag = await db.meta.get('seededDefaultFichas');
  if (flag?.value) return;
  const count = await db.fichas.count();
  if (count === 0) {
    await db.fichas.bulkPut(DEFAULT_SAMPLE_FICHAS);
  }
  await db.meta.put({ key: 'seededDefaultFichas', value: true });
}

export async function listFichas(): Promise<EpitomeFicha[]> {
  const all = await db.fichas.toArray();
  return all
    .map((f) => normalizarFicha(f))
    .sort((a, b) => (b._ts || 0) - (a._ts || 0));
}

export async function getFicha(id: string): Promise<EpitomeFicha | null> {
  if (!id) return null;
  const raw = await db.fichas.get(id);
  return raw ? normalizarFicha(raw) : null;
}

export async function saveFicha(ficha: EpitomeFicha): Promise<EpitomeFicha> {
  const normalized = normalizarFicha({
    ...ficha,
    id: ficha.id || gerarFichaId(),
    _ts: Date.now(),
  });
  await db.fichas.put(normalized);
  return normalized;
}

export async function deleteFicha(id: string): Promise<void> {
  await db.fichas.delete(id);
}

// === Arsenal Global Independente (Glossário -> Armas) ===

export const ARSENAL_GLOSSARIO_ID = 'arsenal_armas_v1';

export async function saveArsenalCatalog(
  catalog: ArsenalCatalog
): Promise<void> {
  // Filtra kits internos de personagem (`wp_ep_*`) para manter o Arsenal limpo e independente
  const cleanWeapons: Record<string, Weapon> = {};
  const cleanAttacks: Record<string, Attack> = {};

  for (const [wid, wp] of Object.entries(catalog.weapons || {})) {
    if (!wp || wid.startsWith('wp_ep_')) continue;
    cleanWeapons[wid] = wp;
    for (const aid of wp.attackIds || []) {
      const atk = catalog.attacks?.[aid];
      if (atk) cleanAttacks[aid] = atk;
    }
  }
  for (const [aid, atk] of Object.entries(catalog.attacks || {})) {
    if (!atk || aid.startsWith('atk_ep_')) continue;
    cleanAttacks[aid] = atk;
  }

  await db.glossario.put({
    id: ARSENAL_GLOSSARIO_ID,
    termo: 'Arsenal de Armas',
    weapons: cleanWeapons,
    attacks: cleanAttacks,
    updatedAt: Date.now(),
  });
}

export async function loadOrSeedArsenalCatalog(
  existingMatchState?: AppState | null
): Promise<ArsenalCatalog> {
  const rec = await db.glossario.get(ARSENAL_GLOSSARIO_ID);
  if (rec && rec.weapons && typeof rec.weapons === 'object') {
    const weapons: Record<string, Weapon> = {};
    const attacks: Record<string, Attack> = { ...(rec.attacks || {}) };
    for (const [wid, wp] of Object.entries(rec.weapons as Record<string, Weapon>)) {
      if (wp && !wid.startsWith('wp_ep_')) {
        weapons[wid] = wp;
      }
    }
    return { weapons, attacks };
  }

  // Primeira inicialização: semeia catálogo padrão + preserva armas customizadas já presentes na partida
  const defaults = createDefaultArsenalCatalog();
  const mergedWeapons: Record<string, Weapon> = { ...defaults.weapons };
  const mergedAttacks: Record<string, Attack> = { ...defaults.attacks };

  if (existingMatchState) {
    for (const [wid, wp] of Object.entries(existingMatchState.weapons || {})) {
      if (!wid.startsWith('wp_ep_') && wid !== 'wp_dragon_maw') {
        mergedWeapons[wid] = wp;
      }
    }
    for (const [aid, atk] of Object.entries(existingMatchState.attacks || {})) {
      if (!aid.startsWith('atk_ep_')) {
        mergedAttacks[aid] = atk;
      }
    }
  }

  const seeded: ArsenalCatalog = {
    weapons: mergedWeapons,
    attacks: mergedAttacks,
  };
  await saveArsenalCatalog(seeded);
  return seeded;
}

// === Bestiário Global Independente (Glossário -> Monstros) ===

export const BESTIARIO_GLOSSARIO_ID = 'bestiario_monstros_v1';

export async function saveBestiaryCatalog(
  catalog: BestiaryCatalog
): Promise<void> {
  const clean: Record<string, BestiaryMonster> = {};
  for (const [id, mon] of Object.entries(catalog.monsters || {})) {
    if (!mon) continue;
    clean[id] = mon;
  }

  await db.glossario.put({
    id: BESTIARIO_GLOSSARIO_ID,
    termo: 'Bestiário de Monstros',
    monsters: clean,
    updatedAt: Date.now(),
  });
}

export async function loadOrSeedBestiaryCatalog(): Promise<BestiaryCatalog> {
  const rec = await db.glossario.get(BESTIARIO_GLOSSARIO_ID);
  if (rec && rec.monsters && typeof rec.monsters === 'object') {
    const monsters: Record<string, BestiaryMonster> = {};
    for (const [id, raw] of Object.entries(
      rec.monsters as Record<string, BestiaryMonster>
    )) {
      monsters[id] = normalizarMonstro(raw, id);
    }
    return { monsters };
  }

  const seeded = createDefaultBestiaryCatalog();
  await saveBestiaryCatalog(seeded);
  return seeded;
}

// === Mapas do Tabuleiro (Glossário -> Locais -> Mapas) ===

export const MAPAS_GLOSSARIO_ID = 'mapas_locais_v1';

export async function saveMapCatalog(catalog: MapCatalog): Promise<void> {
  const clean: Record<string, GameMap> = {};
  for (const [id, mapa] of Object.entries(catalog.maps || {})) {
    if (!mapa) continue;
    clean[id] = mapa;
  }

  await db.glossario.put({
    id: MAPAS_GLOSSARIO_ID,
    termo: 'Mapas do Tabuleiro',
    maps: clean,
    folders: catalog.folders ?? {},
    defaultMapId: catalog.defaultMapId ?? null,
    updatedAt: Date.now(),
  });
}

export async function loadOrSeedMapCatalog(
  baseBoard?: AppState['board'] | null,
  baseName?: string
): Promise<MapCatalog> {
  const rec = await db.glossario.get(MAPAS_GLOSSARIO_ID);
  if (rec && rec.maps && typeof rec.maps === 'object') {
    const maps: Record<string, GameMap> = {};
    for (const [id, raw] of Object.entries(rec.maps as Record<string, GameMap>)) {
      maps[id] = normalizarMapa(raw, id);
    }
    const catalogo = normalizarCatalogoMapas({
      maps,
      folders: rec.folders ?? {},
      defaultMapId: rec.defaultMapId,
    });
    // Migração silenciosa: pastas podem ter sido criadas ao normalizar
    if (!rec.folders) {
      saveMapCatalog(catalogo).catch(() => undefined);
    }
    return catalogo;
  }

  const seeded = createDefaultMapCatalog(baseBoard ?? undefined, baseName);
  await saveMapCatalog(seeded);
  return seeded;
}

// === Modelos Reutilizáveis ===

export async function saveCharacterTemplate(
  record: CharacterTemplateRecord
): Promise<void> {
  await db.characterTemplates.put(record);
}

export async function listCharacterTemplates(): Promise<CharacterTemplateRecord[]> {
  return db.characterTemplates.orderBy('createdAt').reverse().toArray();
}

export async function deleteCharacterTemplate(id: string): Promise<void> {
  await db.characterTemplates.delete(id);
}

export async function saveWeaponTemplate(
  record: WeaponTemplateRecord
): Promise<void> {
  await db.weaponTemplates.put(record);
}

export async function listWeaponTemplates(): Promise<WeaponTemplateRecord[]> {
  return db.weaponTemplates.orderBy('createdAt').reverse().toArray();
}

export async function deleteWeaponTemplate(id: string): Promise<void> {
  await db.weaponTemplates.delete(id);
}

// === Monitoramento de Storage ===

export interface StorageEstimateInfo {
  usage: number;
  quota: number;
  percent: number;
  warning: boolean;
}

export async function checkStorageEstimate(): Promise<StorageEstimateInfo> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.storage &&
    typeof navigator.storage.estimate === 'function'
  ) {
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      const percent = quota > 0 ? (usage / quota) * 100 : 0;
      return {
        usage,
        quota,
        percent,
        warning: percent > 80,
      };
    } catch {
      // Ignora em contextos restritos
    }
  }
  return { usage: 0, quota: 0, percent: 0, warning: false };
}

// === Conversão Blob <-> DataURL para Exportação/Importação JSON ===

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function buildExportedMatchPayload(
  state: AppState
): Promise<ExportedMatchJSON> {
  const referencedImageIds = new Set<string>();
  for (const ch of Object.values(state.characters)) {
    if (ch.imageId) referencedImageIds.add(ch.imageId);
  }
  for (const wp of Object.values(state.weapons)) {
    if (wp.iconId) referencedImageIds.add(wp.iconId);
  }
  const arsenalRec = await db.glossario.get(ARSENAL_GLOSSARIO_ID);
  if (arsenalRec?.weapons) {
    for (const wp of Object.values(arsenalRec.weapons as Record<string, Weapon>)) {
      if (wp?.iconId) referencedImageIds.add(wp.iconId);
    }
  }

  const bestiaryRec = await db.glossario.get(BESTIARIO_GLOSSARIO_ID);
  const bestiaryMonsters = bestiaryRec?.monsters
    ? Object.values(bestiaryRec.monsters as Record<string, BestiaryMonster>)
    : [];
  for (const mon of bestiaryMonsters) {
    if (mon?.imagemId) referencedImageIds.add(mon.imagemId);
  }

  const images: ExportedImage[] = [];
  for (const imgId of referencedImageIds) {
    const rec = await db.images.get(imgId);
    if (rec) {
      const dataUrl = await blobToDataUrl(rec.blob);
      images.push({
        id: rec.id,
        dataUrl,
        mimeType: rec.mimeType,
      });
    }
  }

  return {
    version: state.version || '1.0',
    exportedAt: new Date().toISOString(),
    matchName: state.matchName,
    board: state.board,
    characters: Object.values(state.characters),
    weapons: Object.values(state.weapons),
    attacks: Object.values(state.attacks),
    images,
    combat: state.combat,
    settings: state.settings,
    lastAttack: state.lastAttack
      ? {
          ...state.lastAttack,
          attackerPosition: state.lastAttack.attackerPosition
            ? { ...state.lastAttack.attackerPosition }
            : null,
          targetOrigin: { ...state.lastAttack.targetOrigin },
          cells: state.lastAttack.cells.map((c) => ({ ...c })),
        }
      : null,
    bestiary: bestiaryMonsters,
  };
}

export async function exportStateToJSON(state: AppState): Promise<string> {
  const payload = await buildExportedMatchPayload(state);
  return JSON.stringify(payload, null, 2);
}

export async function parseMatchPayloadToAppState(
  parsed: ExportedMatchJSON
): Promise<AppState> {
  if (!parsed || !parsed.board || !Array.isArray(parsed.characters)) {
    throw new Error(
      'Arquivo JSON inválido: estrutura de partida não reconhecida.'
    );
  }

  if (Array.isArray(parsed.images)) {
    for (const img of parsed.images) {
      if (img.id && img.dataUrl) {
        const blob = await dataUrlToBlob(img.dataUrl);
        await saveImageBlob(
          img.id,
          blob,
          img.mimeType || blob.type || 'image/png'
        );
      }
    }
  }

  const characters: Record<string, Character> = {};
  for (const ch of parsed.characters) {
    characters[ch.id] = ch;
  }

  const weapons: Record<string, Weapon> = {};
  for (const wp of parsed.weapons || []) {
    weapons[wp.id] = wp;
  }

  const attacks: Record<string, Attack> = {};
  for (const atk of parsed.attacks || []) {
    attacks[atk.id] = atk;
  }

  return {
    version: parsed.version || '1.0',
    matchName: parsed.matchName || 'Partida Importada',
    board: {
      id: parsed.board.id || `board_${Date.now()}`,
      width: Math.max(4, Math.min(80, Number(parsed.board.width) || 20)),
      height: Math.max(4, Math.min(80, Number(parsed.board.height) || 15)),
      terrain: parsed.board.terrain || {},
    },
    characters,
    weapons,
    attacks,
    combat: parsed.combat || {
      mode: 'free',
      turnOrder: [],
      activeCharacterId: null,
      round: 1,
    },
    history: {
      past: [],
      future: [],
    },
    settings: {
      diagonalRule: 'chebyshev',
      damageRule: 'attack_only',
      showCoordinates: true,
      showGrid: true,
      checkLoSOnAttacks: true,
      fogMode: 'day',
      fogRangeMode: 'global',
      fogGlobalRange: 8,
      fogIntensity: 1,
      fogLocked: false,
      ...(parsed.settings || {}),
    },
    lastAttack:
      parsed.lastAttack && Array.isArray(parsed.lastAttack.cells)
        ? {
            ...parsed.lastAttack,
            attackerPosition: parsed.lastAttack.attackerPosition
              ? { ...parsed.lastAttack.attackerPosition }
              : null,
            targetOrigin: { ...parsed.lastAttack.targetOrigin },
            cells: parsed.lastAttack.cells.map((c) => ({ ...c })),
          }
        : null,
  };
}

export async function importStateFromJSON(jsonString: string): Promise<AppState> {
  const parsed = JSON.parse(jsonString);
  if (parsed?.tabuleiro && parsed.tabuleiro.board) {
    return parseMatchPayloadToAppState(parsed.tabuleiro);
  }
  return parseMatchPayloadToAppState(parsed as ExportedMatchJSON);
}

// === Exportação / Importação Unificada do Grimório do Mestre + Tabuleiro ===

export interface GrimorioExportPayload {
  versao: number;
  exportadoEm: string;
  aplicacao: 'grimorio_mestre';
  stores: {
    fichas: EpitomeFicha[];
    sistema: Record<string, any>[];
    glossario: Record<string, any>[];
    construcao: Record<string, any>[];
    config: Record<string, any>[];
  };
  tabuleiro?: ExportedMatchJSON;
}

export async function exportGrimorioCompletoJSON(
  currentBoardState: AppState
): Promise<{ json: string; totalFichas: number; nomeArquivo: string }> {
  const [fichas, sistema, glossario, construcao, config, tabuleiro] =
    await Promise.all([
      listFichas(),
      db.sistema.toArray(),
      db.glossario.toArray(),
      db.construcao.toArray(),
      db.config.toArray(),
      buildExportedMatchPayload(currentBoardState),
    ]);

  const agora = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const stamp = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(
    agora.getDate()
  )}-${pad(agora.getHours())}-${pad(agora.getMinutes())}-${pad(
    agora.getSeconds()
  )}`;

  const payload: GrimorioExportPayload = {
    versao: 1,
    exportadoEm: agora.toISOString(),
    aplicacao: 'grimorio_mestre',
    stores: {
      fichas,
      sistema,
      glossario,
      construcao,
      config,
    },
    tabuleiro,
  };

  return {
    json: JSON.stringify(payload, null, 2),
    totalFichas: fichas.length,
    nomeArquivo: `grimorio-${stamp}.json`,
  };
}

export async function importGrimorioOuPartidaJSON(jsonString: string): Promise<{
  fichasImportadas: number;
  partidaImportada: AppState | null;
}> {
  const parsed = JSON.parse(jsonString);

  // Caso 1: Arquivo Grimório do Mestre (Spiritual-Epitome original ou unificado)
  if (parsed && parsed.aplicacao === 'grimorio_mestre' && parsed.stores) {
    let fichasCount = 0;
    if (Array.isArray(parsed.stores.fichas)) {
      const normalized = parsed.stores.fichas.map((raw: any) =>
        normalizarFicha(raw)
      );
      await db.fichas.bulkPut(normalized);
      fichasCount = normalized.length;
    }
    if (Array.isArray(parsed.stores.sistema) && parsed.stores.sistema.length) {
      await db.sistema.bulkPut(parsed.stores.sistema);
    }
    if (
      Array.isArray(parsed.stores.glossario) &&
      parsed.stores.glossario.length
    ) {
      await db.glossario.bulkPut(parsed.stores.glossario);
    }
    if (
      Array.isArray(parsed.stores.construcao) &&
      parsed.stores.construcao.length
    ) {
      await db.construcao.bulkPut(parsed.stores.construcao);
    }
    if (Array.isArray(parsed.stores.config) && parsed.stores.config.length) {
      await db.config.bulkPut(parsed.stores.config);
    }

    let partidaImportada: AppState | null = null;
    if (parsed.tabuleiro && parsed.tabuleiro.board) {
      partidaImportada = await parseMatchPayloadToAppState(parsed.tabuleiro);
    }
    return { fichasImportadas: fichasCount, partidaImportada };
  }

  // Caso 2: Arquivo direto de partida do Tabuleiro Tático
  if (parsed && parsed.board && Array.isArray(parsed.characters)) {
    const state = await parseMatchPayloadToAppState(
      parsed as ExportedMatchJSON
    );
    // Bestiário embutido no ficheiro de partida (Glossário -> Monstros)
    if (Array.isArray(parsed.bestiary) && parsed.bestiary.length) {
      const atual = await loadOrSeedBestiaryCatalog();
      const merged = { ...atual.monsters };
      for (const raw of parsed.bestiary) {
        const mon = normalizarMonstro(raw);
        merged[mon.id] = mon;
      }
      await saveBestiaryCatalog({ monsters: merged });
    }
    return { fichasImportadas: 0, partidaImportada: state };
  }

  throw new Error(
    'Arquivo inválido: não é um backup do Grimório do Mestre nem uma partida do Tabuleiro.'
  );
}
