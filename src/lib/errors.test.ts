import { describe, expect, it } from 'vitest';
import { friendlyError, NoRowsAffectedError, requireAffected } from './errors';

describe('friendlyError', () => {
  it('RLS e GRANT viram "sem permissão"', () => {
    expect(
      friendlyError({
        code: '42501',
        message: 'new row violates row-level security policy for table "song_chords"',
      }),
    ).toBe('Você não tem permissão para fazer essa alteração.');
    expect(friendlyError({ code: '42501', message: 'permission denied for table profiles' })).toBe(
      'Você não tem permissão para fazer essa alteração.',
    );
  });

  it('mensagens dos triggers (já em português) passam como estão', () => {
    expect(
      friendlyError({
        code: '42501',
        message: 'Sem permissão para alterar o tom oficial da música.',
      }),
    ).toBe('Sem permissão para alterar o tom oficial da música.');
    expect(friendlyError({ code: 'P0002', message: 'Versão não encontrada.' })).toBe(
      'Versão não encontrada.',
    );
    expect(
      friendlyError({ code: 'P0001', message: 'Não é permitido alterar o dono do ministério' }),
    ).toBe('Não é permitido alterar o dono do ministério.');
  });

  it('mensagem técnica em inglês nunca chega ao usuário', () => {
    expect(friendlyError({ code: 'P0001', message: 'unexpected internal state' })).toBe(
      'Não foi possível concluir a operação. Tente de novo.',
    );
    expect(friendlyError({ code: 'XX000', message: 'boom' }, 'Não foi possível salvar.')).toBe(
      'Não foi possível salvar.',
    );
  });

  it('constraints conhecidas têm mensagem própria', () => {
    expect(
      friendlyError({
        code: '23505',
        message:
          'duplicate key value violates unique constraint "event_assignments_event_id_user_id_function_id_key"',
      }),
    ).toBe('Essa pessoa já está escalada nessa função.');
    expect(
      friendlyError({
        code: '23514',
        message:
          'new row for relation "events" violates check constraint "events_ends_after_starts"',
      }),
    ).toBe('O término precisa ser depois do início.');
    expect(friendlyError({ code: '23505', message: 'duplicate key value violates "x"' })).toBe(
      'Esse registro já existe.',
    );
  });

  it('rede, sessão e login', () => {
    expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/Sem conexão/);
    expect(friendlyError({ code: 'PGRST301', message: 'JWT expired' })).toBe(
      'Sua sessão expirou. Entre de novo.',
    );
    expect(friendlyError(new Error('Invalid login credentials'))).toBe(
      'E-mail ou senha incorretos.',
    );
  });

  it('UPDATE barrado pelo RLS (0 linhas) vira erro de permissão', () => {
    expect(() => requireAffected([])).toThrow(NoRowsAffectedError);
    expect(() => requireAffected(null)).toThrow(NoRowsAffectedError);
    expect(requireAffected([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(friendlyError(new NoRowsAffectedError())).toMatch(/Nada foi salvo/);
  });

  it('valores estranhos usam o texto padrão', () => {
    expect(friendlyError(undefined)).toBe('Não foi possível concluir a operação. Tente de novo.');
    expect(friendlyError(42)).toBe('Não foi possível concluir a operação. Tente de novo.');
  });
});
