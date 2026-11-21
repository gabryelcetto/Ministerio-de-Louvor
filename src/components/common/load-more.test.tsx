// @vitest-environment happy-dom
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MEMBER_ID, SONG_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));

const many = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `nx${i}`,
    user_id: MEMBER_ID,
    type: 'assignment_added',
    title: `Aviso ${String(i).padStart(2, '0')}`,
    body: null,
    link: null,
    read_at: '2026-01-01T00:00:00Z',
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, 100 - i)).toISOString(),
  }));

describe('"Carregar mais" nas listas longas', () => {
  it('notificações: 30 por vez; o botão some quando acabou', async () => {
    const { user } = renderApp('/notificacoes', {
      as: 'member',
      setup: (s) => {
        s.tables!.notifications = many(35);
      },
    });
    await findHeading('Notificações');
    const button = await screen.findByRole('button', { name: 'Carregar mais' });
    expect(screen.getAllByText(/^Aviso \d+$/)).toHaveLength(30);
    await user.click(button);
    await waitFor(() => expect(screen.getAllByText(/^Aviso \d+$/)).toHaveLength(35));
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  it('histórico da música: carrega mais alterações', async () => {
    const { user } = renderApp(`/repertorio/${SONG_ID}/historico`, {
      as: 'admin',
      setup: (s) => {
        const base = s.tables!.song_versions![0]!;
        s.tables!.song_versions = Array.from({ length: 31 }, (_, i) => ({
          ...base,
          id: `v${i}`,
          changed_at: new Date(Date.UTC(2026, 0, 1, 0, 0, 100 - i)).toISOString(),
        }));
      },
    });
    await findHeading('Histórico');
    const more = await screen.findByRole('button', { name: 'Carregar mais' });
    await user.click(more);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull());
    // Só a primeira (a mais recente) de cada campo é a "atual".
    expect(screen.getAllByText('atual')).toHaveLength(1);
  });

  it('comunicados: o fixado aparece uma vez só, no topo', async () => {
    renderApp('/comunicados', {
      as: 'member',
      setup: (s) => {
        s.tables!.announcements![0]!.pinned_until = '2999-01-01T00:00:00Z';
      },
    });
    const list = await screen.findByRole('list', { name: 'Comunicados' });
    expect(within(list).getAllByRole('link')).toHaveLength(1);
    expect(within(list).getByText('Fixado')).toBeTruthy();
  });
});
