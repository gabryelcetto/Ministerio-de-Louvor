// Testes escritos a partir do relatório de mutação (Stryker): cada caso abaixo trava um
// comportamento que antes podia mudar sem nenhum teste perceber.
import { describe, expect, it } from 'vitest';
import { baseMimeType, chooseRecordingFormat, extensionFor } from './audio/format';
import { friendlyError, NoRowsAffectedError, requireAffected, UserFacingError } from './errors';
import { newPasswordSchema, PASSWORD_HINT } from './password';

describe('formato de áudio', () => {
  it.each([
    ['audio/webm', 'webm'],
    ['audio/ogg', 'ogg'],
    ['audio/mp4', 'm4a'],
    ['audio/x-m4a', 'm4a'],
    ['audio/aac', 'aac'],
    ['audio/mpeg', 'mp3'],
    ['audio/mp3', 'mp3'],
    ['audio/wav', 'wav'],
    ['audio/x-wav', 'wav'],
    ['audio/wave', 'wav'],
    ['audio/flac', 'flac'],
  ])('%s → .%s (o tipo vence o nome do arquivo)', (type, ext) => {
    expect(extensionFor(type, 'nome.xyz')).toBe(ext);
  });

  it('tipo com parâmetros, maiúsculas e espaços', () => {
    expect(baseMimeType(' Audio/WebM ; codecs=opus')).toBe('audio/webm');
    expect(extensionFor('AUDIO/MPEG')).toBe('mp3');
  });

  it('tipo desconhecido: usa a extensão do nome (só no fim, 2 a 5 letras)', () => {
    expect(extensionFor('', 'Voz Guia.OPUS')).toBe('opus');
    expect(extensionFor('application/octet-stream', 'gravacao.m4a')).toBe('m4a');
    expect(extensionFor('', 'arquivo.mp3.bak')).toBe('bak');
    expect(extensionFor('', 'sem-extensao')).toBe('audio');
    expect(extensionFor('', 'nome.a')).toBe('audio');
    expect(extensionFor('', 'nome.abcdef')).toBe('audio');
    expect(extensionFor('')).toBe('audio');
  });

  it('formato de gravação por navegador, na ordem de preferência', () => {
    expect(chooseRecordingFormat(() => true)).toEqual({
      mimeType: 'audio/webm;codecs=opus',
      extension: 'webm',
      bitsPerSecond: 32_000,
    });
    // Safari: só MP4
    expect(chooseRecordingFormat((t) => t === 'audio/mp4')).toEqual({
      mimeType: 'audio/mp4',
      extension: 'm4a',
      bitsPerSecond: 48_000,
    });
    expect(chooseRecordingFormat((t) => t === 'audio/webm')).toEqual({
      mimeType: 'audio/webm',
      extension: 'webm',
      bitsPerSecond: 32_000,
    });
    expect(chooseRecordingFormat((t) => t.startsWith('audio/ogg'))).toEqual({
      mimeType: 'audio/ogg;codecs=opus',
      extension: 'ogg',
      bitsPerSecond: 32_000,
    });
    expect(chooseRecordingFormat(() => false)).toBeNull();
  });
});

describe('friendlyError: todos os caminhos', () => {
  it('erros próprios do app', () => {
    const noRows = new NoRowsAffectedError();
    expect(noRows.name).toBe('NoRowsAffectedError');
    expect(noRows.message).toBe(
      'Nenhuma linha foi alterada (sem permissão ou registro inexistente).',
    );
    const user = new UserFacingError('Mensagem pronta.');
    expect(user.name).toBe('UserFacingError');
    expect(friendlyError(user)).toBe('Mensagem pronta.');
    expect(() => requireAffected([])).toThrow(NoRowsAffectedError);
    expect(() => requireAffected(null)).toThrow(NoRowsAffectedError);
    expect(requireAffected([1])).toEqual([1]);
  });

  it('texto solto, nulo e objetos sem os campos', () => {
    expect(friendlyError('Failed to fetch')).toBe('Sem conexão. Tente de novo.');
    expect(friendlyError('Mensagem em português já pronta')).toBe(
      'Não foi possível concluir. Tente de novo.',
    );
    expect(friendlyError(null, 'Padrão.')).toBe('Padrão.');
    expect(friendlyError({ code: 42, message: 7, details: {} }, 'Padrão.')).toBe('Padrão.');
    expect(friendlyError(42, 'Padrão.')).toBe('Padrão.');
  });

  it('a constraint pode vir nos detalhes, não só na mensagem', () => {
    expect(
      friendlyError({
        code: '23505',
        message: 'duplicate key',
        details: 'Key violates "event_songs_event_id_position_key"',
      }),
    ).toBe('Já existe uma música nessa posição do repertório.');
    expect(
      friendlyError({ code: '23503', message: 'x', details: 'event_songs_song_id_fkey' }),
    ).toBe('Esta música está no repertório de algum evento.');
    expect(friendlyError({ code: '', message: 'x', details: 7 }, 'Padrão.')).toBe('Padrão.');
  });

  it('sessão e Auth, pelo código ou pelo texto', () => {
    const expired = 'Sua sessão expirou. Entre de novo.';
    expect(friendlyError({ code: 'PGRST301', message: 'x' })).toBe(expired);
    expect(friendlyError({ code: 'PGRST303', message: 'x' })).toBe(expired);
    expect(friendlyError({ code: '', message: 'JWT expired' })).toBe(expired);
    expect(friendlyError({ code: '', message: 'Email not confirmed' })).toBe(
      'E-mail ainda não confirmado.',
    );
    expect(
      friendlyError({
        code: '',
        message: 'New password should be different from the old password.',
      }),
    ).toBe('A nova senha precisa ser diferente da atual.');
    expect(friendlyError({ code: 'same_password', message: 'x' })).toBe(
      'A nova senha precisa ser diferente da atual.',
    );
    expect(
      friendlyError({ code: '', message: 'Password should contain at least one character' }),
    ).toBe('Senha fraca: use pelo menos 10 caracteres, com letras e números.');
    expect(friendlyError({ code: 'weak_password', message: 'x' })).toBe(
      'Senha fraca: use pelo menos 10 caracteres, com letras e números.',
    );
  });

  it('códigos do Postgres/PostgREST', () => {
    expect(friendlyError({ code: '23503', message: 'fk' })).toBe(
      'Há um registro relacionado que não existe ou ainda está em uso.',
    );
    expect(friendlyError({ code: '23514', message: 'check' })).toBe(
      'Algum valor informado não é válido.',
    );
    expect(friendlyError({ code: '23502', message: 'null' })).toBe(
      'Preencha todos os campos obrigatórios.',
    );
    for (const code of ['22P02', '22007', '22008']) {
      expect(friendlyError({ code, message: 'invalid' })).toBe(
        'Algum valor está num formato inválido.',
      );
    }
    expect(friendlyError({ code: 'PGRST116', message: 'no rows' })).toBe(
      'Registro não encontrado.',
    );
  });

  it('42501: mensagem própria (com acento) passa; RLS e GRANT viram "sem permissão"', () => {
    const permission = 'Você não tem permissão para isso. Fale com um administrador.';
    expect(friendlyError({ code: '42501', message: 'permission denied for table x' })).toBe(
      permission,
    );
    expect(friendlyError({ code: '42501', message: 'new row violates row-level security' })).toBe(
      permission,
    );
    expect(friendlyError({ code: '42501', message: '  Só o dono pode fazer isso  ' })).toBe(
      'Só o dono pode fazer isso.',
    );
    expect(friendlyError({ code: '42501', message: 'Ação não permitida!' })).toBe(
      'Ação não permitida!',
    );
    expect(friendlyError({ code: 'P0001', message: 'Música já existe?' })).toBe(
      'Música já existe?',
    );
    expect(friendlyError({ code: 'P0001', message: 'english only' }, 'Padrão.')).toBe('Padrão.');
  });
});

describe('senha nova', () => {
  it('dica e erro da confirmação no campo certo', () => {
    expect(PASSWORD_HINT).toBe('Mínimo de 10 caracteres, com letras e números.');
    const result = newPasswordSchema.safeParse({ password: 'SenhaBoa2026', confirm: 'Outra2026x' });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['confirm'], message: 'As senhas não são iguais.' }),
    ]);
    const weak = newPasswordSchema.safeParse({ password: 'curta', confirm: 'curta' });
    expect(weak.error?.issues.map((i) => [i.path, i.message])).toContainEqual([
      ['password'],
      'Use pelo menos 10 caracteres.',
    ]);
  });
});
