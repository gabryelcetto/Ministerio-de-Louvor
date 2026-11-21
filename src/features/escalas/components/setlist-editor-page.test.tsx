// @vitest-environment happy-dom
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fake } from '@/test/fake-supabase';
import { SERVICE_ID, SONG2_ID, SONG_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));

const saves = () =>
  fake.calls
    .filter((c) => c.name === 'set_event_songs')
    .map((c) => c.ops[0]!.args[0] as Record<string, unknown>);

describe('editar repertório do evento', () => {
  it('reordena, troca o tom do dia, anota, remove, adiciona pela busca e salva numa chamada', async () => {
    const { user, router } = renderApp(`/escalas/${SERVICE_ID}/repertorio`, { as: 'admin' });
    await findHeading('Editar repertório');
    const order = await screen.findByRole('list', { name: 'Ordem do repertório' });
    const titles = () =>
      within(screen.getByRole('list', { name: 'Ordem do repertório' }))
        .getAllByRole('group')
        .map((g) => g.getAttribute('aria-label'));
    expect(titles()).toEqual(['1. Grande é o Senhor', '2. Música sem cifra']);
    // Subir na primeira e descer na última ficam desligados.
    expect(
      (within(order).getByRole('button', { name: 'Subir Grande é o Senhor' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await user.click(within(order).getByRole('button', { name: 'Subir Música sem cifra' }));
    expect(titles()).toEqual(['1. Música sem cifra', '2. Grande é o Senhor']);

    const second = within(screen.getByRole('group', { name: '2. Grande é o Senhor' }));
    expect((second.getByLabelText('Tom do dia') as HTMLSelectElement).value).toBe('B');
    await user.selectOptions(second.getByLabelText('Tom do dia'), '');
    await user.type(second.getByLabelText('Observação (opcional)'), ' e teclado');

    await user.click(screen.getByRole('button', { name: 'Tirar Música sem cifra' }));
    expect(titles()).toEqual(['1. Grande é o Senhor']);

    const results = await screen.findByRole('list', { name: 'Resultado da busca' });
    const add = within(results).getByRole('button', { name: /Adicionar.*Música sem cifra/ });
    await user.click(add);
    expect(titles()).toEqual(['1. Grande é o Senhor', '2. Música sem cifra']);
    expect(
      within(results).getByRole('button', { name: /Na lista.*Música sem cifra/ }),
    ).toBeTruthy();

    await user.dblClick(screen.getByRole('button', { name: 'Salvar repertório' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/escalas/${SERVICE_ID}`));
    expect(router.state.location.hash).toBe('#repertorio');
    expect(saves()).toEqual([
      {
        p_event_id: SERVICE_ID,
        p_items: [
          { song_id: SONG_ID, key_for_event: null, notes: 'Só voz e violão e teclado' },
          { song_id: SONG2_ID, key_for_event: null, notes: null },
        ],
      },
    ]);
  });

  it('como passo 3 de "Montar escala", com "Pular"', async () => {
    const { user, router } = renderApp(`/escalas/${SERVICE_ID}/repertorio?montar=1`, {
      as: 'admin',
    });
    await findHeading('Montar escala');
    expect(await screen.findByText(/Passo 3 · Repertório/)).toBeTruthy();
    await user.click(screen.getByRole('link', { name: 'Pular' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/escalas/${SERVICE_ID}`));
  });

  it('erro do banco em linguagem simples', async () => {
    const { user } = renderApp(`/escalas/${SERVICE_ID}/repertorio`, { as: 'admin' });
    await screen.findByRole('list', { name: 'Ordem do repertório' });
    fake.fail('rpc', 'set_event_songs', {
      code: '42501',
      message: 'Você não tem permissão para montar o repertório.',
    });
    await user.click(screen.getByRole('button', { name: 'Salvar repertório' }));
    expect(await screen.findByText(/não tem permissão/)).toBeTruthy();
  });

  it('sem permissão', async () => {
    renderApp(`/escalas/${SERVICE_ID}/repertorio`, { as: 'member' });
    expect(
      await screen.findByText('Você não tem permissão para montar o repertório.'),
    ).toBeTruthy();
  });
});
