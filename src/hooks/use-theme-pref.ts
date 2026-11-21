import { useCallback, useState } from 'react';
import { applyTheme, readThemePref, saveThemePref, type ThemePref } from '@/lib/theme';

/** Tema escolhido pela pessoa, com a troca já salva e aplicada na página. */
export function useThemePref(): [ThemePref, (pref: ThemePref) => void] {
  const [pref, setPref] = useState(readThemePref);
  const update = useCallback((next: ThemePref) => {
    setPref(next);
    saveThemePref(next);
    applyTheme(next);
  }, []);
  return [pref, update];
}
