// @vitest-environment happy-dom
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { REHEARSAL_ID, SERVICE_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));

describe('escalas: visão do admin', () => {
  it('integrante: só "Minhas", com Próximas e Anteriores', async () => {
    const { user } = renderApp('/escalas', { as: 'member' });
    await findHeading('Escalas');
    expect(screen.queryByRole('group', { name: 'Escalas' })).toBeNull();
    expect(await screen.findByRole('list', { name: 'Minhas escalas' })).toBeTruthy();
    const period = screen.getByRole('group', { name: 'Período' });
    await user.click(within(period).getByRole('button', { name: 'Anteriores' }));
    expect(await screen.findByText(/Nenhuma escala nos últimos 60 dias/)).toBeTruthy();
  });

  it('admin: "Todas" com pendências escritas e o filtro "Só com pendência"', async () => {
    const { user, router } = renderApp('/escalas', {
      as: 'admin',
      setup: (s) => {
        // O ensaio fica sem equipe e o culto sem repertório.
        const rehearsal = s.tables!.events!.find((e) => e.id === REHEARSAL_ID)!;
        rehearsal.event_assignments = [];
        const service = s.tables!.events!.find((e) => e.id === SERVICE_ID)!;
        service.event_songs = [];
      },
    });
    await findHeading('Escalas');
    const tabs = await screen.findByRole('group', { name: 'Escalas' });
    await user.click(within(tabs).getByRole('button', { name: 'Todas' }));
    await waitFor(() => expect(router.state.location.search).toBe('?ver=todas'));
    const list = await screen.findByRole('list', { name: 'Todas as escalas' });
    const service = within(list).getByRole('link', { name: /Culto de domingo/ });
    expect(within(service).getByText('Sem repertório')).toBeTruthy();
    const rehearsal = within(list).getByRole('link', { name: /Ensaio/ });
    expect(within(rehearsal).getByText('Sem equipe')).toBeTruthy();
    expect(within(rehearsal).getByText(/0 pessoas/)).toBeTruthy();

    await user.click(screen.getByRole('checkbox', { name: 'Só com pendência' }));
    await waitFor(() => expect(router.state.location.search).toContain('pendencia=1'));
    expect(
      within(screen.getByRole('list', { name: 'Todas as escalas' })).getAllByRole('link'),
    ).toHaveLength(2);
  });

  it('admin: tudo resolvido no filtro de pendência', async () => {
    renderApp('/escalas?ver=todas&pendencia=1', {
      as: 'admin',
      setup: (s) => {
        const service = s.tables!.events!.find((e) => e.id === SERVICE_ID)!;
        for (const e of s.tables!.events!) e.event_assignments = service.event_assignments;
      },
    });
    expect(await screen.findByText('Nenhum evento com pendência. Tudo certo!')).toBeTruthy();
  });

  it('Início do admin: "Precisa de atenção" com até 3 itens e "Ver todas"', async () => {
    renderApp('/', {
      as: 'admin',
      setup: (s) => {
        const d = s.rpc!.get_dashboard as Record<string, unknown>;
        d.attention = [
          {
            id: SERVICE_ID,
            title: 'Culto sem equipe',
            type: 'culto',
            starts_at: new Date(Date.now() + 86_400_000).toISOString(),
            no_team: true,
            no_songs: true,
          },
        ];
        d.attention_total = 4;
      },
    });
    const region = await screen.findByRole('region', { name: 'Precisa de atenção' });
    expect(within(region).getByText('Sem equipe')).toBeTruthy();
    expect(within(region).getByText('Sem repertório')).toBeTruthy();
    expect(within(region).getByRole('link', { name: 'Ver todas (4)' }).getAttribute('href')).toBe(
      '/escalas?ver=todas&pendencia=1',
    );
  });

  it('Início sem pendências não mostra o card', async () => {
    renderApp('/', { as: 'admin' });
    await screen.findByText(/Sua próxima escala|nenhuma escala/i);
    expect(screen.queryByRole('region', { name: 'Precisa de atenção' })).toBeNull();
  });
});
