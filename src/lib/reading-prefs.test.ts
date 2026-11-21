import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEXT_SIZE,
  nextTextSize,
  readLastTab,
  readTextSize,
  saveLastTab,
  saveTextSize,
  TEXT_SIZES,
} from './reading-prefs';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}
const blocked = {
  getItem: () => {
    throw new Error('bloqueado');
  },
  setItem: () => {
    throw new Error('bloqueado');
  },
};

describe('tamanho da letra (botão Aa)', () => {
  it('3 tamanhos; o padrão é o médio (20px)', () => {
    expect(TEXT_SIZES.map((s) => s.px)).toEqual([17, 20, 24]);
    expect(TEXT_SIZES.map((s) => s.label)).toEqual(['Pequena', 'Média', 'Grande']);
    expect(DEFAULT_TEXT_SIZE).toBe(1);
    expect(readTextSize(memory())).toBe(1);
  });

  it('Aa alterna em círculo: pequena → média → grande → pequena', () => {
    expect(nextTextSize(0)).toBe(1);
    expect(nextTextSize(1)).toBe(2);
    expect(nextTextSize(2)).toBe(0);
  });

  it('guarda e lê no aparelho', () => {
    const storage = memory();
    saveTextSize(2, storage);
    expect(storage.data.get('louvor.tamanho-letra')).toBe('2');
    expect(readTextSize(storage)).toBe(2);
    expect(readTextSize(memory({ 'louvor.tamanho-letra': '0' }))).toBe(0);
  });

  it('valor estranho volta ao médio', () => {
    expect(readTextSize(memory({ 'louvor.tamanho-letra': '7' }))).toBe(1);
    expect(readTextSize(memory({ 'louvor.tamanho-letra': '' }))).toBe(1);
    expect(readTextSize(memory({ 'louvor.tamanho-letra': '1.5' }))).toBe(1);
  });

  it.each([
    ['0', 0],
    ['1', 0],
    ['2', 1],
    ['3', 2],
    ['4', 2],
    ['5', 1],
    ['x', 1],
  ])('tamanho antigo %s (de 5) vira %i', (old, size) => {
    expect(readTextSize(memory({ 'repertorio:tamanho-letra': old }))).toBe(size);
  });

  it('sem armazenamento: médio e sem erro', () => {
    expect(readTextSize(blocked)).toBe(1);
    expect(readTextSize(null)).toBe(1);
    expect(() => saveTextSize(0, blocked)).not.toThrow();
    expect(() => saveTextSize(0, null)).not.toThrow();
  });
});

describe('última aba (Cifra | Letra)', () => {
  it('lembra a escolha', () => {
    const storage = memory();
    expect(readLastTab(storage)).toBeNull();
    saveLastTab('letra', storage);
    expect(storage.data.get('louvor.aba')).toBe('letra');
    expect(readLastTab(storage)).toBe('letra');
    saveLastTab('cifra', storage);
    expect(readLastTab(storage)).toBe('cifra');
  });

  it('valor estranho ou armazenamento bloqueado: sem escolha', () => {
    expect(readLastTab(memory({ 'louvor.aba': 'partitura' }))).toBeNull();
    expect(readLastTab(blocked)).toBeNull();
    expect(readLastTab(null)).toBeNull();
    expect(() => saveLastTab('letra', blocked)).not.toThrow();
  });
});
