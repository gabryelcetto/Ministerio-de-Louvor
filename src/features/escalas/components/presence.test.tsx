// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fake } from '@/test/fake-supabase';
import { ADMIN_ID, MEMBER_ID, SERVICE_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));
vi.mock('@/lib/audio/soundtouch', () => ({
  isSoundTouchSupported: () => false,
  attachSoundTouch: vi.fn(),
}));
afterEach(() => vi.unstubAllGlobals());

function rpcCalls(name: string) {
  return fake.calls.filter((c) => c.kind === 'rpc' && c.name === name);
}

type Row = Record<string, unknown>;
function setAssignment(state: { tables?: Record<string, Row[]> }, id: string, patch: Row) {
  const event = state.tables!.events!.find((e) => e.id === SERVICE_ID)!;
  const list = event.event_assignments as Row[];
  Object.assign(
    list.find((a) => a.id === id)!,
    patch,
  );
}

describe('presença na escala', () => {
  it('integrante confirma no detalhe do evento', async () => {
    const { user } = renderApp(`/escalas/${SERVICE_ID}`, { as: 'member' });
    await findHeading('Culto de domingo');
    const group = screen.getByRole('group', { name: 'Sua presença em Culto de domingo' });
    expect(within(group).getByText('Aguardando resposta')).toBeTruthy();
    await user.click(within(group).getByRole('button', { name: 'Confirmo' }));
    await waitFor(() => expect(rpcCalls('respond_assignment')).toHaveLength(1));
    expect(rpcCalls('respond_assignment')[0]!.ops[0]!.args[0]).toEqual({
      p_assignment_id: 'd1',
      p_response: 'confirmed',
    });
  });

  it('"Não posso" com motivo e substituto sugerido', async () => {
    const { user } = renderApp(`/escalas/${SERVICE_ID}`, { as: 'member' });
    await findHeading('Culto de domingo');
    await user.click(screen.getByRole('button', { name: 'Não posso' }));
    const dialog = await screen.findByRole('dialog', { name: 'Não vai poder?' });
    await user.type(within(dialog).getByLabelText('Motivo (opcional)'), 'Plantão');
    const select = within(dialog).getByLabelText('Sugerir substituto (opcional)');
    await within(dialog).findByRole('option', { name: 'Admin' });
    await user.selectOptions(select, ADMIN_ID);
    await user.click(within(dialog).getByRole('button', { name: 'Avisar que não posso' }));
    await waitFor(() => expect(rpcCalls('respond_assignment')).toHaveLength(1));
    expect(rpcCalls('respond_assignment')[0]!.ops[0]!.args[0]).toEqual({
      p_assignment_id: 'd1',
      p_response: 'declined',
      p_note: 'Plantão',
      p_suggested_user_id: ADMIN_ID,
    });
    expect(rpcCalls('assignment_substitutes')[0]!.ops[0]!.args[0]).toEqual({
      p_assignment_id: 'd1',
    });
  });

  it('erro do banco aparece em linguagem simples', async () => {
    const { user } = renderApp(`/escalas/${SERVICE_ID}`, { as: 'member' });
    await findHeading('Culto de domingo');
    fake.fail('rpc', 'respond_assignment', { code: 'P0001', message: 'Este evento já passou.' });
    await user.click(screen.getByRole('button', { name: 'Confirmo' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Este evento já passou.');
  });

  it('a equipe mostra a resposta de cada pessoa (ícone e texto)', async () => {
    renderApp(`/escalas/${SERVICE_ID}`, {
      as: 'admin',
      setup: (s) => setAssignment(s, 'd1', { response: 'confirmed' }),
    });
    await findHeading('Culto de domingo');
    const cantores = screen.getByRole('list', { name: 'Cantores' });
    expect(within(cantores).getByText('Confirmado')).toBeTruthy();
    const instrumentistas = screen.getByRole('list', { name: 'Instrumentistas' });
    expect(within(instrumentistas).getByText('Aguardando resposta')).toBeTruthy();
    // Admin não está escalado: sem botões de presença.
    expect(screen.queryByRole('group', { name: /Sua presença/ })).toBeNull();
  });

  it('admin vê a recusa com motivo e troca pela sugestão com um toque', async () => {
    const { user } = renderApp(`/escalas/${SERVICE_ID}`, {
      as: 'admin',
      setup: (s) => {
        setAssignment(s, 'd2', {
          response: 'declined',
          response_note: 'Viagem',
          suggested_user_id: MEMBER_ID,
        });
        s.rpc!.assignment_substitutes = [
          { user_id: ADMIN_ID, name: 'Ana' },
          { user_id: MEMBER_ID, name: 'Isa' },
        ];
      },
    });
    await findHeading('Culto de domingo');
    const list = await screen.findByRole('list', { name: 'Não podem ir' });
    expect(list.textContent).toContain('Lucas Teclado não pode');
    expect(list.textContent).toContain('Viagem');
    const buttons = await within(list).findAllByRole('button', { name: /Trocar por/ });
    expect(buttons[0]!.textContent).toContain('Trocar por Isa (sugestão)');
    await user.click(buttons[0]!);
    await waitFor(() => expect(rpcCalls('swap_assignment')).toHaveLength(1));
    expect(rpcCalls('swap_assignment')[0]!.ops[0]!.args[0]).toEqual({
      p_assignment_id: 'd2',
      p_user_id: MEMBER_ID,
    });
  });

  it('Início: botões de presença na próxima escala e recusas no "Precisa de atenção"', async () => {
    const { user } = renderApp('/', {
      as: 'member',
      setup: (s) => {
        const dash = s.rpc!.get_dashboard as { attention: unknown[] };
        dash.attention = [
          {
            id: SERVICE_ID,
            title: 'Culto de domingo',
            type: 'culto',
            starts_at: new Date(Date.now() + 86400000).toISOString(),
            no_team: false,
            no_songs: false,
            declined: 2,
          },
        ];
      },
    });
    const group = await screen.findByRole('group', {
      name: 'Sua presença em Culto de domingo',
    });
    await user.click(within(group).getByRole('button', { name: 'Confirmo' }));
    await waitFor(() => expect(rpcCalls('respond_assignment')).toHaveLength(1));
  });
});

describe('indisponibilidade', () => {
  it('Mais → Minhas indisponibilidades: adiciona um dia e apaga', async () => {
    const { user } = renderApp('/indisponibilidades', {
      as: 'member',
      setup: (s) => {
        s.tables!.member_unavailability = [
          {
            id: 'u1',
            user_id: MEMBER_ID,
            starts_on: '2999-12-24',
            ends_on: '2999-12-26',
            note: 'Natal',
          },
          {
            id: 'u0',
            user_id: MEMBER_ID,
            starts_on: '2000-01-01',
            ends_on: '2000-01-02',
            note: null,
          },
        ];
      },
    });
    await findHeading('Minhas indisponibilidades');
    const list = await screen.findByRole('list', { name: 'Períodos' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1); // o antigo não aparece
    expect(list.textContent).toContain('24/12/2999 a 26/12/2999');
    expect(list.textContent).toContain('Natal');

    const form = screen.getByRole('form', { name: 'Adicionar indisponibilidade' });
    await user.click(within(form).getByRole('button', { name: 'Adicionar' }));
    expect(within(form).getByRole('alert').textContent).toBe('Informe o primeiro e o último dia.');
    await user.type(within(form).getByLabelText('Primeiro dia'), '2999-01-05');
    await user.type(within(form).getByLabelText('Motivo (opcional)'), 'Viagem');
    await user.click(within(form).getByRole('button', { name: 'Adicionar' }));
    await waitFor(() =>
      expect(fake.writes('member_unavailability', 'insert')[0]).toEqual({
        starts_on: '2999-01-05',
        ends_on: '2999-01-05',
        note: 'Viagem',
      }),
    );
    expect(await within(form).findByText('Período salvo.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Apagar 24\/12\/2999/ }));
    await waitFor(() => expect(fake.writes('member_unavailability', 'delete')).toHaveLength(1));
  });

  it('Montar escala: alerta quem está indisponível e pede confirmação', async () => {
    const { user } = renderApp(`/escalas/montar?evento=${SERVICE_ID}`, {
      as: 'admin',
      setup: (s) => {
        s.tables!.member_unavailability = [
          {
            id: 'u1',
            user_id: ADMIN_ID,
            starts_on: '2000-01-01',
            ends_on: '2999-12-31',
            note: 'Viagem',
          },
        ];
      },
    });
    await findHeading('Montar escala');
    await screen.findByRole('option', { name: /\(indisponível\)/ });
    await user.selectOptions(screen.getAllByLabelText('Pessoa')[0]!, ADMIN_ID);
    expect(screen.getByText('Marcou que não pode nesse dia: Viagem')).toBeTruthy();
    await user.selectOptions(screen.getAllByLabelText('Função')[0]!, '2');
    await user.click(screen.getByRole('button', { name: 'Salvar escala' }));
    const dialog = await screen.findByRole('dialog', { name: 'Escalar mesmo assim?' });
    expect(dialog.textContent).toContain('marcou que não pode nesse dia');
    expect(fake.writes('event_assignments', 'insert')).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Escalar mesmo assim' }));
    await waitFor(() => expect(fake.writes('event_assignments', 'insert')).toHaveLength(1));
  });
});
