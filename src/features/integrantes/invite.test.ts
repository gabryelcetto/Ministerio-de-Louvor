import { describe, expect, it, vi } from 'vitest';

// O módulo importa o cliente Supabase (que exige variáveis de ambiente); aqui não há rede.
vi.mock('@/services/supabase', () => ({ supabase: {} }));

const { buildInviteMessage, inviteFormSchema, parseInviteInput, whatsappLink } =
  await import('./invite');

const valid = {
  fullName: 'Maria da Silva',
  displayName: 'Maria',
  email: 'maria@exemplo.com',
  accessRole: 'member',
  functionIds: [1, 3],
};

describe('parseInviteInput (mesma validação da Edge Function)', () => {
  it('normaliza nome, e-mail e funções', () => {
    expect(
      parseInviteInput({
        ...valid,
        fullName: '  Maria   da Silva ',
        email: ' Maria@Exemplo.COM ',
        functionIds: [3, 3, 1],
      }),
    ).toEqual({
      ok: true,
      value: {
        fullName: 'Maria da Silva',
        displayName: 'Maria',
        email: 'maria@exemplo.com',
        accessRole: 'member',
        functionIds: [3, 1],
      },
    });
  });

  it('perfil padrão é integrante e apelido vazio vira null', () => {
    const r = parseInviteInput({ fullName: 'Ana Souza', email: 'ana@x.com', displayName: '  ' });
    expect(r).toMatchObject({
      ok: true,
      value: { accessRole: 'member', displayName: null, functionIds: [] },
    });
  });

  it.each([
    [{ ...valid, fullName: 'A' }, 'Informe o nome completo (de 2 a 120 caracteres).'],
    [{ ...valid, email: 'maria@' }, 'Informe um e-mail válido.'],
    [{ ...valid, accessRole: 'owner' }, 'Perfil de acesso inválido.'],
    [{ ...valid, functionIds: [1, 'x'] }, 'Funções do ministério inválidas.'],
    [{ ...valid, functionIds: [0] }, 'Funções do ministério inválidas.'],
    [{ ...valid, displayName: 'x'.repeat(41) }, 'O nome de exibição pode ter até 40 caracteres.'],
    [null, 'Dados do cadastro inválidos.'],
    [[], 'Dados do cadastro inválidos.'],
  ])('recusa %j', (input, error) => {
    expect(parseInviteInput(input)).toEqual({ ok: false, error });
  });
});

describe('inviteFormSchema', () => {
  it('aceita o formulário completo', () => {
    expect(inviteFormSchema.safeParse(valid).success).toBe(true);
  });

  it('mensagens em português', () => {
    const r = inviteFormSchema.safeParse({ ...valid, fullName: ' ', email: 'x' });
    expect(r.error?.issues.map((i) => i.message)).toEqual([
      'Informe o nome completo.',
      'E-mail inválido.',
    ]);
  });
});

describe('mensagem para o WhatsApp', () => {
  const message = buildInviteMessage({
    fullName: 'Maria da Silva',
    email: 'maria@exemplo.com',
    temporaryPassword: 'Kp7m-Xq2r-8ZtA-w3Nd',
    appUrl: 'https://louvor.exemplo.workers.dev',
  });

  it('tem endereço do app, e-mail e senha provisória', () => {
    expect(message).toContain('Olá, Maria!');
    expect(message).toContain('Endereço: https://louvor.exemplo.workers.dev');
    expect(message).toContain('E-mail: maria@exemplo.com');
    expect(message).toContain('Senha provisória: Kp7m-Xq2r-8ZtA-w3Nd');
    expect(message).toContain('criar a sua própria senha');
  });

  it('link do WhatsApp com o texto codificado', () => {
    const link = whatsappLink(message);
    expect(link.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(link.slice('https://wa.me/?text='.length))).toBe(message);
  });
});
