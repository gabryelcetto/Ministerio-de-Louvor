// @vitest-environment happy-dom
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fake } from '@/test/fake-supabase';
import { MEMBER_ID, SERVICE_ID, SONG2_ID, SONG_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));

const titles = () =>
  within(screen.getByRole('list', { name: 'Músicas' }))
    .getAllByRole('link')
    .map((a) => a.textContent ?? '');

describe('repertório: ordenar, filtrar, favoritas e arquivadas', () => {
  it('ordena (URL guarda) e mostra "tocada há…"; filtros Com áudio e Favoritas', async () => {
    const { user, router } = renderApp('/repertorio', {
      as: 'member',
      setup: (s) => {
        s.rpc!.get_song_stats = [
          {
            song_id: SONG2_ID,
            play_count: 5,
            last_played_at: new Date(Date.now() - 21 * 86_400_000).toISOString(),
          },
          {
            song_id: SONG_ID,
            play_count: 1,
            last_played_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
          },
        ];
        s.tables!.song_favorites = [{ user_id: MEMBER_ID, song_id: SONG2_ID }];
      },
    });
    await findHeading('Repertório');
    await waitFor(() => expect(titles()[0]).toContain('Grande é o Senhor'));
    expect(await screen.findByText(/tocada há 3 semanas/)).toBeTruthy();

    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'mais-tocadas');
    await waitFor(() => expect(router.state.location.search).toContain('ordem=mais-tocadas'));
    expect(titles()[0]).toContain('Música sem cifra');
    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'recentes');
    expect(titles()[0]).toContain('Música sem cifra');

    const only = screen.getByRole('group', { name: 'Mostrar só' });
    await user.click(within(only).getByRole('button', { name: 'Favoritas' }));
    await waitFor(() => expect(router.state.location.search).toContain('filtro=favoritas'));
    await waitFor(() => expect(titles()).toHaveLength(1));
    expect(titles()[0]).toContain('Música sem cifra');

    await user.click(within(only).getByRole('button', { name: 'Com áudio' }));
    await waitFor(() => expect(router.state.location.search).toContain('filtro=audio'));
    // O fixture tem áudio de referência só na primeira música.
    await waitFor(() => expect(titles()).toEqual([expect.stringContaining('Grande é o Senhor')]));
    // Sem a permissão de arquivar, não há o chip "Arquivadas".
    expect(within(only).queryByRole('button', { name: 'Arquivadas' })).toBeNull();
  });

  it('estrela marca e desmarca a favorita (só a própria pessoa)', async () => {
    const { user } = renderApp('/repertorio', { as: 'member' });
    const star = await screen.findByRole('button', { name: 'Favorita: Grande é o Senhor' });
    expect(star.getAttribute('aria-pressed')).toBe('false');
    await user.click(star);
    await waitFor(() => expect(star.getAttribute('aria-pressed')).toBe('true'));
    expect(fake.writes('song_favorites', 'upsert')).toEqual([
      { song_id: SONG_ID, user_id: MEMBER_ID },
    ]);
    await user.click(star);
    await waitFor(() => expect(fake.writes('song_favorites', 'delete')).toHaveLength(1));
  });

  it('admin: chip "Arquivadas" com "Desarquivar"', async () => {
    const { user } = renderApp('/repertorio?filtro=arquivadas', {
      as: 'admin',
      setup: (s) => {
        s.tables!.songs![1]!.archived_at = '2026-05-01T00:00:00Z';
      },
    });
    const restore = await screen.findByRole('button', { name: /Desarquivar.*Música sem cifra/ });
    expect(screen.getByText('1 música arquivada')).toBeTruthy();
    await user.click(restore);
    await waitFor(() => expect(fake.writes('songs', 'update')).toEqual([{ archived_at: null }]));
  });

  it('música: estrela no cabeçalho e "Tocada em" com o total e as últimas vezes', async () => {
    renderApp(`/repertorio/${SONG_ID}`, {
      as: 'member',
      setup: (s) => {
        s.rpc!.get_song_plays = {
          total: 7,
          recent: [
            {
              id: SERVICE_ID,
              title: 'Culto de domingo',
              starts_at: '2026-11-15T22:00:00Z',
              key: 'B',
            },
          ],
        };
      },
    });
    await findHeading('Grande é o Senhor');
    expect(screen.getByRole('button', { name: 'Favorita: Grande é o Senhor' })).toBeTruthy();
    const played = await screen.findByRole('region', { name: 'Tocada em' });
    expect(within(played).getByText('Tocada 7 vezes.')).toBeTruthy();
    expect(
      within(played)
        .getByRole('link', { name: /Culto de domingo/ })
        .getAttribute('href'),
    ).toBe(`/escalas/${SERVICE_ID}`);
  });

  it('música nunca tocada', async () => {
    renderApp(`/repertorio/${SONG_ID}`, { as: 'member' });
    expect(
      await screen.findByText('Ainda não entrou no repertório de nenhum evento.'),
    ).toBeTruthy();
  });
});
