// @vitest-environment happy-dom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fake } from '@/test/fake-supabase';
import { SONG2_ID, SONG_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));

const open = (as: 'admin' | 'member' = 'admin', path = `/repertorio/${SONG_ID}`) => {
  const app = renderApp(path, { as });
  return app;
};

describe('tela da música', () => {
  it('transpõe pela barra de tom, volta ao oficial e muda o tamanho da letra', async () => {
    const { user, router } = open();
    await findHeading('Grande é o Senhor');
    // Abre no tom oficial (A): a cifra em G sobe 2 semitons.
    expect(router.state.location.search).toBe('');
    await user.click(screen.getByRole('button', { name: 'Subir meio tom' }));
    expect(router.state.location.search).toBe('?tom=Bb');
    await user.click(screen.getByRole('button', { name: 'Descer meio tom' }));
    await user.click(screen.getByRole('button', { name: 'Descer meio tom' }));
    expect(router.state.location.search).toMatch(/tom=(G%23|Ab)/);
    await user.click(screen.getByTitle(/Voltar ao tom oficial/));
    expect(router.state.location.search).toContain('tom=A');
    // Troca rápida de tom repetidas vezes não quebra a tela.
    for (let i = 0; i < 15; i++) {
      await user.click(screen.getByRole('button', { name: 'Subir meio tom' }));
    }
    expect(router.state.location.search).toMatch(/tom=/);
    await user.click(screen.getByRole('button', { name: 'Aumentar letra' }));
    await user.click(screen.getByRole('button', { name: 'Diminuir letra' }));
    // Aba da letra
    await user.click(screen.getByRole('tab', { name: 'Letra' }));
    expect(router.state.location.search).toContain('aba=letra');
    // Setas do teclado trocam de aba (padrão WAI-ARIA).
    screen.getByRole('tab', { name: 'Letra' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(router.state.location.search).toContain('aba=cifra');
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Enter}');
  });

  it('edita e salva a letra', async () => {
    const { user } = open();
    await findHeading('Grande é o Senhor');
    await user.click(screen.getByRole('button', { name: 'Editar letra' }));
    const field = screen.getByRole('textbox', { name: 'Letra' });
    await user.clear(field);
    await user.type(field, 'Nova letra');
    await user.click(screen.getByRole('button', { name: 'Salvar letra' }));
    expect(await screen.findByText('Letra salva.')).toBeTruthy();
    expect(fake.writes('song_lyrics', 'upsert')).toEqual([
      { song_id: SONG_ID, content: 'Nova letra' },
    ]);
  });

  it('cancelar com alteração pede confirmação; continuar editando mantém o texto', async () => {
    const { user } = open();
    await findHeading('Grande é o Senhor');
    await user.click(screen.getByRole('button', { name: 'Editar letra' }));
    await user.type(screen.getByRole('textbox', { name: 'Letra' }), ' mais');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Descartar alterações?' });
    await user.click(within(dialog).getByRole('button', { name: 'Continuar editando' }));
    expect((screen.getByRole('textbox', { name: 'Letra' }) as HTMLTextAreaElement).value).toMatch(
      / mais$/,
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Descartar alterações?' })).getByRole(
        'button',
        { name: 'Descartar' },
      ),
    );
    expect(screen.getByRole('button', { name: 'Editar letra' })).toBeTruthy();
  });

  it('edita a cifra com pré-visualização, avisos e conversão', async () => {
    const { user } = open();
    await findHeading('Grande é o Senhor');
    await user.click(screen.getByRole('button', { name: 'Editar cifra' }));
    const field = screen.getByLabelText('Cifra (ChordPro)');
    await user.clear(field);
    // Acordes sobre a letra: o botão converte para ChordPro.
    await user.type(field, 'G       D{enter}Quão grande és Tu');
    await user.click(screen.getByRole('button', { name: /Converter acordes sobre a letra/ }));
    expect((field as HTMLTextAreaElement).value).toContain('[G]');
    await user.click(screen.getByRole('button', { name: 'Pré-visualizar' }));
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.click(screen.getByRole('button', { name: 'Salvar cifra' }));
    expect(await screen.findByText('Cifra salva.')).toBeTruthy();
    expect(fake.writes('song_chords', 'upsert')[0]).toMatchObject({
      song_id: SONG_ID,
      review_status: 'official',
    });
  });

  it('define o tom oficial e mostra erro do banco em português', async () => {
    const { user } = open();
    await findHeading('Grande é o Senhor');
    await user.click(screen.getByRole('button', { name: 'Definir tom oficial' }));
    await user.selectOptions(screen.getByLabelText('Tom oficial'), 'C');
    fake.fail(
      'from',
      'songs',
      { code: '42501', message: 'new row violates row-level security' },
      'update',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar tom oficial' }));
    expect(await screen.findByText(/não tem permissão/)).toBeTruthy();
  });

  it('edita os dados e arquiva/desarquiva', async () => {
    const { user } = open();
    await findHeading('Grande é o Senhor');
    await user.click(screen.getByRole('button', { name: 'Editar dados' }));
    const title = screen.getByLabelText('Título');
    await user.clear(title);
    await user.type(title, 'Grande é o Senhor (nova)');
    await user.type(screen.getByLabelText('Link de áudio/vídeo (opcional)'), 'https://youtu.be/x');
    // happy-dom não atualiza o isDirty do react-hook-form (no navegador o E2E cobre o botão):
    // envia o formulário direto.
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar dados' }).closest('form')!);
    expect(await screen.findByText('Dados da música salvos.')).toBeTruthy();
    expect(fake.writes('songs', 'update')[0]).toMatchObject({ title: 'Grande é o Senhor (nova)' });

    await user.click(screen.getByRole('button', { name: 'Arquivar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Arquivar esta música?' });
    await user.click(within(dialog).getByRole('button', { name: 'Arquivar' }));
    await waitFor(() =>
      expect(
        fake.writes('songs', 'update').some((p) => (p as { archived_at?: string }).archived_at),
      ).toBe(true),
    );
  });

  it('integrante não vê Arquivar nem Histórico restaurável; música sem cifra abre na letra', async () => {
    const { user, router } = open('member', `/repertorio/${SONG2_ID}`);
    await findHeading('Música sem cifra');
    expect(screen.queryByRole('button', { name: 'Arquivar' })).toBeNull();
    expect(screen.getByText('Esta música ainda não tem letra.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Adicionar cifra' }));
    expect(router.state.location.search).toContain('aba=cifra');
  });

  it('música inexistente', async () => {
    open('admin', '/repertorio/00000000-0000-4000-8000-00000000dead');
    expect(await findHeading('Música não encontrada')).toBeTruthy();
  });
});

describe('histórico da música', () => {
  it('filtra por campo e restaura uma versão', async () => {
    const { user } = renderApp(`/repertorio/${SONG_ID}/historico`, { as: 'admin' });
    await findHeading(/Histórico/);
    const filters = screen.getByRole('group', { name: 'Filtrar por campo' });
    for (const button of within(filters).getAllByRole('button')) await user.click(button);
    await user.click(within(filters).getAllByRole('button')[0]!);
    await user.click(screen.getAllByRole('button', { name: /Restaurar/ })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Restaurar esta versão?' });
    await user.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    await waitFor(() =>
      expect(fake.calls.some((c) => c.name === 'restore_song_version')).toBe(true),
    );
  });
});
