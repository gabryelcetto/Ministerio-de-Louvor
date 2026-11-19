import { describe, expect, it } from 'vitest';
import { transposeChordPro } from '@/lib/chords';
import {
  currentKey,
  formatSemitones,
  keyOptions,
  mediaHost,
  normalizeSemitones,
  safeMediaUrl,
  semitonesTo,
  sheetBaseKey,
  uniqueCategories,
} from './song-key';

describe('tom-base da cifra', () => {
  it('usa o {key} da cifra e, sem ele, o tom original', () => {
    expect(sheetBaseKey('{key: D}\n[D]Santo', 'G')).toBe('D');
    expect(sheetBaseKey('[G]Sem diretiva', 'G')).toBe('G');
    expect(sheetBaseKey(null, 'A#')).toBe('Bb'); // grafia padrão
    expect(sheetBaseKey('[C]x', 'Dó')).toBeNull(); // tom inválido
    expect(sheetBaseKey(null, null)).toBeNull();
  });
});

describe('semitons', () => {
  it('normaliza para o caminho mais curto (-5..+6)', () => {
    expect(normalizeSemitones(7)).toBe(-5);
    expect(normalizeSemitones(-7)).toBe(5);
    expect(normalizeSemitones(12)).toBe(0);
    expect(normalizeSemitones(6)).toBe(6);
  });

  it('calcula quantos semitons até o tom alvo', () => {
    expect(semitonesTo('G', 'A')).toBe(2);
    expect(semitonesTo('G', 'E')).toBe(-3);
    expect(semitonesTo('G', 'xyz')).toBe(0);
    expect(semitonesTo(null, 'A')).toBe(0);
  });

  it('mostra o tom atual com a grafia padrão', () => {
    expect(currentKey('G', 3)).toBe('Bb');
    expect(currentKey('Em', 2)).toBe('F#m');
    expect(currentKey(null, 2)).toBeNull();
    expect(formatSemitones(0)).toBe('original');
    expect(formatSemitones(2)).toBe('+2');
    expect(formatSemitones(-1)).toBe('-1');
  });

  it('o seletor oferece tons do mesmo modo do tom-base', () => {
    expect(keyOptions('G')).toContain('Bb');
    expect(keyOptions('G')).toHaveLength(12);
    expect(keyOptions('Em').every((k) => k.endsWith('m'))).toBe(true);
  });

  it('"Tom oficial" transpõe a cifra inteira para o tom oficial', () => {
    const cifra = '{key: G}\nA[G]mazing [G7]grace! How [C]sweet the [G]sound';
    const semitones = semitonesTo(sheetBaseKey(cifra, null), 'A');
    expect(transposeChordPro(cifra, semitones, { fromKey: 'G' })).toBe(
      '{key: A}\nA[A]mazing [A7]grace! How [D]sweet the [A]sound',
    );
  });
});

describe('link de mídia', () => {
  it('só aceita http(s)', () => {
    expect(safeMediaUrl('https://www.youtube.com/watch?v=x')).toBe(
      'https://www.youtube.com/watch?v=x',
    );
    expect(safeMediaUrl('javascript:alert(1)')).toBeNull();
    expect(safeMediaUrl('não é link')).toBeNull();
    expect(safeMediaUrl('  ')).toBeNull();
    expect(safeMediaUrl(null)).toBeNull();
  });

  it('mostra o site sem "www."', () => {
    expect(mediaHost('https://www.youtube.com/watch?v=x')).toBe('youtube.com');
  });
});

describe('categorias', () => {
  it('distintas, sem vazias, em ordem alfabética', () => {
    expect(uniqueCategories(['Hino', null, 'Adoração', ' Hino ', '', 'Louvor'])).toEqual([
      'Adoração',
      'Hino',
      'Louvor',
    ]);
  });
});
