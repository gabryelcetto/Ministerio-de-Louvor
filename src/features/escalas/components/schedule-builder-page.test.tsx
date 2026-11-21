// @vitest-environment happy-dom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fake } from '@/test/fake-supabase';
import { MEMBER_ID, OTHER_ID, SERVICE_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));

async function openBuilder(path = '/escalas/montar') {
  const app = renderApp(path, { as: 'admin' });
  await findHeading('Montar escala');
  await screen.findByRole('radiogroup', { name: 'Evento' });
  return app;
}

describe('montar escala', () => {
  it('sem escolher nada mostra os erros (evento novo e evento da agenda)', async () => {
    const { user } = await openBuilder();
    await user.click(screen.getByRole('button', { name: 'Criar evento e salvar escala' }));
    expect(await screen.findByText('Informe o título.')).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Evento da agenda' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Evento' }), '');
    await user.click(screen.getByRole('button', { name: 'Salvar escala' }));
    expect(await screen.findByText('Escolha o evento.')).toBeTruthy();
  });

  it('escala pessoas num evento da agenda, filtra por grupo e remove alguém já escalado', async () => {
    const { user } = await openBuilder(`/escalas/montar?evento=${SERVICE_ID}`);
    expect((screen.getByRole('combobox', { name: 'Evento' }) as HTMLSelectElement).value).toBe(
      SERVICE_ID,
    );
    // Equipe atual do culto
    expect(await screen.findByText('Já na escala')).toBeTruthy();

    const filters = screen.getByRole('radiogroup', { name: 'Mostrar' });
    for (const radio of within(filters).getAllByRole('radio')) await user.click(radio);
    await user.click(within(filters).getAllByRole('radio')[0]!);

    await user.selectOptions(screen.getAllByLabelText('Pessoa')[0]!, MEMBER_ID);
    await user.selectOptions(screen.getAllByLabelText('Função')[0]!, '2');
    await user.type(screen.getAllByLabelText('Observação (opcional)')[0]!, 'Leva o violão');
    await user.click(screen.getByRole('button', { name: 'Adicionar pessoa' }));
    await user.click(screen.getByRole('button', { name: 'Tirar a linha 2' }));
    await user.click(screen.getByRole('button', { name: 'Salvar escala' }));
    await waitFor(() =>
      expect(fake.writes('event_assignments', 'insert')[0]).toEqual([
        { event_id: SERVICE_ID, user_id: MEMBER_ID, function_id: 2, notes: 'Leva o violão' },
      ]),
    );
  });

  it('remove alguém que já está na escala (com confirmação)', async () => {
    const { user } = await openBuilder(`/escalas/montar?evento=${SERVICE_ID}`);
    const remove = await screen.findAllByRole('button', { name: /^Remover / });
    await user.click(remove[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Remover da escala?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remover' }));
    await waitFor(() => expect(fake.writes('event_assignments', 'delete')).toHaveLength(1));
  });

  it('cria um evento novo com a equipe', async () => {
    const { user, router } = await openBuilder();
    await user.click(screen.getByRole('radio', { name: 'Novo evento' }));

    await user.selectOptions(screen.getByLabelText('Tipo'), 'ensaio');
    await user.type(screen.getByLabelText('Título'), 'Ensaio extra');
    fireEvent.change(screen.getByLabelText('Início (horário de Brasília)'), {
      target: { value: '2030-05-10T19:30' },
    });
    fireEvent.change(screen.getByLabelText('Término (opcional)'), {
      target: { value: '2030-05-10T18:00' },
    });
    await user.type(screen.getByLabelText('Local (opcional)'), 'Sala 2');
    await user.type(screen.getByLabelText('Observações (opcional)'), 'Trazer cifras');
    await user.selectOptions(screen.getAllByLabelText('Pessoa')[0]!, OTHER_ID);
    await user.selectOptions(screen.getAllByLabelText('Função')[0]!, '3');
    await user.click(screen.getByRole('button', { name: 'Criar evento e salvar escala' }));
    // Término antes do início é recusado na tela.
    expect(await screen.findByText(/depois do início/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Término (opcional)'), {
      target: { value: '2030-05-10T21:00' },
    });
    await user.click(screen.getByRole('button', { name: 'Criar evento e salvar escala' }));
    await waitFor(() => expect(fake.writes('events', 'insert')).toHaveLength(1));
    expect(fake.writes('events', 'insert')[0]).toMatchObject({
      type: 'ensaio',
      title: 'Ensaio extra',
      location: 'Sala 2',
    });
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/escalas\//));
  });

  it('erro ao salvar a equipe aparece em português', async () => {
    const { user } = await openBuilder();
    await user.click(screen.getByRole('radio', { name: 'Evento da agenda' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Evento' }), SERVICE_ID);
    await user.selectOptions(screen.getAllByLabelText('Pessoa')[0]!, OTHER_ID);
    await user.selectOptions(screen.getAllByLabelText('Função')[0]!, '2');
    fake.fail('from', 'event_assignments', {
      code: '23505',
      message:
        'duplicate key value violates unique constraint "event_assignments_event_id_user_id_function_id_key"',
    });
    await user.click(screen.getByRole('button', { name: 'Salvar escala' }));
    expect(await screen.findByText('Essa pessoa já está escalada nessa função.')).toBeTruthy();
  });
});
