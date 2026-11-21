import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/supabase', () => ({ supabase: {} }));
const { isMediaUrl, newSongSchema, songDataDefaults, songDataSchema } = await import('./song-data');

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

describe('nova música: só o título é obrigatório', () => {
  it('o que não é obrigatório não bloqueia: corta ou deixa de fora', () => {
    const parsed = newSongSchema.parse({
      title: '  Santo  ',
      artist: 'a'.repeat(250),
      category: 'c'.repeat(80),
      originalKey: 'H',
      mediaUrl: 'youtube.com/x',
      notes: 'n'.repeat(1200),
    });
    expect(parsed.title).toBe('Santo');
    expect(parsed.artist).toHaveLength(200);
    expect(parsed.category).toHaveLength(60);
    expect(parsed.originalKey).toBe('');
    expect(parsed.mediaUrl).toBe('');
    expect(parsed.notes).toHaveLength(1000);
  });

  it('mantém o que é válido', () => {
    const parsed = newSongSchema.parse({
      title: 'Santo',
      artist: ' Hinário ',
      category: '',
      originalKey: 'F#m',
      mediaUrl: ' https://youtu.be/abc ',
      notes: '',
    });
    expect(parsed).toEqual({
      title: 'Santo',
      artist: 'Hinário',
      category: '',
      originalKey: 'F#m',
      mediaUrl: 'https://youtu.be/abc',
      notes: '',
    });
  });

  it('título continua obrigatório', () => {
    const result = newSongSchema.safeParse({
      title: ' ',
      artist: '',
      category: '',
      originalKey: '',
      mediaUrl: '',
      notes: '',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Informe o título.');
  });

  it('isMediaUrl', () => {
    expect(isMediaUrl('https://a.b/c')).toBe(true);
    expect(isMediaUrl('http://a')).toBe(true);
    expect(isMediaUrl('ftp://a')).toBe(false);
    expect(isMediaUrl('https://a b')).toBe(false);
  });
});
