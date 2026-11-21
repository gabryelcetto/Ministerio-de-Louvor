// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SERVICE_ID, SONG_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));

describe('Início', () => {
  it('saúda pelo nome e destaca a próxima escala com a função e o repertório no tom do dia', async () => {
    renderApp('/', { as: 'member' });
    await findHeading(/^(Bom dia|Boa tarde|Boa noite), Isa$/);
    const card = await screen.findByRole('article', { name: 'Culto de domingo' });
    expect(within(card).getByText('Sua próxima escala')).toBeTruthy();
    expect(within(card).getByText('Templo')).toBeTruthy();
    expect(await within(card).findByText('Você canta (vocal)')).toBeTruthy();
    expect(within(card).getByRole('link', { name: 'Ver repertório' }).getAttribute('href')).toBe(
      `/escalas/${SERVICE_ID}#repertorio`,
    );
    const list = await screen.findByRole('region', { name: 'Repertório de Culto de domingo' });
    const first = within(list).getAllByRole('link')[0]!;
    expect(first.textContent).toContain('Grande é o Senhor');
    expect(first.textContent).toContain('B');
    expect(first.getAttribute('href')).toBe(`/repertorio/${SONG_ID}?tom=B&evento=${SERVICE_ID}`);
  });

  it('próximo ensaio, até 2 comunicados com "Ver todos" e nenhum card de notificações', async () => {
    renderApp('/', {
      as: 'member',
      setup: (s) => {
        const d = s.rpc!.get_dashboard as { recent_announcements: unknown[] };
        d.recent_announcements = [1, 2, 3].map((n) => ({
          id: `a${n}`,
          title: `Aviso ${n}`,
          body: 'Texto',
          published_at: '2026-01-01T00:00:00Z',
        }));
      },
    });
    expect(await screen.findByText('Ensaio geral')).toBeTruthy();
    expect(screen.getByText('Próximo ensaio')).toBeTruthy();
    const avisos = screen.getByRole('region', { name: 'Comunicados' });
    expect(within(avisos).getAllByRole('listitem')).toHaveLength(2);
    expect(within(avisos).getByRole('link', { name: 'Ver todos' })).toBeTruthy();
    expect(screen.queryByText(/notificação não lida/)).toBeNull();
  });

  it('sem escala: mensagem amigável e atalho para a agenda', async () => {
    renderApp('/', {
      as: 'member',
      setup: (s) => {
        const d = s.rpc!.get_dashboard as { my_assignments: unknown[]; next_rehearsal: unknown };
        d.my_assignments = [];
        d.next_rehearsal = null;
      },
    });
    expect(await screen.findByText('Você não está em nenhuma escala por enquanto.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver a agenda' })).toBeTruthy();
  });

  it('erro ao carregar: tentar de novo', async () => {
    renderApp('/', {
      as: 'member',
      setup: (s) => {
        s.rpc!.get_dashboard = () => ({ data: null, error: { code: 'XX000', message: 'boom' } });
      },
    });
    expect(await screen.findByRole('button', { name: /Tentar de novo/ })).toBeTruthy();
  });
});
