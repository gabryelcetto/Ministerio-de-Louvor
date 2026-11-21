// @vitest-environment happy-dom
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fake } from '@/test/fake-supabase';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));

const rpcArgs = (name: string) =>
  fake.calls
    .filter((c) => c.name === name)
    .map((c) => c.ops[0]!.args[0] as Record<string, unknown>);

describe('funções do ministério: gerenciar', () => {
  it('renomeia, reordena e desativa', async () => {
    const { user } = renderApp('/integrantes/funcoes', { as: 'admin' });
    await findHeading('Funções do ministério');
    const list = await screen.findByRole('list', { name: 'Funções do ministério' });
    const ups = within(list).getAllByRole('button', { name: /^Subir / });
    expect((ups[0] as HTMLButtonElement).disabled).toBe(true);
    await user.click(ups[1]!);
    await waitFor(() => expect(rpcArgs('move_ministry_function')).toHaveLength(1));
    expect(rpcArgs('move_ministry_function')[0]).toMatchObject({ p_delta: -1 });

    await user.click(within(list).getByRole('button', { name: 'Renomear Violão' }));
    const form = screen.getByRole('form', { name: 'Renomear Violão' });
    const input = within(form).getByLabelText('Novo nome');
    await user.clear(input);
    await user.type(input, 'Violão 12 cordas');
    await user.click(within(form).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(fake.writes('ministry_functions', 'update')).toContainEqual({
        name: 'Violão 12 cordas',
      }),
    );

    await user.click(within(list).getByRole('button', { name: 'Desativar Teclado' }));
    await waitFor(() =>
      expect(fake.writes('ministry_functions', 'update')).toContainEqual({ active: false }),
    );
  });

  it('excluir função em uso explica e oferece desativar', async () => {
    const { user } = renderApp('/integrantes/funcoes', { as: 'admin' });
    const list = await screen.findByRole('list', { name: 'Funções do ministério' });
    fake.fail('rpc', 'delete_ministry_function', {
      code: 'P0001',
      message:
        'Esta função já foi usada em escalas ou por integrantes. Desative em vez de excluir.',
    });
    await user.click(within(list).getByRole('button', { name: 'Excluir Vocal' }));
    const dialog = screen.getByRole('dialog', { name: 'Excluir a função Vocal?' });
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Desative em vez de excluir.');
    await user.click(within(alert).getByRole('button', { name: 'Desativar Vocal' }));
    await waitFor(() =>
      expect(fake.writes('ministry_functions', 'update')).toContainEqual({ active: false }),
    );
  });

  it('função nunca usada é excluída', async () => {
    const { user } = renderApp('/integrantes/funcoes', { as: 'admin' });
    const list = await screen.findByRole('list', { name: 'Funções do ministério' });
    await user.click(within(list).getByRole('button', { name: 'Excluir Violão' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Excluir a função Violão?' })).getByRole('button', {
        name: 'Excluir',
      }),
    );
    await waitFor(() => expect(rpcArgs('delete_ministry_function')).toEqual([{ p_id: 2 }]));
  });

  it('função desativada some da montagem de escala', async () => {
    renderApp('/escalas/montar', {
      as: 'admin',
      setup: (s) => {
        s.tables!.ministry_functions![2]!.active = false;
      },
    });
    await findHeading('Montar escala');
    const select = (await screen.findAllByLabelText('Função'))[0]!;
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).not.toContain('Teclado');
    expect(options).toContain('Violão');
  });
});
