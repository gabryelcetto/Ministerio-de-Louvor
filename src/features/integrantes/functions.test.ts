import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/supabase', () => ({ supabase: {} }));

const { functionFormSchema, nextSortOrder } = await import('./functions');
const { friendlyError } = await import('@/lib/errors');

describe('functionFormSchema (nova função do ministério)', () => {
  it('exige escolher o grupo (cantores ou instrumentistas)', () => {
    const r = functionFormSchema.safeParse({ name: 'Ministro(a)' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Escolha o grupo.');
  });

  it('aceita nome e grupo, sem espaços sobrando', () => {
    expect(functionFormSchema.parse({ name: '  Ministro(a) ', section: 'vocal' })).toEqual({
      name: 'Ministro(a)',
      section: 'vocal',
    });
  });

  it('recusa nome vazio ou grupo inexistente', () => {
    expect(functionFormSchema.safeParse({ name: ' ', section: 'vocal' }).success).toBe(false);
    expect(functionFormSchema.safeParse({ name: 'Coral', section: 'coral' }).success).toBe(false);
  });
});

describe('nextSortOrder', () => {
  it('vai para o fim da lista', () => {
    expect(nextSortOrder([{ sortOrder: 3 }, { sortOrder: 9 }, { sortOrder: 1 }])).toBe(10);
    expect(nextSortOrder([])).toBe(1);
  });
});

describe('nome repetido', () => {
  it('vira mensagem amigável', () => {
    expect(
      friendlyError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "ministry_functions_name_key"',
      }),
    ).toBe('Já existe uma função com esse nome.');
  });
});
