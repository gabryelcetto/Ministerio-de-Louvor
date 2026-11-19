/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectPlatform, shouldOfferInstall } from './install';
import { applyTheme, parseThemePref } from './theme';

// O Vitest não processa CSS (um import `?raw` de .css vem vazio): lê o arquivo do disco.
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

describe('tema', () => {
  it('só aceita claro/escuro; o resto é "sistema"', () => {
    expect(parseThemePref('light')).toBe('light');
    expect(parseThemePref('dark')).toBe('dark');
    expect(parseThemePref('system')).toBe('system');
    expect(parseThemePref(null)).toBe('system');
    expect(parseThemePref('roxo')).toBe('system');
  });

  it('marca o <html> com data-theme, ou tira a marca para seguir o sistema', () => {
    const root = { dataset: {} as Record<string, string> } as unknown as HTMLElement;
    applyTheme('dark', root);
    expect(root.dataset.theme).toBe('dark');
    applyTheme('system', root);
    expect(root.dataset.theme).toBeUndefined();
  });

  it('os dois blocos do tema escuro (sistema e escolha manual) têm as mesmas cores', () => {
    const block = (selector: string) => {
      const start = css.indexOf(selector);
      expect(start, selector).toBeGreaterThan(-1);
      const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
      return body
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    };
    const system = block(":root:not([data-theme='light'])");
    const manual = block(":root[data-theme='dark']");
    expect(manual).toEqual(system);
    expect(system).toContain('color-scheme: dark;');
  });
});

describe('instalação do app', () => {
  it('reconhece iPhone, iPad (que se apresenta como Mac) e Android', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(
      'ios',
    );
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(
      'other',
    );
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe('android');
  });

  it('o aviso no Início só aparece para quem pode instalar e ainda não instalou', () => {
    const base = { canPrompt: false, installed: false, platform: 'other' as const };
    expect(shouldOfferInstall(base)).toBe(false); // Firefox no computador: não tem como
    expect(shouldOfferInstall({ ...base, canPrompt: true })).toBe(true); // Android/Chrome
    expect(shouldOfferInstall({ ...base, platform: 'ios' })).toBe(true); // iPhone: passo a passo
    expect(shouldOfferInstall({ ...base, platform: 'ios', installed: true })).toBe(false);
  });
});
