import { describe, expect, it, vi } from 'vitest';
import { changedMetadata, parseMetadata, summarizeChange } from './history-format';
import { chordProToLyrics, chordSheetWarnings } from './editor-checks';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
const { markCurrent } = await import('./editing');

const meta = (o: Record<string, string | null>) =>
  JSON.stringify({
    title: 'Doxologia',
    artist: null,
    category: 'Adoração',
    original_key: 'G',
    media_url: null,
    notes: null,
    ...o,
  });

describe('histórico', () => {
  it('marca como atual só a versão mais recente de cada campo', () => {
    const list = markCurrent([
      { id: '4', field: 'chords' as const },
      { id: '3', field: 'lyrics' as const },
      { id: '2', field: 'chords' as const },
      { id: '1', field: 'official_key' as const },
    ]);
    expect(list.map((v) => [v.id, v.isCurrent])).toEqual([
      ['4', true],
      ['3', true],
      ['2', false],
      ['1', true],
    ]);
  });

  it('lê os dados da música gravados em JSON, com rótulos em português', () => {
    expect(parseMetadata(meta({}))).toEqual([
      ['Título', 'Doxologia'],
      ['Autor', '—'],
      ['Categoria', 'Adoração'],
      ['Tom original', 'G'],
      ['Link de mídia', '—'],
      ['Observações', '—'],
    ]);
    expect(parseMetadata('não é json')).toBeNull();
    expect(parseMetadata(null)).toBeNull();
  });

  it('mostra só os dados que mudaram', () => {
    expect(changedMetadata(meta({}), meta({ title: 'Doxologia (nova)', notes: 'x' }))).toEqual([
      { label: 'Título', before: 'Doxologia', after: 'Doxologia (nova)' },
      { label: 'Observações', before: '—', after: 'x' },
    ]);
  });

  it('resume cada tipo de alteração numa linha', () => {
    expect(summarizeChange('official_key', 'D', 'E')).toBe('D → E');
    expect(summarizeChange('official_key', null, 'G')).toBe('sem tom → G');
    expect(summarizeChange('official_key', 'G', null)).toBe('G → sem tom');
    expect(summarizeChange('lyrics', null, 'a\nb')).toBe('Criada com 2 linhas');
    expect(summarizeChange('chords', 'a', 'a\nb\nc')).toBe('1 linha → 3 linhas');
    expect(summarizeChange('metadata', null, meta({}))).toBe('Música cadastrada');
    expect(summarizeChange('metadata', meta({}), meta({ category: 'Hino' }))).toBe(
      'Mudou: Categoria',
    );
  });
});

describe('editor de cifra', () => {
  it('avisa acordes não reconhecidos, colchete sem par e falta de {key}', () => {
    expect(chordSheetWarnings('{key: G}\n[G]Santo [D/F#]santo')).toEqual([]);
    expect(chordSheetWarnings('[G]Santo [Xyz]santo [G')).toEqual([
      'Não reconhecido como acorde (não será transposto): Xyz.',
      'Colchete sem par em 1 linha.',
      'Sem {key: …}: o seletor de tom vai usar o tom original cadastrado.',
    ]);
    expect(chordSheetWarnings('   ')).toEqual(['A cifra está vazia.']);
  });

  it('tira a letra da cifra para começar a edição da letra', () => {
    expect(
      chordProToLyrics('{title: X}\n{key: G}\n{c: Refrão}\n[G]Santo, [D]santo\n\n[C]Deus'),
    ).toBe('Santo, santo\n\nDeus');
  });
});
