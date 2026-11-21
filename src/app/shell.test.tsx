// @vitest-environment happy-dom
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fake } from '@/test/fake-supabase';
import { SONG_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));

const bottomNav = () => screen.getAllByRole('navigation', { name: 'Navegação principal' })[1]!;

describe('estrutura do app (AppShell)', () => {
  it('barra de baixo com Início, Escalas, Repertório, Agenda e Mais; item ativo marcado', async () => {
    const { user, router } = renderApp(`/repertorio/${SONG_ID}`, { as: 'member' });
    await findHeading('Grande é o Senhor');
    const nav = bottomNav();
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'Início',
      'Escalas',
      'Repertório',
      'Agenda',
      'Mais',
    ]);
    expect(within(nav).getByRole('link', { name: 'Repertório' }).getAttribute('aria-current')).toBe(
      'page',
    );
    await user.click(within(nav).getByRole('link', { name: 'Agenda' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/agenda'));
    expect(
      within(bottomNav()).getByRole('link', { name: 'Agenda' }).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('lateral do computador tem os mesmos itens + Integrantes, Comunicados e Configurações', async () => {
    renderApp('/', { as: 'member' });
    await findHeading(/Isa/);
    const side = screen.getAllByRole('navigation', { name: 'Navegação principal' })[0]!;
    expect(
      within(side)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual([
      'Início',
      'Escalas',
      'Repertório',
      'Agenda',
      'Mais',
      'Integrantes',
      'Comunicados',
      'Configurações',
    ]);
  });

  it('notificações só pelo sino (com o número de não lidas); nada de Notificações na navegação', async () => {
    const { user, router } = renderApp('/', { as: 'member' });
    await findHeading(/Isa/);
    const bell = await screen.findByRole('link', { name: /^Notificações: 1 notificação não lida/ });
    for (const nav of screen.getAllByRole('navigation', { name: 'Navegação principal' })) {
      expect(within(nav).queryByRole('link', { name: /Notificações/ })).toBeNull();
    }
    await user.click(bell);
    await waitFor(() => expect(router.state.location.pathname).toBe('/notificacoes'));
  });

  it('telas principais têm a chama e o sino; Sair não fica no topo', async () => {
    renderApp('/repertorio', { as: 'member' });
    await findHeading('Repertório');
    expect(screen.getAllByText('Louvor ADVOP').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull();
  });

  it('tela interna: voltar + título, sem o sino; aberta direto, voltar leva para Mais', async () => {
    const { user, router } = renderApp('/configuracoes', { as: 'member' });
    await findHeading('Configurações');
    expect(screen.queryByRole('link', { name: /^Notificações/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/mais'));
  });

  it('voltar usa o histórico quando a pessoa veio de dentro do app', async () => {
    const { user, router } = renderApp('/mais', { as: 'member' });
    await findHeading('Mais');
    await user.click(
      await within(screen.getByRole('main')).findByRole('link', { name: /Comunicados/ }),
    );
    await findHeading('Comunicados');
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/mais'));
  });
});

describe('tela Mais', () => {
  it('mostra quem está logado e o perfil (Cantor(a)/Instrumentista)', async () => {
    renderApp('/mais', { as: 'member' });
    await findHeading('Mais');
    expect(await screen.findByText('Isa')).toBeTruthy();
    expect(await screen.findByText('Cantor(a)')).toBeTruthy();
    const main = within(screen.getByRole('main'));
    expect(main.getByRole('link', { name: /Integrantes/ })).toBeTruthy();
    expect(main.getByRole('link', { name: /Aparência/ }).getAttribute('href')).toBe(
      '/configuracoes#aparencia',
    );
    // Integrante não vê administração.
    expect(screen.queryByRole('navigation', { name: 'Administração' })).toBeNull();
  });

  it('admin vê os itens de administração', async () => {
    renderApp('/mais', { as: 'admin' });
    const admin = await screen.findByRole('navigation', { name: 'Administração' });
    expect(
      within(admin)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual([
      'Montar escala',
      'Cadastrar integrante',
      'Funções do ministério',
      'Atividade recente',
    ]);
  });

  it('Sair fica no fim, com confirmação', async () => {
    const { user } = renderApp('/mais', { as: 'member' });
    await findHeading('Mais');
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sair do app?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(fake.state.session).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Sair do app?' })).getByRole('button', {
        name: 'Sair',
      }),
    );
    await waitFor(() => expect(fake.state.session).toBeNull());
  });

  it('Aparência abre Configurações já no trecho certo', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const { user } = renderApp('/mais', { as: 'member' });
    await user.click(await screen.findByRole('link', { name: /Aparência/ }));
    await findHeading('Configurações');
    await waitFor(() => expect(scroll).toHaveBeenCalled());
  });
});
