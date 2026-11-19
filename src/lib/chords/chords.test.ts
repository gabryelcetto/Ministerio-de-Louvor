import { describe, expect, it } from 'vitest';
import {
  chordsOverLyricsToChordPro,
  extractChords,
  getDeclaredKey,
  isChord,
  isChordLine,
  keyPrefersFlats,
  normalizeKey,
  parseChord,
  parseChordPro,
  parseLine,
  spellPitchInKey,
  semitonesBetween,
  toSheetUnits,
  transposeChord,
  transposeChordPro,
  transposeChordProToKey,
  transposeKey,
} from './index';

describe('parseChordPro', () => {
  it('separa acordes e texto de uma linha', () => {
    expect(parseLine('A[G]mazing [G7]grace!')).toEqual([
      { chord: null, text: 'A' },
      { chord: 'G', text: 'mazing ' },
      { chord: 'G7', text: 'grace!' },
    ]);
  });

  it('aceita acorde no fim da linha e acordes seguidos', () => {
    expect(parseLine('soul.[C]')).toEqual([
      { chord: null, text: 'soul.' },
      { chord: 'C', text: '' },
    ]);
    expect(parseLine('[D7][G]roll')).toEqual([
      { chord: 'D7', text: '' },
      { chord: 'G', text: 'roll' },
    ]);
  });

  it('reconhece diretivas, comentários e linhas vazias', () => {
    const lines = parseChordPro('{title: Amazing Grace}\r\n{key: G}\n\n{c: Refrão}\n[G]Grace');
    expect(lines).toEqual([
      { type: 'directive', name: 'title', value: 'Amazing Grace' },
      { type: 'directive', name: 'key', value: 'G' },
      { type: 'empty' },
      { type: 'comment', text: 'Refrão' },
      { type: 'lyrics', segments: [{ chord: 'G', text: 'Grace' }] },
    ]);
  });

  it('lê o tom declarado e lista os acordes usados', () => {
    const song = '{key: D}\n[D]Joy to the [G]world, the [A]Lord is [D]come!';
    expect(getDeclaredKey(song)).toBe('D');
    expect(extractChords(song)).toEqual(['D', 'G', 'A']);
  });
});

describe('detecção de acordes (inclusive notação brasileira)', () => {
  it.each([
    'G',
    'Am',
    'F#m7',
    'Bb',
    'C7M',
    'D7(9)',
    'Bb7(9)',
    'Dm7(b5)',
    'Bm7b5',
    'B°',
    'Gº',
    'Esus4',
    'Cadd9',
    'D/F#',
    'A/C#',
    'G7(#11)',
    'C6(9)',
    'Ebmaj7',
    'F+',
    'Caug',
    'Cdim',
    'D4',
    'A2',
    'E7(b9)',
    'Am7(11)',
  ])('reconhece %s', (chord) => {
    expect(isChord(chord)).toBe(true);
  });

  it.each(['H', 'Amazing', 'grace', 'Do', 'x2', '', 'G/', 'Cmajestic'])('rejeita %s', (text) => {
    expect(isChord(text)).toBe(false);
  });

  it('separa tônica, sufixo e baixo', () => {
    expect(parseChord('F#m7(b5)/C')).toEqual({ root: 'F#', suffix: 'm7(b5)', bass: 'C' });
    expect(parseChord('D/F#')).toEqual({ root: 'D', suffix: '', bass: 'F#' });
  });
});

describe('transposição de acordes', () => {
  it('sobe e desce por semitons', () => {
    expect(transposeChord('G', 2, false)).toBe('A');
    expect(transposeChord('A', -2, false)).toBe('G');
    expect(transposeChord('B', 1, false)).toBe('C');
    expect(transposeChord('C', -1, false)).toBe('B');
    expect(transposeChord('G', 12, false)).toBe('G');
  });

  it('preserva a notação brasileira no sufixo', () => {
    expect(transposeChord('C7M', 2, false)).toBe('D7M');
    expect(transposeChord('E7(9)', 2, false)).toBe('F#7(9)');
    expect(transposeChord('F#m7(b5)', 2, false)).toBe('G#m7(b5)');
    expect(transposeChord('B°', 2, false)).toBe('C#°');
    expect(transposeChord('Esus4', 1, true)).toBe('Fsus4');
    expect(transposeChord('Cadd9', 3, true)).toBe('Ebadd9');
  });

  it('transpõe o baixo invertido junto', () => {
    expect(transposeChord('D/F#', 2, false)).toBe('E/G#');
    expect(transposeChord('D/F#', 1, true)).toBe('Eb/G');
    expect(transposeChord('A/C#', -2, false)).toBe('G/B');
  });

  it('escolhe sustenido ou bemol', () => {
    expect(transposeChord('G', 3, true)).toBe('Bb');
    expect(transposeChord('G', 3, false)).toBe('A#');
  });

  it('não mexe em texto que não é acorde', () => {
    expect(transposeChord('N.C.', 2, false)).toBe('N.C.');
  });
});

describe('tons', () => {
  it('calcula a distância entre tons', () => {
    expect(semitonesBetween('G', 'A')).toBe(2);
    expect(semitonesBetween('A', 'G')).toBe(10);
    expect(semitonesBetween('Em', 'Gm')).toBe(3);
  });

  it('normaliza a grafia e decide bemol/sustenido pelo tom', () => {
    expect(normalizeKey('A#')).toBe('Bb');
    expect(normalizeKey('Gb')).toBe('F#');
    expect(normalizeKey('D#m')).toBe('Ebm');
    expect(transposeKey('G', 3)).toBe('Bb');
    expect(transposeKey('Em', 1)).toBe('Fm');
    expect(keyPrefersFlats('F')).toBe(true);
    expect(keyPrefersFlats('Bb')).toBe(true);
    expect(keyPrefersFlats('Dm')).toBe(true);
    expect(keyPrefersFlats('D')).toBe(false);
    expect(keyPrefersFlats('F#m')).toBe(false);
  });
});

describe('transposição de cifras ChordPro', () => {
  const amazingGrace = `{title: Amazing Grace}
{key: G}
A[G]mazing [G7]grace! How [C]sweet the [G]sound
Was [Em]blind, but [D]now I [G]see.`;

  it('transpõe para um tom alvo (G → A) e atualiza {key}', () => {
    expect(transposeChordProToKey(amazingGrace, 'G', 'A')).toBe(`{title: Amazing Grace}
{key: A}
A[A]mazing [A7]grace! How [D]sweet the [A]sound
Was [F#m]blind, but [E]now I [A]see.`);
  });

  it('usa bemóis quando o tom de destino é bemol (G → F)', () => {
    const result = transposeChordProToKey(amazingGrace, 'G', 'F');
    expect(result).toContain('{key: F}');
    expect(result).toContain('[F7]grace');
    expect(result).toContain('[Bb]sweet');
    expect(result).toContain('[Dm]blind');
  });

  it('transpõe por semitons usando o {key} do conteúdo para escolher a grafia', () => {
    const result = transposeChordPro(amazingGrace, 3); // G → Bb
    expect(result).toContain('{key: Bb}');
    expect(result).toContain('[Eb]sweet');
    expect(result).not.toContain('#');
  });

  it('cifra brasileira com baixo invertido (A → G)', () => {
    const song = '{key: A}\nAo [A]Deus fiel, [E/G#]nunca [F#m]falha, [D/F#]sem[C#m7(b5)]pre';
    expect(transposeChordProToKey(song, 'A', 'G')).toBe(
      '{key: G}\nAo [G]Deus fiel, [D/F#]nunca [Em]falha, [C/E]sem[Bm7(b5)]pre',
    );
  });

  it('ida e volta devolve a cifra original', () => {
    const up = transposeChordPro(amazingGrace, 5);
    expect(transposeChordPro(up, -5)).toBe(amazingGrace);
  });
});

describe('conversor "acordes sobre a letra" → ChordPro', () => {
  it('identifica linhas de acordes', () => {
    expect(isChordLine('G       C        G')).toBe(true);
    expect(isChordLine('  E7M   A7M  | C#m7  F#7(9) |')).toBe(true);
    expect(isChordLine('Intro: G D Em C')).toBe(true);
    expect(isChordLine('Amazing grace, how sweet the sound')).toBe(false);
    expect(isChordLine('A mighty fortress is our God')).toBe(false);
    expect(isChordLine('')).toBe(false);
  });

  it('posiciona os acordes nas colunas certas', () => {
    const input = ['G          C       G', 'Amazing grace, how sweet the sound'].join('\n');
    expect(chordsOverLyricsToChordPro(input)).toBe('[G]Amazing gra[C]ce, how [G]sweet the sound');
  });

  it('acorde depois do fim da letra e linhas de introdução', () => {
    const input = ['Intro: G D Em C', '', 'D            G', 'Joy to the', 'Fim'].join('\n');
    expect(chordsOverLyricsToChordPro(input)).toBe(
      ['Intro: [G] [D] [Em] [C]', '', '[D]Joy to the   [G]', 'Fim'].join('\n'),
    );
  });

  it('converte cifra brasileira com baixo invertido', () => {
    const input = ['A       E/G#      F#m7(b5)', 'Ao Deus fiel que nunca falhará'].join('\n');
    expect(chordsOverLyricsToChordPro(input)).toBe(
      '[A]Ao Deus [E/G#]fiel que n[F#m7(b5)]unca falhará',
    );
  });

  it('acordes seguidos sem letra viram linha só de acordes', () => {
    expect(chordsOverLyricsToChordPro('G  D\nC  G')).toBe('[G] [D]\n[C] [G]');
  });
});

describe('layout para o celular', () => {
  it('mantém o acorde preso à sílaba e quebra entre palavras', () => {
    expect(toSheetUnits(parseLine('A[G]mazing grace how [C]sweet'))).toEqual([
      { chord: null, text: 'A' },
      { chord: 'G', text: 'mazing ' },
      { chord: null, text: 'grace ' },
      { chord: null, text: 'how ' },
      { chord: 'C', text: 'sweet' },
    ]);
  });

  it('acorde sem texto vira unidade própria', () => {
    expect(toSheetUnits(parseLine('soul.[C]'))).toEqual([
      { chord: null, text: 'soul.' },
      { chord: 'C', text: '' },
    ]);
  });
});

describe('grafia pelo grau no tom de destino (pendência 12)', () => {
  it('baixo de A/G em E vai para C/Bb em G (b3 de G), não C/A#', () => {
    expect(transposeChordProToKey('{key: E}\n[A/G]Sua bondade', 'E', 'G')).toBe(
      '{key: G}\n[C/Bb]Sua bondade',
    );
    expect(transposeChordPro('{key: E}\n[A/G]x', 3)).toBe('{key: G}\n[C/Bb]x');
  });

  it('tônica e baixo seguem a mesma regra', () => {
    // Em G: b7 = F, b6 = Eb, #4 = C#, 7 = F#.
    expect(transposeChord('G/F', 0, 'G')).toBe('G/F');
    expect(transposeChord('Bb/Ab', 0, 'C')).toBe('Bb/Ab');
    expect(transposeChord('D/C', 5, 'G')).toBe('G/F');
    expect(transposeChord('A#7', 0, 'G')).toBe('Bb7');
    expect(transposeChord('Gb/Db', 0, 'G')).toBe('F#/C#');
  });

  it('em tom menor, 3ª e 7ª maiores ficam com sustenido (dominante)', () => {
    expect(transposeChord('E7/Ab', 0, 'Am')).toBe('E7/G#');
    expect(transposeChord('A/Db', 0, 'Am')).toBe('A/C#');
    expect(transposeChord('Bb', 0, 'Am')).toBe('Bb');
  });

  it('tons de bemóis continuam com bemóis', () => {
    expect(transposeChordPro('{key: G}\n[G]a [D/F#]b [Em]c [C]d', 3)).toBe(
      '{key: Bb}\n[Bb]a [F/A]b [Gm]c [Eb]d',
    );
    expect(transposeChord('A#m', 0, 'Eb')).toBe('Bbm');
  });

  it('sem tom conhecido, ou com preferFlats forçado, mantém a escolha global', () => {
    expect(transposeChord('A/G', 3, false)).toBe('C/A#');
    expect(transposeChord('A/G', 3, true)).toBe('C/Bb');
    expect(transposeChordPro('[A/G]x', 3)).toBe('[C/A#]x');
    expect(transposeChordPro('{key: E}\n[A/G]x', 3, { preferFlats: false })).toBe(
      '{key: G}\n[C/A#]x',
    );
  });

  it('spellPitchInKey cobre os 12 graus de C e cai na grafia simples se precisar de dobrado', () => {
    expect(Array.from({ length: 12 }, (_, p) => spellPitchInKey(p, 'C'))).toEqual([
      'C',
      'Db',
      'D',
      'Eb',
      'E',
      'F',
      'F#',
      'G',
      'Ab',
      'A',
      'Bb',
      'B',
    ]);
    // Em C#m, o #4 seria F## (dobrado): usa G.
    expect(spellPitchInKey(7, 'C#m')).toBe('G');
  });
});
