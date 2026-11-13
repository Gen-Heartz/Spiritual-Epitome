import { getImageBlob, saveImageBlob } from '../db/database';

const MAX_TOKEN_SIZE = 256;

// Cache em memória de HTMLImageElement e ObjectURLs para renderização instantânea no Canvas e DOM
const imageElementCache = new Map<string, HTMLImageElement>();
const objectUrlCache = new Map<string, string>();
const pendingLoads = new Set<string>();
const imageLoadListeners = new Set<() => void>();

export function onImageCacheUpdated(listener: () => void): () => void {
  imageLoadListeners.add(listener);
  return () => imageLoadListeners.delete(listener);
}

function notifyImageListeners() {
  for (const fn of imageLoadListeners) {
    fn();
  }
}

export function registerBlobInMemoryCache(id: string, blob: Blob): string {
  const existingUrl = objectUrlCache.get(id);
  if (existingUrl) {
    URL.revokeObjectURL(existingUrl);
  }
  const url = URL.createObjectURL(blob);
  objectUrlCache.set(id, url);

  const img = new Image();
  img.onload = () => {
    imageElementCache.set(id, img);
    notifyImageListeners();
  };
  img.src = url;
  return url;
}

export function getCachedImageElement(id: string): HTMLImageElement | null {
  if (!id) return null;
  const cached = imageElementCache.get(id);
  if (cached) return cached;

  if (!pendingLoads.has(id)) {
    pendingLoads.add(id);
    getImageBlob(id)
      .then((blob) => {
        if (blob) {
          registerBlobInMemoryCache(id, blob);
        }
      })
      .finally(() => {
        pendingLoads.delete(id);
      });
  }
  return null;
}

export async function ensureObjectUrl(id: string): Promise<string | null> {
  if (!id) return null;
  const cached = objectUrlCache.get(id);
  if (cached) return cached;
  const blob = await getImageBlob(id);
  if (!blob) return null;
  return registerBlobInMemoryCache(id, blob);
}

export function getCachedObjectUrl(id: string): string | null {
  if (!id) return null;
  const cached = objectUrlCache.get(id);
  if (cached) return cached;
  getCachedImageElement(id); // dispara carregamento assíncrono
  return null;
}

/**
 * Parte 4.7 — Importação e processamento automático de imagens:
 * - Formatos aceitos: JPG, PNG, WebP
 * - Redimensionamento até 256×256 preservando proporção
 * - Recorte circular automático no Canvas
 * - Armazenamento como Blob no IndexedDB com imageId único
 */
export async function importAndProcessImageFile(file: File): Promise<string> {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Formato não suportado. Utilize imagens JPG, PNG ou WebP.');
  }

  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Falha ao decodificar a imagem selecionada.'));
      el.src = bitmapUrl;
    });

    const size = Math.min(MAX_TOKEN_SIZE, Math.max(64, Math.max(img.width, img.height)));
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Contexto 2D indisponível.');

    // Recorte circular automático preservando proporção (cover centralizado sem distorcer)
    const r = size / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r - 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Fundo escuro discreto para imagens PNG com transparência
    ctx.fillStyle = '#181c26';
    ctx.fillRect(0, 0, size, size);

    const scale = Math.max(size / img.width, size / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const dx = (size - drawW) / 2;
    const dy = (size - drawH) / 2;
    ctx.drawImage(img, dx, dy, drawW, drawH);
    ctx.restore();

    // Anel metálico sutil de acabamento
    ctx.beginPath();
    ctx.arc(r, r, r - 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200, 164, 93, 0.75)';
    ctx.lineWidth = 3;
    ctx.stroke();

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Falha ao gerar Blob da imagem recortada.'));
      }, 'image/png');
    });

    const imageId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await saveImageBlob(imageId, blob, 'image/png');
    registerBlobInMemoryCache(imageId, blob);
    return imageId;
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

export interface EmblemPreset {
  id: string;
  label: string;
  bgStart: string;
  bgEnd: string;
  accent: string;
  symbol: 'knight' | 'archer' | 'mage' | 'dragon' | 'golem' | 'rogue' | 'skull' | 'crown' | 'sword' | 'bow' | 'staff' | 'dagger' | 'hammer' | 'claws';
}

export const EMBLEM_PRESETS: EmblemPreset[] = [
  { id: 'preset_knight', label: 'Guardião de Aço', bgStart: '#1e3a5f', bgEnd: '#0f172a', accent: '#e2c07d', symbol: 'knight' },
  { id: 'preset_archer', label: 'Patrulheiro', bgStart: '#1b4332', bgEnd: '#0b1d15', accent: '#74c69d', symbol: 'archer' },
  { id: 'preset_mage', label: 'Arcanista Ígneo', bgStart: '#4c1d95', bgEnd: '#1a0b36', accent: '#f59e0b', symbol: 'mage' },
  { id: 'preset_dragon', label: 'Dragão Ancião', bgStart: '#7f1d1d', bgEnd: '#280707', accent: '#fb923c', symbol: 'dragon' },
  { id: 'preset_golem', label: 'Colosso de Pedra', bgStart: '#374151', bgEnd: '#111827', accent: '#93c5fd', symbol: 'golem' },
  { id: 'preset_rogue', label: 'Lâmina Sombria', bgStart: '#312e81', bgEnd: '#09090b', accent: '#c084fc', symbol: 'rogue' },
  { id: 'preset_skull', label: 'Morto-Vivo', bgStart: '#134e4a', bgEnd: '#041f1e', accent: '#5eead4', symbol: 'skull' },
  { id: 'preset_crown', label: 'Soberano / Chefe', bgStart: '#78350f', bgEnd: '#1c0f04', accent: '#fde047', symbol: 'crown' },
];

export const WEAPON_ICON_PRESETS: EmblemPreset[] = [
  { id: 'wicon_sword', label: 'Espada', bgStart: '#27303f', bgEnd: '#111622', accent: '#e2c07d', symbol: 'sword' },
  { id: 'wicon_bow', label: 'Arco', bgStart: '#1f3528', bgEnd: '#0f1c14', accent: '#86efac', symbol: 'bow' },
  { id: 'wicon_staff', label: 'Cajado', bgStart: '#3b1d5e', bgEnd: '#160929', accent: '#fbbf24', symbol: 'staff' },
  { id: 'wicon_dagger', label: 'Adaga', bgStart: '#2e2546', bgEnd: '#120e1e', accent: '#d8b4fe', symbol: 'dagger' },
  { id: 'wicon_hammer', label: 'Martelo / Maça', bgStart: '#3f2e21', bgEnd: '#1a120b', accent: '#fdba74', symbol: 'hammer' },
  { id: 'wicon_claws', label: 'Garras / Fera', bgStart: '#541b1b', bgEnd: '#220808', accent: '#f87171', symbol: 'claws' },
];

function drawSymbolArtwork(
  ctx: CanvasRenderingContext2D,
  symbol: EmblemPreset['symbol'],
  accent: string
) {
  ctx.save();
  ctx.translate(128, 128);
  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (symbol) {
    case 'knight': {
      // Elmo medieval + escudo estilizado
      ctx.beginPath();
      ctx.moveTo(0, -68);
      ctx.bezierCurveTo(48, -62, 56, -16, 48, 28);
      ctx.lineTo(0, 68);
      ctx.lineTo(-48, 28);
      ctx.bezierCurveTo(-56, -16, -48, -62, 0, -68);
      ctx.closePath();
      ctx.globalAlpha = 0.22;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
      // Visor em cruz
      ctx.beginPath();
      ctx.moveTo(-30, -8);
      ctx.lineTo(30, -8);
      ctx.moveTo(0, -36);
      ctx.lineTo(0, 44);
      ctx.stroke();
      break;
    }
    case 'archer': {
      // Arco tencionado e flecha
      ctx.beginPath();
      ctx.arc(-14, 0, 56, -Math.PI * 0.42, Math.PI * 0.42);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-1, -54);
      ctx.lineTo(-26, 0);
      ctx.lineTo(-1, 54);
      ctx.stroke();
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-42, 0);
      ctx.lineTo(54, 0);
      ctx.moveTo(34, -16);
      ctx.lineTo(56, 0);
      ctx.lineTo(34, 16);
      ctx.stroke();
      break;
    }
    case 'mage': {
      // Runa arcana e chama central
      ctx.beginPath();
      ctx.arc(0, 0, 56, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, -56);
      ctx.bezierCurveTo(36, -18, 38, 24, 0, 52);
      ctx.bezierCurveTo(-38, 24, -36, -18, 0, -56);
      ctx.globalAlpha = 0.28;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 8, 14, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'dragon': {
      // Silhueta heráldica de cabeça/chifres de dragão
      ctx.beginPath();
      ctx.moveTo(-54, -56);
      ctx.lineTo(-22, -20);
      ctx.lineTo(0, -48);
      ctx.lineTo(22, -20);
      ctx.lineTo(54, -56);
      ctx.lineTo(42, 8);
      ctx.lineTo(18, 56);
      ctx.lineTo(0, 42);
      ctx.lineTo(-18, 56);
      ctx.lineTo(-42, 8);
      ctx.closePath();
      ctx.globalAlpha = 0.28;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
      // Olhos em brasa
      ctx.beginPath();
      ctx.arc(-16, 4, 6, 0, Math.PI * 2);
      ctx.arc(16, 4, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'golem': {
      // Monólito rúnico robusto
      ctx.beginPath();
      ctx.moveTo(-36, -54);
      ctx.lineTo(36, -54);
      ctx.lineTo(54, 4);
      ctx.lineTo(34, 56);
      ctx.lineTo(-34, 56);
      ctx.lineTo(-54, 4);
      ctx.closePath();
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-24, -16);
      ctx.lineTo(24, -16);
      ctx.moveTo(0, -16);
      ctx.lineTo(0, 28);
      ctx.stroke();
      break;
    }
    case 'rogue':
    case 'dagger': {
      ctx.rotate(-Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(0, -64);
      ctx.lineTo(14, 12);
      ctx.lineTo(-14, 12);
      ctx.closePath();
      ctx.globalAlpha = 0.32;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-28, 14);
      ctx.lineTo(28, 14);
      ctx.moveTo(0, 14);
      ctx.lineTo(0, 52);
      ctx.stroke();
      break;
    }
    case 'skull': {
      ctx.beginPath();
      ctx.arc(0, -12, 42, Math.PI * 0.85, Math.PI * 0.15, false);
      ctx.lineTo(24, 46);
      ctx.lineTo(-24, 46);
      ctx.closePath();
      ctx.globalAlpha = 0.24;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-15, -12, 8, 0, Math.PI * 2);
      ctx.arc(15, -12, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'crown': {
      ctx.beginPath();
      ctx.moveTo(-54, 34);
      ctx.lineTo(-48, -28);
      ctx.lineTo(-18, 6);
      ctx.lineTo(0, -42);
      ctx.lineTo(18, 6);
      ctx.lineTo(48, -28);
      ctx.lineTo(54, 34);
      ctx.closePath();
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
      break;
    }
    case 'sword': {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(0, -68);
      ctx.lineTo(11, 20);
      ctx.lineTo(-11, 20);
      ctx.closePath();
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-34, 22);
      ctx.lineTo(34, 22);
      ctx.moveTo(0, 22);
      ctx.lineTo(0, 58);
      ctx.stroke();
      break;
    }
    case 'bow': {
      ctx.beginPath();
      ctx.arc(-10, 0, 56, -Math.PI * 0.42, Math.PI * 0.42);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(4, -54);
      ctx.lineTo(-20, 0);
      ctx.lineTo(4, 54);
      ctx.stroke();
      break;
    }
    case 'staff': {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(0, -34);
      ctx.lineTo(0, 66);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -44, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -44, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'hammer': {
      ctx.rotate(-Math.PI / 5);
      ctx.beginPath();
      ctx.rect(-42, -56, 84, 38);
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(0, 62);
      ctx.stroke();
      break;
    }
    case 'claws': {
      for (const offset of [-30, 0, 30]) {
        ctx.beginPath();
        ctx.moveTo(offset - 18, -52);
        ctx.quadraticCurveTo(offset + 14, 0, offset - 6, 54);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

/**
 * Gera um retrato/ícone circular 256×256 para um dos presets heráldicos, salva no IndexedDB
 * (caso ainda não exista) e registra em memória.
 */
export async function ensurePresetEmblem(preset: EmblemPreset): Promise<string> {
  const existing = await getImageBlob(preset.id);
  if (existing) {
    registerBlobInMemoryCache(preset.id, existing);
    return preset.id;
  }

  if (typeof document === 'undefined') {
    return preset.id;
  }

  const canvas = document.createElement('canvas');
  canvas.width = MAX_TOKEN_SIZE;
  canvas.height = MAX_TOKEN_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return preset.id;

  const r = MAX_TOKEN_SIZE / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(r, r, r - 3, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  const grad = ctx.createRadialGradient(r, r * 0.7, 16, r, r, r);
  grad.addColorStop(0, preset.bgStart);
  grad.addColorStop(1, preset.bgEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, MAX_TOKEN_SIZE, MAX_TOKEN_SIZE);

  drawSymbolArtwork(ctx, preset.symbol, preset.accent);
  ctx.restore();

  // Moldura dupla estilo medalhão medieval
  ctx.beginPath();
  ctx.arc(r, r, r - 4, 0, Math.PI * 2);
  ctx.strokeStyle = preset.accent;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(r, r, r - 11, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  if (blob) {
    await saveImageBlob(preset.id, blob, 'image/png');
    registerBlobInMemoryCache(preset.id, blob);
  }
  return preset.id;
}

export async function initializeAllPresetEmblems(): Promise<void> {
  const all = [...EMBLEM_PRESETS, ...WEAPON_ICON_PRESETS];
  await Promise.all(all.map((p) => ensurePresetEmblem(p)));
}
