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

  it('integrante: só Compartilhar e Adicionar à agenda no ⋯; "Como chegar" abre o mapa', async () => {
    const { user } = renderApp(`/escalas/${SERVICE_ID}`, { as: 'member' });
    await findHeading('Culto de domingo');
    const maps = screen.getByRole('link', { name: /Como chegar/ });
    expect(maps.getAttribute('href')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Templo',
    );
    expect(maps.getAttribute('rel')).toBe('noopener noreferrer');
    await user.click(await screen.findByRole('button', { name: 'Mais opções' }));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Compartilhar',
      'Adicionar à agenda',
    ]);
  });

  it('compartilhar sem Web Share copia o texto e abre o WhatsApp', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const { user } = renderApp(`/escalas/${SERVICE_ID}`, { as: 'member' });
    await findHeading('Culto de domingo');
    await user.click(await screen.findByRole('button', { name: 'Mais opções' }));
    await user.click(screen.getByRole('menuitem', { name: 'Compartilhar' }));
    expect(await screen.findByText(/Texto copiado/)).toBeTruthy();
    const text = writeText.mock.calls[0]![0] as string;
    expect(text).toContain('*Culto de domingo*');
    expect(text).toContain('*Repertório*');
    expect(text).toContain(`/escalas/${SERVICE_ID}`);
    expect(open.mock.calls[0]![0]).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });

  it('adicionar à agenda baixa o .ics do evento', async () => {
    const created: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      created.push(b as Blob);
      return 'blob:ics';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    const { user } = renderApp(`/escalas/${SERVICE_ID}`, { as: 'member' });
    await findHeading('Culto de domingo');
    await user.click(await screen.findByRole('button', { name: 'Mais opções' }));
    await user.click(screen.getByRole('menuitem', { name: 'Adicionar à agenda' }));
    expect(names[0]).toMatch(/^culto-de-domingo-\d{4}-\d{2}-\d{2}\.ics$/);
    expect(await created[0]!.text()).toContain('SUMMARY:Culto de domingo');
    expect(screen.getByText(/Arquivo da agenda baixado/)).toBeTruthy();
    vi.restoreAllMocks();
  });

  it('admin: duplicar evento numa nova data e abrir a cópia', async () => {
    const { user, router } = renderApp(`/escalas/${SERVICE_ID}`, { as: 'admin' });
    await findHeading('Culto de domingo');
    await user.click(await screen.findByRole('button', { name: 'Mais opções' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicar evento' }));
    const dialog = await screen.findByRole('dialog', { name: 'Duplicar evento' });
    const input = within(dialog).getByLabelText('Nova data e hora (horário de Brasília)');
    expect((input as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    await user.click(within(dialog).getByRole('button', { name: 'Duplicar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/escalas/ev-dup'));
    const call = fake.calls.find((c) => c.name === 'duplicate_event')!;
    expect(call.ops[0]!.args[0]).toMatchObject({ p_event_id: SERVICE_ID });
  });

  it('admin: editar escala e cancelar/reativar evento pelo ⋯', async () => {
    const { user, router } = renderApp(`/escalas/${SERVICE_ID}`, { as: 'admin' });
    await findHeading('Culto de domingo');
    await user.click(await screen.findByRole('button', { name: 'Mais opções' }));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Compartilhar',
      'Adicionar à agenda',
      'Editar evento',
      'Duplicar evento',
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

  it('editar evento: carrega os dados, valida e salva', async () => {
    const { user, router } = renderApp(`/escalas/${SERVICE_ID}/editar`, { as: 'admin' });
    await findHeading('Editar evento');
    const title = await screen.findByLabelText('Título');
    expect((title as HTMLInputElement).value).toBe('Culto de domingo');
    await user.clear(title);
    await user.click(screen.getByRole('button', { name: 'Salvar evento' }));
    expect(await screen.findByText('Informe o título.')).toBeTruthy();
    await user.type(title, 'Culto especial');
    await user.clear(screen.getByLabelText('Local (opcional)'));
    await user.type(screen.getByLabelText('Local (opcional)'), 'Praça');
    await user.click(screen.getByRole('button', { name: 'Salvar evento' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/escalas/${SERVICE_ID}`));
    expect(fake.writes('events', 'update')[0]).toMatchObject({
      title: 'Culto especial',
      location: 'Praça',
      type: 'culto',
    });
  });

  it('editar evento sem permissão', async () => {
    renderApp(`/escalas/${SERVICE_ID}/editar`, { as: 'member' });
    expect(await screen.findByText('Você não tem permissão para editar eventos.')).toBeTruthy();
  });
});
