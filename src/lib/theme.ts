import { useCallback, useState } from 'react';

/**
 * Tema escolhido pela pessoa. "system" segue o aparelho. Fica só neste navegador (preferência
 * pessoal de tela, não precisa ir para o banco). O index.html aplica antes da primeira pintura.
 */
export type ThemePref = 'light' | 'dark' | 'system';

/** Mesma chave usada no script do index.html. */
export const THEME_STORAGE_KEY = 'tema';

export function parseThemePref(value: string | null | undefined): ThemePref {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function readThemePref(): ThemePref {
  try {
    return parseThemePref(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function applyTheme(pref: ThemePref, root: HTMLElement = document.documentElement): void {
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
}

export function saveThemePref(pref: ThemePref): void {
  try {
    if (pref === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Sem armazenamento (aba anônima): o tema vale até fechar a página.
  }
}

export function useThemePref(): [ThemePref, (pref: ThemePref) => void] {
  const [pref, setPref] = useState(readThemePref);
  const update = useCallback((next: ThemePref) => {
    setPref(next);
    saveThemePref(next);
    applyTheme(next);
  }, []);
  return [pref, update];
}
