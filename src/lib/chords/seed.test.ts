import { describe, expect, it } from 'vitest';
import seed from '../../../supabase/seed.sql?raw';
import { getDeclaredKey, isChord, normalizeKey, parseChordPro } from './index';

/**
 * Confere o seed de demonstração sem precisar de banco: toda cifra é ChordPro válido, todo
 * acorde é reconhecido pela biblioteca e o {key} da cifra bate com o tom original da música.
 */
const songs = new Map<string, { title: string; originalKey: string | null }>();
for (const m of seed.matchAll(
  /\('(0{8}-0000-4000-8000-0{0,10}\d+)', '((?:[^']|'')*)', '(?:[^']|'')*', '[^']*', (?:'([^']*)'|null)/g,
)) {
  songs.set(m[1] as string, { title: m[2] as string, originalKey: m[3] ?? null });
}

const chordSheets = [...seed.matchAll(/\('(0{8}-[\d-]+)', \$c\$([\s\S]*?)\$c\$, '(\w+)'\)/g)].map(
  (m) => ({ id: m[1] as string, content: m[2] as string, status: m[3] as string }),
);
const lyrics = [...seed.matchAll(/\('(0{8}-[\d-]+)', \$t\$([\s\S]*?)\$t\$\)/g)].map((m) => ({
  id: m[1] as string,
  content: m[2] as string,
}));

describe('seed de demonstração', () => {
  it('tem de 10 a 12 músicas, todas com letra e cifra', () => {
    expect(songs.size).toBeGreaterThanOrEqual(10);
    expect(songs.size).toBeLessThanOrEqual(12);
    expect(new Set(chordSheets.map((c) => c.id))).toEqual(new Set(songs.keys()));
    expect(new Set(lyrics.map((l) => l.id))).toEqual(new Set(songs.keys()));
  });

  it.each(chordSheets)('cifra $id é ChordPro válido com acordes reconhecidos', ({ content }) => {
    const lines = parseChordPro(content);
    const chords = lines.flatMap((line) =>
      line.type === 'lyrics' ? line.segments.flatMap((s) => (s.chord ? [s.chord] : [])) : [],
    );
    expect(chords.length).toBeGreaterThan(0);
    expect(chords.filter((c) => !isChord(c))).toEqual([]);
  });

  it.each(chordSheets)('cifra $id declara o mesmo tom do cadastro', ({ id, content }) => {
    const declared = getDeclaredKey(content);
    const original = songs.get(id)?.originalKey ?? null;
    expect(declared && normalizeKey(declared)).toBe(original && normalizeKey(original));
  });

  it('a letra é a mesma da cifra, sem os acordes', () => {
    for (const { id, content } of lyrics) {
      const sheet = chordSheets.find((c) => c.id === id)?.content ?? '';
      const fromSheet = parseChordPro(sheet)
        .filter((l) => l.type === 'lyrics')
        .map((l) => (l.type === 'lyrics' ? l.segments.map((s) => s.text).join('') : ''))
        .join('\n');
      expect(fromSheet.replace(/\s+/g, ' ').trim(), id).toBe(content.replace(/\s+/g, ' ').trim());
    }
  });

  it('não sobrou nenhum hino em inglês', () => {
    expect(seed).not.toMatch(/Amazing grace|Holy, holy|mighty fortress|Rock of Ages/i);
  });
});
