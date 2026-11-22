// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fake } from '@/test/fake-supabase';
import { SONG2_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));
afterEach(() => vi.restoreAllMocks());

function setOnline(value: boolean) {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(value);
  window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

describe('modo offline', () => {
  it('faixa "Sem internet" e botões de salvar desativados com explicação', async () => {
    setOnline(false);
    renderApp('/indisponibilidades', { as: 'member' });
    await findHeading('Minhas indisponibilidades');
    expect(
      screen.getByText('Sem internet: mostrando o que foi salvo neste aparelho.'),
    ).toBeTruthy();
    const add = screen.getByRole('button', { name: 'Adicionar' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(add.title).toBe('Precisa de internet. Conecte-se para editar ou enviar arquivos.');

    act(() => setOnline(true));
    await waitFor(() => expect(screen.queryByText(/Sem internet/)).toBeNull());
    expect(add.disabled).toBe(false);
    expect(add.title).toBe('');
  });

  it('baixa as músicas das minhas próximas escalas para usar sem internet', async () => {
    renderApp('/', { as: 'member' });
    await waitFor(() =>
      expect(
        fake.calls.some(
          (c) =>
            c.name === 'songs' &&
            c.ops.some((o) => o.method === 'eq' && o.args[0] === 'id' && o.args[1] === SONG2_ID),
        ),
      ).toBe(true),
    );
  });
});
