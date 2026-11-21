// @vitest-environment happy-dom
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fake } from '@/test/fake-supabase';
import { SERVICE_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';
import { addMonths, formatMonthLabel, monthKey } from '@/lib/dates';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));

const filters = () =>
  fake.calls
    .filter((c) => c.kind === 'from' && c.name === 'events')
    .map((c) => c.ops.filter((o) => o.method === 'gte' || o.method === 'lt').map((o) => o.args));

describe('agenda por mês', () => {
  it('mostra o mês, navega para trás e para frente e volta a "Hoje"', async () => {
    const { user, router } = renderApp('/agenda', { as: 'member' });
    await findHeading('Agenda');
    const nav = screen.getByRole('navigation', { name: 'Mês' });
    const today = monthKey();
    expect(within(nav).getByText(formatMonthLabel(today))).toBeTruthy();
    expect((within(nav).getByRole('button', { name: 'Hoje' }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    await user.click(within(nav).getByRole('button', { name: 'Mês anterior' }));
    const previous = addMonths(today, -1);
    await waitFor(() => expect(router.state.location.search).toBe(`?mes=${previous}`));
    expect(within(nav).getByText(formatMonthLabel(previous))).toBeTruthy();
    // A consulta pede o intervalo do mês anterior.
    await waitFor(() => expect(filters().length).toBeGreaterThan(1));

    await user.click(within(nav).getByRole('button', { name: 'Hoje' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    await user.click(within(nav).getByRole('button', { name: 'Próximo mês' }));
    await waitFor(() => expect(router.state.location.search).toBe(`?mes=${addMonths(today, 1)}`));
  });

  it('evento que já passou aparece apagado, com "Já aconteceu", e continua abrindo', async () => {
    renderApp(`/agenda?mes=${monthKey(new Date(Date.now() - 3 * 86_400_000))}`, {
      as: 'member',
      setup: (s) => {
        const first = s.tables!.events![0]!;
        first.starts_at = new Date(Date.now() - 3 * 86_400_000).toISOString();
        first.ends_at = null;
      },
    });
    await findHeading('Agenda');
    const link = await screen.findByRole('link', { name: /Culto de domingo/ });
    expect(link.getAttribute('href')).toBe(`/escalas/${SERVICE_ID}`);
    expect(within(link).getByText('Já aconteceu')).toBeTruthy();
    expect(link.className).toContain('bg-muted');
  });

  it('mês sem eventos e endereço inválido cai no mês atual', async () => {
    renderApp('/agenda?mes=2000-01', { as: 'member' });
    expect(await screen.findByText('Nenhum evento em janeiro de 2000.')).toBeTruthy();
  });

  it('"Novo evento" só para quem gerencia eventos, abrindo a criação', async () => {
    renderApp('/agenda?mes=abc', { as: 'admin' });
    await findHeading('Agenda');
    const fab = await screen.findByRole('link', { name: 'Novo evento' });
    expect(fab.getAttribute('href')).toBe('/escalas/montar?novo=1');
  });

  it('integrante não vê "Novo evento"', async () => {
    renderApp('/agenda', { as: 'member' });
    await findHeading('Agenda');
    await screen.findByRole('navigation', { name: 'Mês' });
    expect(screen.queryByRole('link', { name: 'Novo evento' })).toBeNull();
  });
});
