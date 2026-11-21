/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectPlatform, shouldOfferInstall } from './install';
import { contrastRatio, parseHex, readTokens } from './contrast';

// O Vitest não processa CSS (um import `?raw` de .css vem vazio): lê o arquivo do disco.
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

describe('tokens do design (contraste WCAG AA)', () => {
  const block = (selector: string) => {
    const start = css.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThan(-1);
    return readTokens(css.slice(start, css.indexOf('}', start)));
  };
  const light = block('.light');
  const dark = block('.dark');

  it('os dois temas definem os mesmos tokens, com os valores aprovados', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
    expect(light).toMatchObject({
      'ds-bg': '#f6f5f2',
      'ds-accent': '#c2410c',
      'ds-chord': '#b4400b',
      'ds-rec': '#dc2626',
    });
    expect(dark).toMatchObject({
      'ds-bg': '#121214',
      'ds-accent': '#f97316',
      'ds-chord': '#fb923c',
      'ds-rec': '#ef4444',
    });
  });

  it.each([
    ['claro', light],
    ['escuro', dark],
  ])('tema %s: todo texto com contraste ≥ 4.5:1', (_name, t) => {
    const pairs: [string, string][] = [
      ['ds-ink', 'ds-bg'],
      ['ds-ink', 'ds-surface'],
      ['ds-ink', 'ds-chip'],
      ['ds-muted', 'ds-bg'],
      ['ds-muted', 'ds-surface'],
      ['ds-muted', 'ds-chip'],
      ['ds-accent-ink', 'ds-accent'],
      ['ds-accent-text', 'ds-accent-soft'],
      ['ds-accent-text', 'ds-surface'],
      ['ds-chord', 'ds-surface'],
      ['ds-chord', 'ds-bg'],
    ];
    for (const [fg, bg] of pairs) {
      expect(contrastRatio(t[fg]!, t[bg]!), `${fg} sobre ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('sem azul-marinho, roxo nem dourado antigos', () => {
    for (const old of ['#1b2a4a', '#d4a83a', 'oklch(0.3 0.07 264)', 'oklch(0.8 0.13 85)']) {
      expect(css).not.toContain(old);
    }
  });
});

describe('contraste (fórmula WCAG)', () => {
  it('preto sobre branco é 21:1 e a ordem não importa', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('valores conhecidos e cores inválidas', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(parseHex('#0aF')).toEqual([0, 170, 255]);
    expect(() => parseHex('#12')).toThrow('Cor inválida');
    expect(() => parseHex('azul')).toThrow('Cor inválida');
    expect(readTokens('--a: #ABC; --b: red; --c:#123456;')).toEqual({ a: '#abc', c: '#123456' });
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
