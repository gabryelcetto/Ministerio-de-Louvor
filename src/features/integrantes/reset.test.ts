import { describe, expect, it, vi } from 'vitest';

// O módulo importa o cliente Supabase (que exige variáveis de ambiente); aqui não há rede.
const invoke = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke } } }));

const { FunctionsHttpError } = await import('@supabase/supabase-js');
const { buildResetMessage, canResetPassword, resetMemberPassword } = await import('./reset');
const { EdgeFunctionError } = await import('./edge');
const { parseResetInput } = await import('../../../supabase/functions/_shared/reset.ts');
const { friendlyError } = await import('@/lib/errors');

const owner = { id: 'dono', isOwner: true, canManageMembers: true };
const admin = { id: 'adm', isOwner: false, canManageMembers: true };
const member = { id: 'm', isOwner: false, canManageMembers: false };

const target = (role: 'admin' | 'member', extra: { id?: string; isOwner?: boolean } = {}) => ({
  id: extra.id ?? 'alvo',
  role,
  isOwner: extra.isOwner ?? false,
});

describe('canResetPassword (espelho das regras do banco, só para a interface)', () => {
  it('admin redefine a senha de um integrante', () => {
    expect(canResetPassword(admin, target('member'))).toBe(true);
    expect(canResetPassword(owner, target('member'))).toBe(true);
  });

  it('sem members.manage, nunca', () => {
    expect(canResetPassword(member, target('member'))).toBe(false);
    expect(canResetPassword(null, target('member'))).toBe(false);
  });

  it('outro admin: só o dono', () => {
    expect(canResetPassword(admin, target('admin'))).toBe(false);
    expect(canResetPassword(owner, target('admin'))).toBe(true);
  });

  it('a senha do dono, ninguém (nem ele mesmo) redefine por aqui', () => {
    expect(canResetPassword(admin, target('admin', { id: 'dono', isOwner: true }))).toBe(false);
    expect(canResetPassword(owner, target('admin', { id: 'dono', isOwner: true }))).toBe(false);
  });

  it('a própria senha é em Configurações', () => {
    expect(canResetPassword(admin, target('admin', { id: 'adm' }))).toBe(false);
  });
});

describe('parseResetInput (mesma validação da Edge Function)', () => {
  it('aceita um uuid e normaliza', () => {
    expect(parseResetInput({ userId: ' 0F1E2D3C-4B5A-4978-8695-A4B3C2D1E0F9 ' })).toEqual({
      ok: true,
      value: { userId: '0f1e2d3c-4b5a-4978-8695-a4b3c2d1e0f9' },
    });
  });

  it('recusa o que não é uuid', () => {
    expect(parseResetInput({ userId: 'abc' })).toEqual({
      ok: false,
      error: 'Integrante inválido.',
    });
    expect(parseResetInput({})).toEqual({ ok: false, error: 'Integrante inválido.' });
    expect(parseResetInput(null)).toEqual({ ok: false, error: 'Dados inválidos.' });
    expect(parseResetInput(['x'])).toEqual({ ok: false, error: 'Dados inválidos.' });
  });
});

describe('buildResetMessage', () => {
  it('tem endereço, e-mail, senha provisória e o aviso da troca', () => {
    const text = buildResetMessage({
      fullName: 'Maria da Silva',
      email: 'maria@exemplo.com',
      temporaryPassword: 'Abc-123-xyz',
      appUrl: 'https://app.exemplo',
    });
    expect(text).toMatch(/^Olá, Maria! Sua senha do app/);
    expect(text).toContain('redefinida');
    expect(text).toContain('Endereço: https://app.exemplo');
    expect(text).toContain('E-mail: maria@exemplo.com');
    expect(text).toContain('Senha provisória: Abc-123-xyz');
    expect(text).toContain('criar uma senha nova');
  });
});

describe('resetMemberPassword', () => {
  it('chama a Edge Function com o id e devolve a senha', async () => {
    const result = {
      userId: 'u',
      fullName: 'Ana',
      email: 'ana@x.com',
      temporaryPassword: 'Senha-Provisoria-1',
    };
    invoke.mockResolvedValueOnce({ data: result, error: null });
    await expect(resetMemberPassword('u')).resolves.toEqual(result);
    expect(invoke).toHaveBeenLastCalledWith('reset-member-password', { body: { userId: 'u' } });
  });

  it('erro HTTP vira mensagem do servidor, em português', async () => {
    const response = new Response(
      JSON.stringify({
        error: 'Só o dono do ministério pode redefinir a senha de outro administrador.',
      }),
      { status: 403 },
    );
    invoke.mockResolvedValueOnce({ data: null, error: new FunctionsHttpError(response) });
    const error = await resetMemberPassword('u').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EdgeFunctionError);
    expect((error as InstanceType<typeof EdgeFunctionError>).status).toBe(403);
    expect(friendlyError(error)).toBe(
      'Só o dono do ministério pode redefinir a senha de outro administrador.',
    );
  });

  it('corpo sem JSON: mensagem genérica', async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: new FunctionsHttpError(new Response('oops', { status: 500 })),
    });
    const error = await resetMemberPassword('u').catch((e: unknown) => e);
    expect(friendlyError(error)).toBe('Não foi possível redefinir a senha. Tente de novo.');
  });
});
