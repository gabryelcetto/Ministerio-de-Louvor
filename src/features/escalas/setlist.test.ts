import { describe, expect, it } from 'vitest';
import {
  addSong,
  effectiveKey,
  move,
  moveLabel,
  removeAt,
  SETLIST_MAX,
  setlistChanged,
  toRpcItems,
  updateAt,
  type SetlistItem,
} from './setlist';

const song = (id: string, officialKey: string | null = 'G') => ({
  id,
  title: `Música ${id}`,
  artist: null,
  officialKey,
  originalKey: 'C',
});

const list = (): SetlistItem[] =>
  addSong(addSong(addSong([], song('a')), song('b')), song('c', null));

describe('repertório do evento em edição', () => {
  it('adiciona sem repetir e com o tom oficial (ou original) como padrão', () => {
    const l = list();
    expect(l.map((i) => i.songId)).toEqual(['a', 'b', 'c']);
    expect(l[0]!.defaultKey).toBe('G');
    expect(l[2]!.defaultKey).toBe('C');
    expect(addSong(l, song('a'))).toHaveLength(3);
    const full = Array.from({ length: SETLIST_MAX }, (_, i) => song(String(i))).reduce<
      SetlistItem[]
    >((acc, s) => addSong(acc, s), []);
    expect(addSong(full, song('x'))).toHaveLength(SETLIST_MAX);
  });

  it('reordena com subir e descer (nas pontas não muda)', () => {
    const l = list();
    expect(move(l, 1, -1).map((i) => i.songId)).toEqual(['b', 'a', 'c']);
    expect(move(l, 1, 1).map((i) => i.songId)).toEqual(['a', 'c', 'b']);
    expect(move(l, 0, -1).map((i) => i.songId)).toEqual(['a', 'b', 'c']);
    expect(move(l, 2, 1).map((i) => i.songId)).toEqual(['a', 'b', 'c']);
    expect(move(l, 9, 1).map((i) => i.songId)).toEqual(['a', 'b', 'c']);
    expect(moveLabel('Graça', -1)).toBe('Subir Graça');
    expect(moveLabel('Graça', 1)).toBe('Descer Graça');
  });

  it('remove, muda tom do dia e observação', () => {
    const l = updateAt(removeAt(list(), 1), 0, { key: 'A', notes: '  Abre ' });
    expect(l.map((i) => i.songId)).toEqual(['a', 'c']);
    expect(effectiveKey(l[0]!)).toBe('A');
    expect(effectiveKey(l[1]!)).toBe('C');
    expect(toRpcItems(l)).toEqual([
      { song_id: 'a', key_for_event: 'A', notes: 'Abre' },
      { song_id: 'c', key_for_event: null, notes: null },
    ]);
  });

  it('sabe se mudou algo', () => {
    const l = list();
    expect(setlistChanged(l, list())).toBe(false);
    expect(setlistChanged(l, move(l, 0, 1))).toBe(true);
    expect(setlistChanged(l, updateAt(l, 0, { notes: 'x' }))).toBe(true);
  });
});
