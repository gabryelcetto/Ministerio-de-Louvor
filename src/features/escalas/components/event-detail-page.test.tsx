// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installBrowserFakes } from '@/test/browser-fakes';
import { fake } from '@/test/fake-supabase';
import { REHEARSAL_ID, SERVICE_ID, SONG_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));
vi.mock('@/lib/audio/soundtouch', () => ({
  isSoundTouchSupported: () => false,
  attachSoundTouch: vi.fn(),
}));
afterEach(() => vi.unstubAllGlobals());

describe('escala / detalhe do evento', () => {
  it('bloco de data, equipe em Cantores e Instrumentistas, "(você)" destacado', async () => {
    renderApp(`/escalas/${SERVICE_ID}`, { as: 'member' });
    await findHeading('Culto de domingo');
    expect(screen.getByText('Culto')).toBeTruthy(); // subtítulo
    const cantores = screen.getByRole('list', { name: 'Cantores' });
    const me = within(cantores).getByRole('listitem');
    expect(me.textContent).toContain('Isa (você)');
    expect(me.textContent).toContain('Vocal');
    expect(me.textContent).toContain('Abre o culto');
    expect(me.className).toContain('border-brand');
    const instrumentistas = screen.getByRole('list', { name: 'Instrumentistas' });
    expect(within(instrumentistas).getByRole('listitem').textContent).toContain('Lucas Teclado');
    expect(within(instrumentistas).getByText('LT')).toBeTruthy();
  });

  it('repertório numerado com o tom do dia; cada música abre no tom do evento', async () => {
    renderApp(`/escalas/${SERVICE_ID}`, { as: 'member' });
    await findHeading('Culto de domingo');
    const region = screen.getByRole('region', { name: 'Repertório' });
    const links = within(region).getAllByRole('link');
    expect(links[0]!.textContent).toContain('1');
    expect(links[0]!.textContent).toContain('Grande é o Senhor');
    expect(links[0]!.getAttribute('href')).toBe(
      `/repertorio/${SONG_ID}?tom=B&evento=${SERVICE_ID}`,
    );
  });

  it('integrante não vê o menu de administração', async () => {
    renderApp(`/escalas/${SERVICE_ID}`, { as: 'member' });
    await findHeading('Culto de domingo');
    expect(screen.queryByRole('button', { name: 'Mais opções' })).toBeNull();
  });

  it('admin: editar escala e cancelar/reativar evento pelo ⋯', async () => {
    const { user, router } = renderApp(`/escalas/${SERVICE_ID}`, { as: 'admin' });
    await findHeading('Culto de domingo');
    await user.click(await screen.findByRole('button', { name: 'Mais opções' }));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Editar escala',
      'Cancelar evento',
    ]);
    await user.click(screen.getByRole('menuitem', { name: 'Cancelar evento' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancelar este evento?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar evento' }));
    await waitFor(() => expect(fake.writes('events', 'update')).toEqual([{ status: 'cancelled' }]));
    expect(await screen.findByText('Evento cancelado')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Mais opções' }));
    await user.click(screen.getByRole('menuitem', { name: 'Reativar evento' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Reativar este evento?' })).getByRole(
        'button',
        {
          name: 'Reativar',
        },
      ),
    );
    await waitFor(() =>
      expect(fake.writes('events', 'update')).toContainEqual({ status: 'scheduled' }),
    );
    await user.click(screen.getByRole('button', { name: 'Mais opções' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar escala' }));
    await waitFor(() => expect(router.state.location.search).toBe(`?evento=${SERVICE_ID}`));
  });

  it('erro ao cancelar aparece na tela', async () => {
    const { user } = renderApp(`/escalas/${SERVICE_ID}`, { as: 'admin' });
    await findHeading('Culto de domingo');
    fake.fail('from', 'events', { code: '42501', message: 'permission denied' }, 'update');
    await user.click(await screen.findByRole('button', { name: 'Mais opções' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cancelar evento' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Cancelar este evento?' })).getByRole(
        'button',
        {
          name: 'Cancelar evento',
        },
      ),
    );
    expect(await screen.findByText(/não tem permissão/)).toBeTruthy();
  });

  it('ensaio: gravações deste ensaio e o dock de gravar com a dica', async () => {
    installBrowserFakes();
    const { user } = renderApp(`/escalas/${REHEARSAL_ID}`, { as: 'member' });
    await findHeading('Ensaio geral');
    expect(screen.getByText('Gravações deste ensaio')).toBeTruthy();
    expect(await screen.findByText('Nenhuma gravação deste ensaio ainda.')).toBeTruthy();
    const dock = screen.getByRole('region', { name: 'Gravação' });
    const record = within(dock).getByRole('button', { name: 'Gravar ensaio' });
    expect(record.getAttribute('aria-describedby')).toBeTruthy();
    expect(
      within(dock).getByText('Deixe a tela ligada enquanto grava. Fica salvo por 90 dias.'),
    ).toBeTruthy();
    expect(within(dock).queryByText(/No iPhone/)).toBeNull();
    await user.click(record);
    await within(dock).findByTestId('cronometro');
    await user.click(within(dock).getByRole('button', { name: 'Pausar' }));
    await user.click(within(dock).getByRole('button', { name: 'Retomar' }));
    await user.click(within(dock).getByRole('button', { name: 'Parar' }));
    expect(await screen.findByRole('list', { name: 'Gravações não enviadas' })).toBeTruthy();
  });

  it('no iPhone, avisa que bloquear a tela interrompe a gravação', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    });
    renderApp(`/escalas/${REHEARSAL_ID}`, { as: 'member' });
    await findHeading('Ensaio geral');
    expect(await screen.findByText(/No iPhone, bloquear a tela/)).toBeTruthy();
  });

  it('evento inexistente', async () => {
    renderApp('/escalas/99999999-0000-4000-8000-000000000000', { as: 'member' });
    expect(await findHeading('Evento não encontrado')).toBeTruthy();
  });
});
