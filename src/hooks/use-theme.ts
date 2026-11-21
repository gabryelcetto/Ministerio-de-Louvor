import { createContext, useContext, useEffect } from 'react';
import type { ResolvedTheme, ThemePref } from '@/lib/theme';

export interface ThemeState {
  /** Escolha da pessoa ('system' = automático). */
  pref: ThemePref;
  /** Tema que está valendo agora (o automático já resolvido). */
  resolved: ResolvedTheme;
  /** Já escolheu neste aparelho? (senão, o app mostra o modal de primeiro acesso). */
  chosen: boolean;
  setPref: (pref: ThemePref) => void;
  /** Mostra outro tema sem salvar (prévia no modal); `null` volta ao escolhido. */
  preview: (pref: ThemePref | null) => void;
}

export const ThemeContext = createContext<ThemeState | null>(null);

/** Tema atual e a troca (precisa do <ThemeProvider>, de src/hooks/theme-provider.tsx). */
export function useTheme(): ThemeState {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme precisa estar dentro de <ThemeProvider>');
  return value;
}

/** Enquanto a tela estiver aberta, mostra o tema do sistema (tela de login). */
export function useSystemThemeWhileMounted() {
  const { preview } = useTheme();
  useEffect(() => {
    preview('system');
    return () => preview(null);
  }, [preview]);
}
