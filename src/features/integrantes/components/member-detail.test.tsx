// @vitest-environment happy-dom
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fake } from '@/test/fake-supabase';
import { ADMIN_ID, MEMBER_ID, OTHER_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));

const rpcArgs = (name: string) =>
  fake.calls
    .filter((c) => c.name === name)
    .map((c) => c.ops[0]!.args[0] as Record<string, unknown>);

describe('integrantes: lista, detalhe e edição', () => {
  it('lista filtra por grupo e por função; tocar no cartão abre o integrante', async () => {
    const { user, router } = renderApp('/integrantes', { as: 'member' });
    await findHeading('Integrantes');
    await screen.findByRole('link', { name: 'Isa' });
    const group = screen.getByRole('group', { name: 'Grupo' });
    await user.click(within(group).getByRole('button', { name: 'Cantores' }));
    expect(screen.getByRole('link', { name: 'Isa' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Lucas Teclado' })).toBeNull();
    await user.click(within(group).getByRole('button', { name: 'Todos' }));
    await user.selectOptions(screen.getByLabelText('Função'), 'Teclado');
    expect(screen.queryByRole('link', { name: 'Isa' })).toBeNull();
    await user.click(screen.getByRole('link', { name: 'Lucas Teclado' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/integrantes/${OTHER_ID}`));
  });

  it('integrante vê nome, funções e grupo, sem telefone e sem edição', async () => {
    renderApp(`/integrantes/${OTHER_ID}`, { as: 'member' });
    await findHeading('Lucas Teclado');
    expect(screen.getByText('Teclado')).toBeTruthy();
    expect(screen.getByText('Instrumentista')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Contato' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mais opções' })).toBeNull();
  });

  it('admin vê o telefone com "Ligar" e "WhatsApp" (DDI 55)', async () => {
    renderApp(`/integrantes/${MEMBER_ID}`, { as: 'admin' });
    await findHeading('Isa');
    const contact = await screen.findByRole('region', { name: 'Contato' });
    expect(within(contact).getByRole('link', { name: 'Ligar' }).getAttribute('href')).toBe(
      'tel:11987654321',
    );
    const wa = within(contact).getByRole('link', { name: /WhatsApp/ });
    expect(wa.getAttribute('href')).toBe('https://wa.me/5511987654321');
    expect(wa.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('admin edita dados e funções numa chamada', async () => {
    const { user } = renderApp(`/integrantes/${MEMBER_ID}`, { as: 'admin' });
    await findHeading('Isa');
    await user.click(await screen.findByRole('button', { name: 'Mais opções' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    const form = screen.getByRole('form', { name: 'Editar Isa' });
    const name = within(form).getByLabelText('Nome completo');
    await user.clear(name);
    await user.type(name, 'Isa Souza');
    await user.click(await within(form).findByRole('checkbox', { name: 'Violão' }));
    await user.click(within(form).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(rpcArgs('update_member')).toHaveLength(1));
    expect(rpcArgs('update_member')[0]).toMatchObject({
      p_user_id: MEMBER_ID,
      p_full_name: 'Isa Souza',
      p_display_name: 'Isa',
      p_phone: '(11) 98765-4321',
      p_function_ids: [1, 2],
    });
  });

  it('admin muda o perfil e desativa com a explicação; o erro do banco aparece', async () => {
    const { user } = renderApp(`/integrantes/${MEMBER_ID}`, { as: 'admin' });
    await findHeading('Isa');
    const role = await screen.findByRole('group', { name: 'Perfil de acesso' });
    await user.click(within(role).getByRole('radio', { name: 'Administração' }));
    await waitFor(() =>
      expect(fake.writes('profiles', 'update')).toEqual([{ access_role: 'admin' }]),
    );

    await user.click(screen.getByRole('button', { name: 'Mais opções' }));
    await user.click(screen.getByRole('menuitem', { name: 'Desativar' }));
    const dialog = screen.getByRole('dialog', { name: 'Desativar Isa?' });
    expect(
      within(dialog).getByText('A pessoa não consegue mais entrar, mas o histórico fica.'),
    ).toBeTruthy();
    fake.fail(
      'from',
      'profiles',
      { code: '42501', message: 'É preciso ter pelo menos um administrador ativo.' },
      'update',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Desativar' }));
    expect(
      await screen.findByText('É preciso ter pelo menos um administrador ativo.'),
    ).toBeTruthy();
  });

  it('no próprio perfil e no do dono não há desativar nem mudar perfil', async () => {
    const { user } = renderApp(`/integrantes/${ADMIN_ID}`, { as: 'admin' });
    await findHeading('Ana');
    await user.click(await screen.findByRole('button', { name: 'Mais opções' }));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Editar']);
    expect(screen.queryByRole('group', { name: 'Perfil de acesso' })).toBeNull();
  });

  it('integrante inexistente', async () => {
    renderApp('/integrantes/nao-existe', { as: 'member' });
    expect(await screen.findByText('Integrante não encontrado.')).toBeTruthy();
  });

  it('Minha conta: edita nome, apelido e telefone', async () => {
    const { user } = renderApp('/configuracoes', { as: 'member' });
    await findHeading('Configurações');
    expect(await screen.findByText('(11) 98765-4321')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Editar meus dados' }));
    const form = screen.getByRole('form', { name: 'Editar meus dados' });
    const phone = within(form).getByLabelText('Telefone (opcional)');
    await user.clear(phone);
    await user.type(phone, '(11) 90000-1111');
    await user.click(within(form).getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Dados salvos.')).toBeTruthy();
    expect(fake.writes('profiles', 'update')).toEqual([
      { full_name: 'Isa Integrante', display_name: 'Isa', phone: '(11) 90000-1111' },
    ]);
  });
});
