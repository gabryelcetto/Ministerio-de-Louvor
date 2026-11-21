import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/supabase', () => ({ supabase: {} }));
const { songDataDefaults, songDataSchema } = await import('./song-data');

const valid = {
  title: 'Canção de exemplo',
  artist: '',
  category: 'Louvor',
  originalKey: 'G',
  mediaUrl: '',
  notes: '',
};

describe('dados da música', () => {
  it('aceita o mínimo (só título)', () => {
    expect(songDataSchema.safeParse({ ...valid, category: '', originalKey: '' }).success).toBe(
      true,
    );
  });

  it('mensagens em português', () => {
    const r = songDataSchema.safeParse({
      ...valid,
      title: ' ',
      originalKey: 'H',
      mediaUrl: 'youtube.com/x',
    });
    expect(r.error?.issues.map((i) => i.message)).toEqual([
      'Informe o título.',
      'Tom inválido.',
      'Use um link começando com https://',
    ]);
  });

  it('aceita tons menores e com acidente', () => {
    for (const key of ['F#m', 'Bb', 'C#', 'Ebm']) {
      expect(songDataSchema.safeParse({ ...valid, originalKey: key }).success).toBe(true);
    }
  });

  it('preenche o formulário a partir da música salva', () => {
    expect(
      songDataDefaults({
        title: 'T',
        artist: null,
        category: 'Hino',
        original_key: null,
        media_url: 'https://x.y',
        notes: null,
      }),
    ).toEqual({
      title: 'T',
      artist: '',
      category: 'Hino',
      originalKey: '',
      mediaUrl: 'https://x.y',
      notes: '',
    });
  });
});
