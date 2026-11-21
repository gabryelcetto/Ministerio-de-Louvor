/**
 * Preferências de leitura da tela da música, guardadas neste aparelho:
 * - tamanho da letra (botão "Aa" do dock: 3 tamanhos, alterna em círculo);
 * - última aba escolhida (Cifra ou Letra).
 * TypeScript puro (sem React).
 */
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const TEXT_SIZES = [
  { id: 'pequena', label: 'Pequena', px: 17 },
  { id: 'media', label: 'Média', px: 20 },
  { id: 'grande', label: 'Grande', px: 24 },
] as const;
export type TextSizeIndex = 0 | 1 | 2;
export const DEFAULT_TEXT_SIZE: TextSizeIndex = 1;
export const TEXT_SIZE_STORAGE_KEY = 'louvor.tamanho-letra';
/** Chave antiga: 5 tamanhos (0 a 4). */
export const LEGACY_TEXT_SIZE_STORAGE_KEY = 'repertorio:tamanho-letra';

function isTextSize(value: number): value is TextSizeIndex {
  return value === 0 || value === 1 || value === 2;
}

/** Tamanho salvo (ou o médio). Quem usava os 5 tamanhos antigos cai no mais próximo. */
export function readTextSize(storage: StorageLike | null = defaultStorage()): TextSizeIndex {
  try {
    const raw = storage?.getItem(TEXT_SIZE_STORAGE_KEY);
    const value = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
    if (isTextSize(value)) return value;
    const legacyRaw = storage?.getItem(LEGACY_TEXT_SIZE_STORAGE_KEY);
    const legacy = legacyRaw ? Number(legacyRaw) : NaN;
    if (Number.isInteger(legacy) && legacy >= 0 && legacy <= 4) {
      return legacy <= 1 ? 0 : legacy === 2 ? 1 : 2;
    }
  } catch {
    // Sem armazenamento: tamanho médio.
  }
  return DEFAULT_TEXT_SIZE;
}

export function saveTextSize(size: TextSizeIndex, storage: StorageLike | null = defaultStorage()) {
  try {
    storage?.setItem(TEXT_SIZE_STORAGE_KEY, String(size));
  } catch {
    // Sem armazenamento: vale só nesta visita.
  }
}

/** Próximo tamanho do "Aa": pequena → média → grande → pequena. */
export function nextTextSize(size: TextSizeIndex): TextSizeIndex {
  return ((size + 1) % TEXT_SIZES.length) as TextSizeIndex;
}

export type SongTab = 'cifra' | 'letra';
export const LAST_TAB_STORAGE_KEY = 'louvor.aba';

export function readLastTab(storage: StorageLike | null = defaultStorage()): SongTab | null {
  try {
    const value = storage?.getItem(LAST_TAB_STORAGE_KEY);
    return value === 'cifra' || value === 'letra' ? value : null;
  } catch {
    return null;
  }
}

export function saveLastTab(tab: SongTab, storage: StorageLike | null = defaultStorage()) {
  try {
    storage?.setItem(LAST_TAB_STORAGE_KEY, tab);
  } catch {
    // Sem armazenamento: vale só nesta visita.
  }
}
