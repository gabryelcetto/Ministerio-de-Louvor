// @vitest-environment happy-dom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fake } from '@/test/fake-supabase';
import { MEMBER_ID, OTHER_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));

const rpcArgs = (name: string) =>
  fake.calls
    .filter((c) => c.name === name)
    .map((c) => c.ops[0]!.args[0] as Record<string, unknown>);

describe('Comunicados', () => {
  it('lista: "Novo" no não lido, fixado primeiro, texto cortado e botão flutuante para quem publica', async () => {
    renderApp('/comunicados', {
      as: 'admin',
      setup: (s) => {
        s.tables!.announcements!.push({
          id: 'an2',
          title: 'Fixado',
          body: 'Leia primeiro',
          published_at: '2020-01-01T00:00:00Z',
          pinned_until: '2999-01-01T00:00:00Z',
          audience_filter: { type: 'all' },
          author: null,
        });
        s.tables!.announcement_reads = [{ announcement_id: 'an2', user_id: MEMBER_ID }];
      },
    });
    await findHeading('Comunicados');
    const list = await screen.findByRole('list', { name: 'Comunicados' });
    const links = within(list).getAllByRole('link');
    expect(links[0]!.textContent).toContain('Fixado');
    expect(links[0]!.getAttribute('href')).toBe('/comunicados/an2');
    expect(links[1]!.textContent).toContain('Bem-vindos ao app');
    // Leituras do admin (nenhuma): os dois aparecem como "Novo".
    await waitFor(() => expect(within(list).getAllByText('Novo')).toHaveLength(2));
    expect(screen.getByRole('link', { name: 'Novo comunicado' }).getAttribute('href')).toBe(
      '/comunicados/novo',
    );
  });

  it('integrante: sem botão de publicar; o que já leu não tem "Novo"', async () => {
    renderApp('/comunicados', {
      as: 'member',
      setup: (s) => {
        s.tables!.announcement_reads = [{ announcement_id: 'an1', user_id: MEMBER_ID }];
      },
    });
    const list = await screen.findByRole('list', { name: 'Comunicados' });
    await waitFor(() => expect(fake.calls.some((c) => c.name === 'announcement_reads')).toBe(true));
    expect(within(list).queryByText('Novo')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Novo comunicado' })).toBeNull();
  });

  it('detalhe: texto completo com link seguro e leitura registrada ao abrir', async () => {
    renderApp('/comunicados/an1', {
      as: 'member',
      setup: (s) => {
        s.tables!.announcements![0]!.body = 'Linha 1\nVeja https://exemplo.org.';
      },
    });
    await findHeading('Comunicado');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Bem-vindos ao app' }),
    ).toBeTruthy();
    const link = screen.getByRole('link', { name: /exemplo\.org/ });
    expect(link.getAttribute('href')).toBe('https://exemplo.org');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    await waitFor(() => expect(rpcArgs('mark_announcement_read')).toEqual([{ p_id: 'an1' }]));
    // Integrante: sem menu de editar e sem "Visto por".
    expect(screen.queryByRole('button', { name: 'Mais opções' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Visto por/ })).toBeNull();
  });

  it('detalhe do admin: "Visto por 1 de 2", listas e "Lembrar quem não viu"', async () => {
    const { user } = renderApp('/comunicados/an1', { as: 'admin' });
    const seen = await screen.findByRole('button', { name: 'Visto por 1 de 2' });
    await user.click(seen);
    expect(screen.getByRole('tab', { name: 'Viram (1)' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(within(screen.getByRole('tabpanel')).getByText('Isa')).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Ainda não viram (1)' }));
    expect(within(screen.getByRole('tabpanel')).getByText('Lucas Teclado')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Lembrar quem não viu' }));
    expect(await screen.findByText('Lembrete enviado para 1 pessoa.')).toBeTruthy();
    expect(rpcArgs('remind_announcement')).toEqual([{ p_id: 'an1' }]);
  });

  it('detalhe do admin: excluir pelo menu ⋯ com confirmação', async () => {
    const { user, router } = renderApp('/comunicados/an1', { as: 'admin' });
    await screen.findByRole('heading', { level: 2, name: 'Bem-vindos ao app' });
    await user.click(await screen.findByRole('button', { name: 'Mais opções' }));
    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    const dialog = screen.getByRole('dialog', { name: 'Excluir este comunicado?' });
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/comunicados'));
    expect(rpcArgs('delete_announcement')).toEqual([{ p_id: 'an1' }]);
  });

  it('comunicado inexistente', async () => {
    renderApp('/comunicados/nao-existe', { as: 'member' });
    expect(await screen.findByText(/Comunicado não encontrado/)).toBeTruthy();
  });

  it('novo: título obrigatório, pessoas escolhidas com busca, chips e "Vai para N pessoas"', async () => {
    const { user, router } = renderApp('/comunicados/novo', { as: 'admin' });
    await findHeading('Novo comunicado');
    await screen.findByLabelText('Título');
    await user.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(await screen.findByText('Informe o título.')).toBeTruthy();
    expect(rpcArgs('save_announcement')).toEqual([]);

    await user.type(screen.getByLabelText('Título'), 'Ensaio extra');
    await user.type(screen.getByLabelText('Texto'), 'Sábado às 15h.');
    await user.click(screen.getByRole('radio', { name: 'Pessoas escolhidas' }));
    expect(await screen.findByText('Escolha para quem vai')).toBeTruthy();
    const people = await screen.findByRole('list', { name: 'Integrantes' });
    await user.type(screen.getByLabelText('Buscar pessoa'), 'luc');
    expect(within(people).getAllByRole('checkbox')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Selecionar todos do resultado (1)' }));
    const chips = screen.getByRole('list', { name: 'Pessoas escolhidas' });
    expect(within(chips).getByText('Lucas Teclado')).toBeTruthy();
    expect(await screen.findByText('Vai para 3 pessoas')).toBeTruthy();

    // Remover o chip e escolher de novo pelo checkbox.
    await user.click(within(chips).getByRole('button', { name: 'Remover Lucas Teclado' }));
    expect(screen.queryByRole('list', { name: 'Pessoas escolhidas' })).toBeNull();
    await user.click(within(people).getByRole('checkbox'));
    await user.selectOptions(screen.getByLabelText('Fixar no topo'), '7');
    await user.dblClick(screen.getByRole('button', { name: 'Publicar' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/comunicados/an-novo'));
    const saves = rpcArgs('save_announcement');
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({
      p_id: null,
      p_title: 'Ensaio extra',
      p_body: 'Sábado às 15h.',
      p_filter: { type: 'users', user_ids: [OTHER_ID] },
    });
    expect(typeof saves[0]!.p_pinned_until).toBe('string');
  });

  it('novo: grupos e funções, e evento', async () => {
    const { user } = renderApp('/comunicados/novo', { as: 'admin' });
    await findHeading('Novo comunicado');
    await screen.findByLabelText('Título');
    await user.click(screen.getByRole('radio', { name: 'Grupos e funções' }));
    expect(screen.getByText('Escolha para quem vai')).toBeTruthy();
    await user.click(screen.getByRole('checkbox', { name: 'Cantores' }));
    expect(await screen.findByText('Vai para 3 pessoas')).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Escalados de um evento' }));
    const select = await screen.findByLabelText('Evento');
    await waitFor(() => expect(select.querySelectorAll('option').length).toBeGreaterThan(1));
    await user.selectOptions(select, select.querySelectorAll('option')[1]!.getAttribute('value')!);
    await user.type(screen.getByLabelText('Título'), 'Aviso do culto');
    fireEvent.submit(screen.getByRole('form', { name: 'Novo comunicado' }));
    await waitFor(() => expect(rpcArgs('save_announcement')).toHaveLength(1));
    expect(rpcArgs('save_announcement')[0]!.p_filter).toMatchObject({ type: 'event' });
  });

  it('editar: reabre o público escolhido e salva', async () => {
    const { user } = renderApp('/comunicados/an1/editar', {
      as: 'admin',
      setup: (s) => {
        s.tables!.announcements![0]!.audience_filter = {
          type: 'groups',
          sections: ['vocal'],
          function_ids: [],
        };
      },
    });
    await findHeading('Editar comunicado');
    await screen.findByLabelText('Título');
    expect(
      (screen.getByRole('radio', { name: 'Grupos e funções' }) as HTMLInputElement).checked,
    ).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Cantores' }) as HTMLInputElement).checked).toBe(
      true,
    );
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(rpcArgs('save_announcement')).toHaveLength(1));
    expect(rpcArgs('save_announcement')[0]).toMatchObject({ p_id: 'an1', p_pinned_until: null });
  });

  it('sem permissão, a tela de novo comunicado explica', async () => {
    renderApp('/comunicados/novo', { as: 'member' });
    expect(
      await screen.findByText('Você não tem permissão para publicar comunicados.'),
    ).toBeTruthy();
  });
});
