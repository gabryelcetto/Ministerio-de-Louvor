import { describe, expect, it } from 'vitest';
import {
  applyTheme,
  hasChosenTheme,
  LEGACY_THEME_STORAGE_KEY,
  parseThemePref,
  readStoredThemePref,
  readThemePref,
  resolveTheme,
  saveThemePref,
  systemPrefersDark,
  THEME_COLOR,
  THEME_STORAGE_KEY,
} from './theme';

/** localStorage em memória. */
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}
const blocked = {
  getItem: () => {
    throw new Error('bloqueado');
  },
  setItem: () => {
    throw new Error('bloqueado');
  },
  removeItem: () => {
    throw new Error('bloqueado');
  },
};

describe('tema: escolha salva no aparelho', () => {
  it('chave louvor.theme; padrão automático', () => {
    expect(THEME_STORAGE_KEY).toBe('louvor.theme');
    expect(LEGACY_THEME_STORAGE_KEY).toBe('tema');
    expect(readThemePref(memory())).toBe('system');
    expect(hasChosenTheme(memory())).toBe(false);
  });

  it.each(['light', 'dark', 'system'] as const)('lê "%s" salvo', (pref) => {
    const storage = memory({ 'louvor.theme': pref });
    expect(readStoredThemePref(storage)).toBe(pref);
    expect(readThemePref(storage)).toBe(pref);
    expect(hasChosenTheme(storage)).toBe(true);
  });

  it('valor estranho conta como "nunca escolheu"', () => {
    expect(readStoredThemePref(memory({ 'louvor.theme': 'roxo' }))).toBeNull();
    expect(readThemePref(memory({ 'louvor.theme': '' }))).toBe('system');
  });

  it('quem escolheu claro/escuro na versão anterior (chave "tema") continua com a escolha', () => {
    expect(readStoredThemePref(memory({ tema: 'dark' }))).toBe('dark');
    expect(readStoredThemePref(memory({ tema: 'light' }))).toBe('light');
    expect(readStoredThemePref(memory({ tema: 'system' }))).toBeNull();
    // A chave nova vence a antiga.
    expect(readStoredThemePref(memory({ tema: 'dark', 'louvor.theme': 'light' }))).toBe('light');
  });

  it('salvar grava a escolha (inclusive automático) e apaga a chave antiga', () => {
    const storage = memory({ tema: 'dark' });
    saveThemePref('system', storage);
    expect(storage.data.get('louvor.theme')).toBe('system');
    expect(storage.data.has('tema')).toBe(false);
    expect(hasChosenTheme(storage)).toBe(true);
  });

  it('sem armazenamento (aba anônima bloqueada): automático e sem erro', () => {
    expect(readStoredThemePref(blocked)).toBeNull();
    expect(readThemePref(blocked)).toBe('system');
    expect(() => saveThemePref('dark', blocked)).not.toThrow();
    expect(readStoredThemePref(null)).toBeNull();
    expect(() => saveThemePref('dark', null)).not.toThrow();
  });

  it('parseThemePref: só claro/escuro; o resto é automático', () => {
    expect(parseThemePref('light')).toBe('light');
    expect(parseThemePref('dark')).toBe('dark');
    expect(parseThemePref('system')).toBe('system');
    expect(parseThemePref(null)).toBe('system');
    expect(parseThemePref('Dark')).toBe('system');
  });
});

describe('tema: resolver e aplicar', () => {
  it('automático segue o celular; claro e escuro são fixos', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('lê o tema do celular pelo matchMedia', () => {
    const win = (matches: boolean) =>
      ({
        matchMedia: (q: string) => ({ matches: q === '(prefers-color-scheme: dark)' && matches }),
      }) as unknown as Window;
    expect(systemPrefersDark(win(true))).toBe(true);
    expect(systemPrefersDark(win(false))).toBe(false);
    expect(systemPrefersDark({} as Window)).toBe(false);
    expect(systemPrefersDark(undefined)).toBe(false);
  });

  it('aplica a classe .dark, o color-scheme e a cor da barra do sistema', () => {
    const classes = new Set<string>();
    const meta = { content: '', setAttribute: (_: string, v: string) => (meta.content = v) };
    const root = {
      classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) },
      style: { colorScheme: '' },
    };
    const doc = {
      documentElement: root,
      querySelector: (sel: string) => (sel === 'meta[name="theme-color"]' ? meta : null),
    } as unknown as Document;

    applyTheme('dark', doc);
    expect(classes.has('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');
    expect(meta.content).toBe('#121214');
    applyTheme('light', doc);
    expect(classes.has('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
    expect(meta.content).toBe('#F6F5F2');
    expect(THEME_COLOR).toEqual({ light: '#F6F5F2', dark: '#121214' });

    // Sem a meta theme-color, não quebra.
    applyTheme('dark', { ...doc, querySelector: () => null } as unknown as Document);
  });
});
