import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const { buildMembers, matchesName, telHref } = await import('./api');

const fn = (name: string, sort_order: number) => ({ function: { name, sort_order } });

describe('buildMembers', () => {
  const rows = [
    {
      id: 'u2',
      full_name: 'Zélia Souza',
      display_name: null,
      access_role: 'member' as const,
      status: 'active' as const,
      member_functions: [fn('Bateria', 7), fn('Backing vocal', 2), { function: null }],
    },
    {
      id: 'u1',
      full_name: 'Ana Administradora',
      display_name: 'Ana',
      access_role: 'admin' as const,
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
