import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/supabase', () => ({ supabase: {} }));
const { describeActivity } = await import('./api');

describe('descrição da atividade', () => {
  it('versões', () => {
    expect(
      describeActivity({ kind: 'version', field: 'metadata', changeType: 'create', action: null }),
    ).toBe('Cadastrou a música');
    expect(
      describeActivity({ kind: 'version', field: 'chords', changeType: 'update', action: null }),
    ).toBe('Editou a cifra');
    expect(
      describeActivity({ kind: 'version', field: 'lyrics', changeType: 'create', action: null }),
    ).toBe('Criou a letra');
    expect(
      describeActivity({
        kind: 'version',
        field: 'official_key',
        changeType: 'restore',
        action: null,
      }),
    ).toBe('Restaurou o tom oficial');
  });

  it('auditoria', () => {
    expect(
      describeActivity({ kind: 'audit', field: null, changeType: null, action: 'archive_song' }),
    ).toBe('Arquivou a música');
    expect(
      describeActivity({
        kind: 'audit',
        field: 'chords',
        changeType: null,
        action: 'restore_version',
      }),
    ).toBe('Restaurou uma versão (cifra)');
    expect(
      describeActivity({ kind: 'audit', field: null, changeType: null, action: 'outra' }),
    ).toBe('Alteração administrativa');
  });
});
