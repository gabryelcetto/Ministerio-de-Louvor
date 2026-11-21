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

  it('busca e categorias ("Todas" primeiro) ficam no endereço', async () => {
    const { user, router } = renderApp('/repertorio', { as: 'member' });
    await songList();
    await user.type(screen.getByLabelText('Buscar música'), 'grande');
    await waitFor(() => expect(router.state.location.search).toContain('busca=grande'));
    // O grupo de categorias pode ser refeito quando a lista recarrega: consulta de novo a cada passo.
    const chips = () => screen.findByRole('group', { name: 'Filtrar por categoria' });
    const chip = async (name: string) => within(await chips()).findByRole('button', { name });
    const buttons = within(await chips()).getAllByRole('button');
    expect(buttons[0]!.textContent).toBe('Todas');
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('true');
    await user.click(await chip('Adoração'));
    await waitFor(() => expect(router.state.location.search).toContain('categoria=Ado'));
    await waitFor(async () =>
      expect((await chip('Adoração')).getAttribute('aria-pressed')).toBe('true'),
    );
    await user.click(await chip('Todas'));
    await waitFor(() => expect(router.state.location.search).not.toContain('categoria'));
    // O link da linha leva à música (a lista se refaz a cada busca: confere o endereço).
    await waitFor(async () =>
      expect(
        within(await songList())
          .getAllByRole('link')[0]!
          .getAttribute('href'),
      ).toBe(`/repertorio/${SONG_ID}`),
    );
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
