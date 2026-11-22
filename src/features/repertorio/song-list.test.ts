import { describe, expect, it } from 'vitest';
import { applyFilter, parseFilter, parseOrder, sortSongs, type SongStat } from './song-list';

const songs = [
  { id: 'a', title: 'Bela', created_at: '2026-01-01T00:00:00Z' },
  { id: 'b', title: 'Água', created_at: '2026-03-01T00:00:00Z' },
  { id: 'c', title: 'Cálice', created_at: '2026-02-01T00:00:00Z' },
  { id: 'd', title: 'Doce', created_at: '2026-02-01T00:00:00Z' },
];
const stats = new Map<string, SongStat>([
  ['a', { playCount: 5, lastPlayedAt: '2026-11-01T00:00:00Z' }],
  ['c', { playCount: 2, lastPlayedAt: '2026-06-01T00:00:00Z' }],
  ['d', { playCount: 2, lastPlayedAt: '2026-11-15T00:00:00Z' }],
]);
const ids = (list: { id: string }[]) => list.map((s) => s.id);

describe('ordenação do repertório', () => {
  it('A–Z (com acento no lugar certo)', () => {
    expect(ids(sortSongs(songs, 'az'))).toEqual(['b', 'a', 'c', 'd']);
  });
  it('adicionadas recentemente (empate por título)', () => {
    expect(ids(sortSongs(songs, 'recentes'))).toEqual(['b', 'c', 'd', 'a']);
  });
  it('mais tocadas (sem contagem = 0)', () => {
    expect(ids(sortSongs(songs, 'mais-tocadas', stats))).toEqual(['a', 'c', 'd', 'b']);
  });
  it('há mais tempo sem tocar: nunca tocadas primeiro', () => {
    expect(ids(sortSongs(songs, 'sem-tocar', stats))).toEqual(['b', 'c', 'a', 'd']);
    expect(ids(sortSongs(songs, 'sem-tocar'))).toEqual(['b', 'a', 'c', 'd']);
  });
  it('não altera a lista original', () => {
    const copy = [...songs];
    sortSongs(songs, 'mais-tocadas', stats);
    expect(songs).toEqual(copy);
  });
});

describe('filtros e endereço', () => {
  it('lê ordem e filtro da URL (arquivadas só para quem pode)', () => {
    expect(parseOrder('mais-tocadas')).toBe('mais-tocadas');
    expect(parseOrder('xyz')).toBe('az');
    expect(parseOrder(null)).toBe('az');
    expect(parseFilter('audio', false)).toBe('audio');
    expect(parseFilter('favoritas', false)).toBe('favoritas');
    expect(parseFilter('arquivadas', false)).toBeNull();
    expect(parseFilter('arquivadas', true)).toBe('arquivadas');
    expect(parseFilter('outro', true)).toBeNull();
  });
  it('com áudio e favoritas', () => {
    expect(ids(applyFilter(songs, 'audio', { withAudio: new Set(['c']) }))).toEqual(['c']);
    expect(ids(applyFilter(songs, 'favoritas', { favorites: new Set(['a', 'd']) }))).toEqual([
      'a',
      'd',
    ]);
    expect(ids(applyFilter(songs, 'favoritas', {}))).toEqual([]);
    expect(ids(applyFilter(songs, null, {}))).toEqual(['a', 'b', 'c', 'd']);
  });
});
