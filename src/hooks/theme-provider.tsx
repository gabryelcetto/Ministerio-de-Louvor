import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  applyTheme,
  hasChosenTheme,
  readThemePref,
  resolveTheme,
  saveThemePref,
  systemPrefersDark,
  type ThemePref,
} from '@/lib/theme';
import { ThemeContext } from './use-theme';

/**
 * Tema do app. Lê a escolha salva, segue o tema do celular no modo automático (inclusive se ele
 * mudar com o app aberto) e aplica a classe .dark no <html>. O script do index.html já aplicou o
 * tema antes do React, então aqui não há troca visível na abertura.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => readThemePref());
  const [chosen, setChosen] = useState(() => hasChosenTheme());
  const [previewPref, setPreviewPref] = useState<ThemePref | null>(null);
  const [systemDark, setSystemDark] = useState(() => systemPrefersDark());

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolved = resolveTheme(previewPref ?? pref, systemDark);
  useEffect(() => applyTheme(resolved), [resolved]);

  const setPref = useCallback((next: ThemePref) => {
    saveThemePref(next);
    setPrefState(next);
    setChosen(true);
    setPreviewPref(null);
  }, []);

  const value = useMemo(
    () => ({ pref, resolved, chosen, setPref, preview: setPreviewPref }),
    [pref, resolved, chosen, setPref],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
