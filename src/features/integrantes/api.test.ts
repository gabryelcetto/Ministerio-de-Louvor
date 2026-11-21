import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const { buildMembers, matchesName, telHref } = await import('./api');

const fn = (name: string, sort_order: number, section = 'instrumental') => ({
  function: { name, sort_order, section },
});

describe('buildMembers', () => {
  const rows = [
    {
      id: 'u2',
      full_name: 'Zélia Souza',
      display_name: null,
      access_role: 'member' as const,
      is_owner: false,
      status: 'active' as const,
      member_functions: [fn('Bateria', 7), fn('Backing vocal', 2, 'vocal'), { function: null }],
    },
    {
      id: 'u1',
      full_name: 'Ana Administradora',
      display_name: 'Ana',
      access_role: 'admin' as const,
      is_owner: true,
      status: 'inactive' as const,
      member_functions: [],
    },
  ];

  it('ordena por nome, funções na ordem do ministério e marca inativos', () => {
    const members = buildMembers(rows, null);
    expect(members.map((m) => [m.name, m.functions, m.active, m.phone])).toEqual([
      ['Ana', [], false, null],
      ['Zélia Souza', ['Backing vocal', 'Bateria'], true, null],
    ]);
  });

  it('leva a marca de dono do ministério', () => {
    const members = buildMembers(rows, null);
    expect(members.map((m) => [m.id, m.isOwner])).toEqual([
      ['u1', true],
      ['u2', false],
    ]);
  });

  it('selos de grupo: cantora e instrumentista ao mesmo tempo', () => {
    const members = buildMembers(rows, null);
    expect(members.find((m) => m.id === 'u2')?.sections).toEqual(['vocal', 'instrumental']);
    expect(members.find((m) => m.id === 'u1')?.sections).toEqual([]);
  });

  it('só preenche telefone quando os contatos vieram do banco', () => {
    const members = buildMembers(rows, new Map([['u2', '(00) 90000-0003']]));
    expect(members.find((m) => m.id === 'u2')?.phone).toBe('(00) 90000-0003');
    expect(members.find((m) => m.id === 'u1')?.phone).toBeNull();
  });

  it('busca ignora acentos e maiúsculas, no apelido ou no nome completo', () => {
    const [ana, zelia] = buildMembers(rows, null);
    expect(matchesName(zelia!, 'zelia')).toBe(true);
    expect(matchesName(ana!, 'administ')).toBe(true);
    expect(matchesName(ana!, 'bruno')).toBe(false);
    expect(matchesName(ana!, '  ')).toBe(true);
  });

  it('monta link tel: só com números válidos', () => {
    expect(telHref('(11) 98765-4321')).toBe('tel:11987654321');
    expect(telHref('+55 11 98765-4321')).toBe('tel:+5511987654321');
    expect(telHref('ramal 12')).toBeNull();
  });
});
