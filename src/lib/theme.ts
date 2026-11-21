/**
 * Tema do app: 'light' (claro), 'dark' (escuro) ou 'system' (automático, segue o celular).
 * Fica só neste aparelho (preferência pessoal de tela, não vai para o banco).
 *
 * Três lugares aplicam o tema, com a MESMA regra:
 * 1. script do index.html, antes do React (sem piscar a tela);
 * 2. ThemeProvider (src/hooks/use-theme.tsx), que reage às trocas e ao tema do celular;
 * 3. tela de login, que sempre segue o sistema.
 * TypeScript puro (sem React), para ser testado e mutado à vontade.
 */
export type ThemePref = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Chave no localStorage (a mesma do script do index.html). */
export const THEME_STORAGE_KEY = 'louvor.theme';
/** Chave antiga (até o design Louvor ADVOP): só 'light' ou 'dark'. */
export const LEGACY_THEME_STORAGE_KEY = 'tema';

/** Cor da barra do navegador/sistema em cada tema (meta theme-color = fundo da tela). */
export const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#F6F5F2',
  dark: '#121214',
};

export function parseThemePref(value: string | null | undefined): ThemePref {
  return value === 'light' || value === 'dark' ? value : 'system';
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Escolha salva neste aparelho, ou `null` se a pessoa nunca escolheu (aí aparece o modal de
 * primeiro acesso). Quem escolheu claro/escuro na versão anterior continua com a escolha.
 */
export function readStoredThemePref(
  storage: StorageLike | null = defaultStorage(),
): ThemePref | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
    const legacy = storage.getItem(LEGACY_THEME_STORAGE_KEY);
    return legacy === 'light' || legacy === 'dark' ? legacy : null;
  } catch {
    return null;
  }
}

/** Escolha atual (padrão: automático). */
export function readThemePref(storage: StorageLike | null = defaultStorage()): ThemePref {
  return readStoredThemePref(storage) ?? 'system';
}

/** A pessoa já escolheu o tema neste aparelho? (inclusive "automático"). */
export function hasChosenTheme(storage: StorageLike | null = defaultStorage()): boolean {
  return readStoredThemePref(storage) !== null;
}

/** Salva a escolha (inclusive 'system', que marca o modal como visto) e apaga a chave antiga. */
export function saveThemePref(pref: ThemePref, storage: StorageLike | null = defaultStorage()) {
  if (!storage) return;
  try {
    storage.setItem(THEME_STORAGE_KEY, pref);
    storage.removeItem(LEGACY_THEME_STORAGE_KEY);
  } catch {
    // Sem armazenamento (aba anônima bloqueada): o tema vale até fechar a página.
  }
}

/** O celular/computador está no modo escuro? */
export function systemPrefersDark(
  win: Pick<Window, 'matchMedia'> | undefined = globalThis.window,
): boolean {
  return win?.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemDark ? 'dark' : 'light';
  return pref;
}

/** Aplica no <html>: classe .dark, color-scheme e a cor da barra do sistema. */
export function applyTheme(theme: ResolvedTheme, doc: Document = document): void {
  const root = doc.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}
