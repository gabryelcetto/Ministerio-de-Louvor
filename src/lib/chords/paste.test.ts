import { describe, expect, it } from 'vitest';
import {
  convertPastedChords,
  detectPastedFormat,
  firstChordKey,
  guessKey,
  lyricsFromChordPro,
  withDeclaredKey,
} from './paste';

// Todos os textos são FICTÍCIOS (escritos para o teste), no formato em que os sites de cifra
// mostram: acordes numa linha, letra na de baixo, partes entre colchetes.
const SITE = [
  '[Intro] G  D/F#  Em7  C7M',
  '',
  '[Primeira Parte]',
  '',
  // Acordes alinhados com o início das palavras (coluna do acorde = posição na letra).
  'G'.padEnd(18) + 'D/F#',
  'Canto um verso de exemplo',
  'Em7'.padEnd(15) + 'C7M',
  'Nada aqui é de verdade',
  '',
  '[Refrão]',
  '',
  'C7M'.padEnd(13) + 'D7(9)',
  'Só um refrão inventado',
  'Bm7(b5)'.padEnd(14) + 'E7',
  'Para testar o conversor',
  '',
  'Parte 1 de 2',
  '[Final] C  D  G',
].join('\n');

describe('detecção do formato colado', () => {
  it('reconhece acordes em cima da letra (formato dos sites)', () => {
    expect(detectPastedFormat(SITE)).toBe('chords-over-lyrics');
  });
  it('reconhece ChordPro', () => {
    expect(detectPastedFormat('[G]Canto um [D]verso')).toBe('chordpro');
    expect(detectPastedFormat('{key: G}\nletra')).toBe('chordpro');
  });
  it('texto sem acordes é só letra', () => {
    expect(detectPastedFormat('Linha de letra\nOutra linha')).toBe('lyrics-only');
  });
  it('vazio', () => {
    expect(detectPastedFormat('  \n ')).toBe('empty');
  });
});

describe('conversão para ChordPro', () => {
  const { chordpro } = convertPastedChords(SITE);
  const lines = chordpro.split('\n');

  it('marcadores de parte viram comentários ({c: …})', () => {
    expect(lines).toContain('{c: Primeira Parte}');
    expect(lines).toContain('{c: Refrão}');
  });

  it('introdução e final com acordes viram linha só de acordes', () => {
    expect(lines.slice(0, 2)).toEqual(['{c: Intro}', '[G] [D/F#] [Em7] [C7M]']);
    expect(lines.slice(-2)).toEqual(['{c: Final}', '[C] [D] [G]']);
  });

  it('acorde em cima da sílaba, com baixo invertido e notação brasileira', () => {
    expect(lines).toContain('[G]Canto um verso de [D/F#]exemplo');
    expect(lines).toContain('[Em7]Nada aqui é de [C7M]verdade');
    expect(lines).toContain('[C7M]Só um refrão [D7(9)]inventado');
    expect(lines).toContain('[Bm7(b5)]Para testar o [E7]conversor');
  });

  it('remove "Parte 1 de 2" e linhas em branco repetidas', () => {
    expect(chordpro).not.toMatch(/Parte 1 de 2/);
    expect(chordpro).not.toMatch(/\n\n\n/);
  });

  it('ChordPro colado entra como está; "[Refrão]" sozinho vira comentário', () => {
    const r = convertPastedChords('[Refrão]\n[G]Canto [D]aqui');
    expect(r).toEqual({ format: 'chordpro', chordpro: '{c: Refrão}\n[G]Canto [D]aqui' });
  });

  it('linhas só de acordes seguidas (sem letra) não grudam na de baixo', () => {
    const r = convertPastedChords('G  D\nEm  C\n\nLetra solta');
    expect(r.chordpro).toBe('[G] [D]\n[Em] [C]\n\nLetra solta');
  });

  it('acordes com "°" e "sus4" e marcação de repetição', () => {
    const chords = 'G'.padEnd(4) + 'B°'.padEnd(6) + 'Esus4'.padEnd(9) + 'E'.padEnd(4) + '(x2)';
    const r = convertPastedChords(`${chords}\nUma linha qualquer da letra`);
    expect(r.chordpro).toBe('[G]Uma [B°]linha [Esus4]qualquer [E]da letra');
  });

  it('texto sem acordes não gera cifra', () => {
    expect(convertPastedChords('só letra')).toEqual({ format: 'lyrics-only', chordpro: '' });
  });
});

describe('letra a partir da cifra', () => {
  it('tira acordes, comentários e linhas só de acordes', () => {
    const { chordpro } = convertPastedChords(SITE);
    expect(lyricsFromChordPro(chordpro)).toBe(
      [
        'Canto um verso de exemplo',
        'Nada aqui é de verdade',
        '',
        'Só um refrão inventado',
        'Para testar o conversor',
      ].join('\n'),
    );
  });
});

describe('tom sugerido', () => {
  it('usa o {key} declarado', () => {
    expect(guessKey('{key: Bb}\n[C]x')).toBe('Bb');
  });
  it('tom maior pelo campo harmônico, primeiro e último acorde', () => {
    expect(guessKey(convertPastedChords(SITE).chordpro)).toBe('G');
    expect(guessKey('[D]a [A]b [Bm]c [G]d [D]e')).toBe('D');
  });
  it('tom menor quando começa e termina no acorde menor', () => {
    expect(guessKey('[Am]a [F]b [C]c [G]d [E7]e [Am]f')).toBe('Am');
  });
  it('sem acordes: null', () => {
    expect(guessKey('só letra')).toBeNull();
  });
  it('põe ou troca o {key}', () => {
    expect(withDeclaredKey('[G]x', 'G')).toBe('{key: G}\n[G]x');
    expect(withDeclaredKey('{key: C}\n[G]x', 'G')).toBe('{key: G}\n[G]x');
  });
});

describe('texto copiado de página web', () => {
  it('espaço não separável (U+00A0) conta como espaço normal', () => {
    const nbsp = String.fromCharCode(0xa0);
    const r = convertPastedChords(`G${nbsp.repeat(5)}D\nCanto um verso`);
    expect(r.chordpro).toBe('[G]Canto [D]um verso');
  });
});

describe('tom sugerido pelo primeiro acorde (Nova música)', () => {
  it.each([
    ['[G]Quão grande [D]és Tu', 'G'],
    ['[Intro] [Em7] [C]\n[Refrão]', 'Em'],
    ['[D/F#]Santo', 'D'],
    ['[F#m7(b5)]x', 'F#m'],
    ['[A#]x', 'Bb'],
    ['[Gb]x', 'F#'],
    ['[C#]x', 'Db'],
    ['[Bbmaj7]x', 'Bb'],
    ['[Am]x [G]y', 'Am'],
    ['[Cmin]x', 'Cm'],
    ['[Dbm]x', 'C#m'],
    ['[Refrão] só letra', null],
    ['', null],
  ])('%s → %s', (chordpro, key) => {
    expect(firstChordKey(chordpro)).toBe(key);
  });
});
