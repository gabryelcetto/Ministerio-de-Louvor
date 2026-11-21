// @vitest-environment happy-dom
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SONG2_ID, SONG_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));

/** Lista de músicas já assentada (sem a lista anterior esmaecida durante a nova busca). */
async function songList() {
  const list = await screen.findByRole('list', { name: 'Músicas' });
  await waitFor(() => expect(list.className).not.toContain('opacity-60'));
  return list;
}

describe('Repertório', () => {
  it('linhas com título, artista, fone (se tem áudio) e chip do tom', async () => {
    renderApp('/repertorio', { as: 'member' });
    await findHeading('Repertório');
    const list = await songList();
    const [first, second] = within(list).getAllByRole('link');
    expect(first!.getAttribute('href')).toBe(`/repertorio/${SONG_ID}`);
    expect(within(first!).getByText('Hinário')).toBeTruthy();
    expect(
      await within(first!).findByRole('img', { name: 'Tem áudio de referência' }),
    ).toBeTruthy();
    expect(first!.textContent).toContain('Tom oficial: A');
    expect(second!.getAttribute('href')).toBe(`/repertorio/${SONG2_ID}`);
    expect(within(second!).queryByRole('img')).toBeNull();
    expect(screen.getByText('2 músicas')).toBeTruthy();
  });

  it('busca e categorias ("Todas" primeiro) ficam no endereço; abre a música', async () => {
    const { user, router } = renderApp('/repertorio', { as: 'member' });
    await songList();
    await user.type(screen.getByLabelText('Buscar música'), 'grande');
    await waitFor(() => expect(router.state.location.search).toContain('busca=grande'));
    const chips = await screen.findByRole('group', { name: 'Filtrar por categoria' });
    const buttons = within(chips).getAllByRole('button');
    expect(buttons[0]!.textContent).toBe('Todas');
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('true');
    await user.click(within(chips).getByRole('button', { name: 'Adoração' }));
    await waitFor(() => expect(router.state.location.search).toContain('categoria=Ado'));
    expect(
      within(chips).getByRole('button', { name: 'Adoração' }).getAttribute('aria-pressed'),
    ).toBe('true');
    await user.click(within(chips).getByRole('button', { name: 'Todas' }));
    await waitFor(() => expect(router.state.location.search).not.toContain('categoria'));
    const list = await songList();
    await user.click(within(list).getAllByRole('link')[0]!);
    await waitFor(() => expect(router.state.location.pathname).toBe(`/repertorio/${SONG_ID}`));
  });

  it('botão flutuante "Nova música" só para quem cadastra músicas', async () => {
    renderApp('/repertorio', {
      as: 'member',
      setup: (s) => {
        s.rpc!.my_permissions = [];
      },
    });
    await songList();
    expect(screen.queryByRole('link', { name: 'Nova música' })).toBeNull();
  });

  it('nenhuma música com os filtros', async () => {
    const { user } = renderApp('/repertorio', {
      as: 'member',
      setup: (s) => {
        s.rpc!.search_songs = () => ({ data: [], error: null });
      },
    });
    expect(await screen.findByText('Nenhuma música cadastrada ainda.')).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'Nova música' })).toBeTruthy();
    await user.type(screen.getByLabelText('Buscar música'), 'zzz');
    expect(await screen.findByText('Nenhuma música encontrada com esses filtros.')).toBeTruthy();
  });
});
