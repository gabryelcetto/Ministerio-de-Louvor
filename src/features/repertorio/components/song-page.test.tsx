// @vitest-environment happy-dom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fake } from '@/test/fake-supabase';
import { SERVICE_ID, SONG2_ID, SONG_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));
vi.mock('@/lib/audio/soundtouch', () => ({
  isSoundTouchSupported: () => false,
  attachSoundTouch: vi.fn(),
}));

const wakeLock = { request: vi.fn() };
beforeEach(() => {
  wakeLock.request.mockReset().mockResolvedValue({ release: vi.fn(async () => undefined) });
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: wakeLock });
  HTMLMediaElement.prototype.play = vi.fn(async () => undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
});

const open = (as: 'admin' | 'member' = 'admin', path = `/repertorio/${SONG_ID}`) =>
  renderApp(path, { as });

async function menuItem(user: ReturnType<typeof open>['user'], name: string | RegExp) {
  await user.click(await screen.findByRole('button', { name: 'Mais opções' }));
  return screen.findByRole('menuitem', { name });
}

describe('música: modo tocar', () => {
  it('cabeçalho com título e "Tom oficial"; só Cifra | Letra entre o topo e a cifra', async () => {
    open();
    await findHeading('Grande é o Senhor');
    expect(screen.getByText('Tom oficial A')).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Conteúdo da música' })).toBeTruthy();
    // Nada de botões de edição soltos na tela: ficam no ⋯.
    expect(screen.queryByRole('button', { name: 'Editar letra' })).toBeNull();
    // Acordes na cor do acorde, sobre a sílaba.
    expect(document.querySelector('.text-chord')?.textContent).toBeTruthy();
  });

  it('vindo de uma escala com a música no repertório: posição e tom do dia no cabeçalho', async () => {
    open('member', `/repertorio/${SONG_ID}?tom=B&evento=${SERVICE_ID}`);
    expect(await screen.findByText('1 de 2 · Culto de domingo em B')).toBeTruthy();
  });

  it('evento sem a música: cabeçalho com tom oficial e o tom do evento', async () => {
    renderApp(`/repertorio/${SONG_ID}?tom=B&evento=${SERVICE_ID}`, {
      as: 'member',
      setup: (s) => {
        const service = s.tables!.events!.find((e) => e.id === SERVICE_ID)!;
        service.event_songs = [];
      },
    });
    expect(await screen.findByText('Tom oficial A · Culto de domingo em B')).toBeTruthy();
  });

  it('dock: − / + transpõem (legenda em tons), Oficial volta, troca rápida não quebra', async () => {
    const { user, router } = open();
    await findHeading('Grande é o Senhor');
    const dock = screen.getByRole('region', { name: 'Controles da música' });
    expect(within(dock).getByText(/no tom oficial/)).toBeTruthy();
    await user.click(within(dock).getByRole('button', { name: 'Subir meio tom' }));
    expect(router.state.location.search).toBe('?tom=Bb');
    expect(await within(dock).findByText(/\+½ tom · áudio acompanha/)).toBeTruthy();
    await user.click(within(dock).getByRole('button', { name: 'Subir meio tom' }));
    expect(within(dock).getByText(/\+1 tom · áudio acompanha/)).toBeTruthy();
    await user.click(within(dock).getByRole('button', { name: 'Descer meio tom' }));
    await user.click(within(dock).getByRole('button', { name: 'Descer meio tom' }));
    await user.click(within(dock).getByRole('button', { name: 'Descer meio tom' }));
    expect(router.state.location.search).toMatch(/tom=(G%23|Ab)/);
    await user.click(within(dock).getByRole('button', { name: /Oficial/ }));
    expect(router.state.location.search).toContain('tom=A');
    for (let i = 0; i < 15; i++) {
      await user.click(within(dock).getByRole('button', { name: 'Subir meio tom' }));
    }
    expect(router.state.location.search).toMatch(/tom=/);
    await user.selectOptions(within(dock).getByRole('combobox', { name: 'Tom' }), 'C');
    expect(router.state.location.search).toBe('?tom=C');
  });

  it('Aa alterna 3 tamanhos e lembra; a aba escolhida também fica guardada', async () => {
    const { user, router } = open();
    await findHeading('Grande é o Senhor');
    await user.click(screen.getByRole('button', { name: /Tamanho da letra: Média/ }));
    expect(screen.getByRole('button', { name: /Tamanho da letra: Grande/ })).toBeTruthy();
    expect(localStorage.getItem('louvor.tamanho-letra')).toBe('2');
    await user.click(screen.getByRole('button', { name: /Tamanho da letra: Grande/ }));
    expect(screen.getByRole('button', { name: /Tamanho da letra: Pequena/ })).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Letra' }));
    expect(router.state.location.search).toContain('aba=letra');
    expect(localStorage.getItem('louvor.aba')).toBe('letra');
    screen.getByRole('tab', { name: 'Letra' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(router.state.location.search).toContain('aba=cifra');
  });

  it('abre na última aba escolhida', async () => {
    open();
    // Gravado antes de a música carregar (a tela lê a aba ao montar).
    localStorage.setItem('louvor.aba', 'letra');
    await findHeading('Grande é o Senhor');
    expect(screen.getByRole('tab', { name: 'Letra' }).getAttribute('aria-selected')).toBe('true');
  });

  it('dock com o áudio de referência: tocar, chip de velocidade 100% → 75% → 50%', async () => {
    const { user } = open('member');
    await findHeading('Grande é o Senhor');
    const player = await screen.findByTestId('audio-player');
    expect(player.dataset.pitch).toBe('2'); // original G, na tela A
    await user.click(within(player).getByRole('button', { name: 'Tocar Voz guia' }));
    await user.click(within(player).getByRole('button', { name: 'Velocidade 100%' }));
    expect(player.dataset.speed).toBe('0.75');
    await user.click(within(player).getByRole('button', { name: 'Velocidade 75%' }));
    expect(player.dataset.speed).toBe('0.5');
    await user.click(within(player).getByRole('button', { name: 'Velocidade 50%' }));
    expect(player.dataset.speed).toBe('1');
    fireEvent.change(within(player).getByRole('slider', { name: 'Posição em Voz guia' }), {
      target: { value: '30' },
    });
  });

  it('ajustes do áudio: tom manual desliga o "acompanhar"; o áudio escolhido fica marcado', async () => {
    const { user } = open('member');
    await findHeading('Grande é o Senhor');
    await screen.findByTestId('audio-player');
    await user.click(await screen.findByRole('button', { name: 'Subir meio tom do áudio' }));
    expect(screen.getByTestId('audio-player').dataset.pitch).toBe('3');
    const follow = screen.getByRole('checkbox', { name: /Acompanhar o tom da cifra/ });
    expect((follow as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(/áudio no ajuste manual/)).toBeTruthy();
    await user.click(follow);
    expect(screen.getByTestId('audio-player').dataset.pitch).toBe('2');
    await user.click(screen.getByRole('button', { name: '75%' }));
    await user.click(screen.getByRole('button', { name: 'Aumentar velocidade' }));
    await user.click(screen.getByRole('button', { name: 'Diminuir velocidade' }));
    expect(screen.getByTestId('audio-player').dataset.speed).toBe('0.75');
    const chosen = screen.getByRole('button', { name: /No player.*Voz guia/ });
    expect(chosen.getAttribute('aria-pressed')).toBe('true');
    await user.click(chosen);
  });

  it('mantém a tela ligada (Wake Lock) no modo tocar', async () => {
    open('member');
    await findHeading('Grande é o Senhor');
    await waitFor(() => expect(wakeLock.request).toHaveBeenCalledWith('screen'));
  });
});

describe('música: menu ⋯', () => {
  it('admin vê todas as ações', async () => {
    const { user } = open('admin');
    await findHeading('Grande é o Senhor');
    await user.click(await screen.findByRole('button', { name: 'Mais opções' }));
    expect((await screen.findAllByRole('menuitem')).map((i) => i.textContent)).toEqual([
      'Editar cifra',
      'Editar letra',
      'Editar dados',
      'Definir tom oficial',
      'Histórico',
      'Gravar áudio de referência',
      'Excluir',
    ]);
  });

  it('sem permissões extras: letra, histórico e gravar', async () => {
    const { user } = renderApp(`/repertorio/${SONG2_ID}`, {
      as: 'member',
      setup: (s) => {
        s.rpc!.my_permissions = [];
      },
    });
    await findHeading('Música sem cifra');
    expect(screen.getByText('Esta música ainda não tem letra.')).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Mais opções' }));
    expect((await screen.findAllByRole('menuitem')).map((i) => i.textContent)).toEqual([
      'Editar letra',
      'Histórico',
      'Gravar áudio de referência',
    ]);
  });

  it('editar e salvar a letra (o dock some enquanto edita)', async () => {
    const { user } = open();
    await findHeading('Grande é o Senhor');
    await user.click(await menuItem(user, 'Editar letra'));
    expect(screen.queryByRole('region', { name: 'Controles da música' })).toBeNull();
    const field = screen.getByRole('textbox', { name: 'Letra' });
    await user.clear(field);
    await user.type(field, 'Nova letra');
    // Duplo clique grava uma vez só (pendência 44).
    await user.dblClick(screen.getByRole('button', { name: 'Salvar letra' }));
    expect(await screen.findByText('Letra salva.')).toBeTruthy();
    expect(fake.writes('song_lyrics', 'upsert')).toEqual([
      { song_id: SONG_ID, content: 'Nova letra' },
    ]);
    expect(screen.getByRole('region', { name: 'Controles da música' })).toBeTruthy();
  });

  it('sem internet ao salvar a letra: "Sem conexão. Tente de novo." e o texto continua', async () => {
    const { user } = open();
    await findHeading('Grande é o Senhor');
    await user.click(await menuItem(user, 'Editar letra'));
    const field = screen.getByRole('textbox', { name: 'Letra' });
    await user.clear(field);
    await user.type(field, 'Texto que não pode sumir');
    // O mesmo erro que o cliente devolve quando o fetch falha (sem rede ou tempo esgotado).
    fake.fail('from', 'song_lyrics', { message: 'TypeError: Failed to fetch' }, 'upsert');
    await user.click(screen.getByRole('button', { name: 'Salvar letra' }));
    expect(await screen.findByText('Sem conexão. Tente de novo.')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Letra' }) as HTMLTextAreaElement).value).toBe(
      'Texto que não pode sumir',
    );
    // Dá para tentar de novo: a trava foi liberada depois do erro.
    fake.reset({ ...fake.state, tables: fake.state.tables });
    await user.click(screen.getByRole('button', { name: 'Salvar letra' }));
    expect(await screen.findByText('Letra salva.')).toBeTruthy();
  });

  it('cancelar com alteração pede confirmação', async () => {
    const { user } = open();
    await findHeading('Grande é o Senhor');
    await user.click(await menuItem(user, 'Editar letra'));
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
    expect(screen.getByRole('region', { name: 'Controles da música' })).toBeTruthy();
  });

  it('editar a cifra com conversão e salvar', async () => {
    const { user } = open();
    await findHeading('Grande é o Senhor');
    await user.click(await menuItem(user, 'Editar cifra'));
    const field = screen.getByRole('textbox', { name: 'Cifra' });
    await user.clear(field);
    await user.type(field, 'G       D{enter}Quão grande és Tu');
    await user.click(screen.getByRole('button', { name: /Converter acordes sobre a letra/ }));
    expect((field as HTMLTextAreaElement).value).toContain('[G]');
    await user.click(screen.getByRole('button', { name: 'Pré-visualizar' }));
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.click(screen.getByRole('button', { name: 'Salvar cifra' }));
    expect(await screen.findByText('Cifra salva.')).toBeTruthy();
  });

  it('definir tom oficial: erro do banco em linguagem simples', async () => {
    const { user } = open();
    await findHeading('Grande é o Senhor');
    await user.click(await menuItem(user, 'Definir tom oficial'));
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

  it('editar dados e excluir (com confirmação)', async () => {
    const { user } = open();
    await findHeading('Grande é o Senhor');
    await user.click(await menuItem(user, 'Editar dados'));
    const title = screen.getByLabelText('Título');
    await user.clear(title);
    await user.type(title, 'Grande é o Senhor (nova)');
    // happy-dom não atualiza o isDirty do react-hook-form (o E2E cobre o botão).
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar dados' }).closest('form')!);
    expect(await screen.findByText('Dados da música salvos.')).toBeTruthy();

    await user.click(await menuItem(user, 'Excluir'));
    const dialog = await screen.findByRole('dialog', { name: 'Excluir esta música?' });
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await waitFor(() =>
      expect(
        fake
          .writes('songs', 'update')
          .some((p) => Boolean((p as { archived_at?: string }).archived_at)),
      ).toBe(true),
    );
  });

  it('música excluída: aviso e "Restaurar música"', async () => {
    const { user } = renderApp(`/repertorio/${SONG_ID}`, {
      as: 'admin',
      setup: (s) => {
        s.tables!.songs!.find((x) => x.id === SONG_ID)!.archived_at = '2026-01-10T00:00:00Z';
      },
    });
    expect(await screen.findByText(/excluída/)).toBeTruthy();
    await user.click(await menuItem(user, 'Restaurar música'));
    const dialog = await screen.findByRole('dialog', { name: 'Restaurar esta música?' });
    await user.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    await waitFor(() =>
      expect(fake.writes('songs', 'update')).toContainEqual({ archived_at: null }),
    );
  });

  it('histórico e gravar áudio de referência pelo menu', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const { user, router } = open('member');
    await findHeading('Grande é o Senhor');
    await user.click(await menuItem(user, 'Gravar áudio de referência'));
    expect(scroll).toHaveBeenCalled();
    expect(document.activeElement?.textContent).toContain('Gravar');
    await user.click(await menuItem(user, 'Histórico'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/repertorio/${SONG_ID}/historico`),
    );
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
    const dialog = await screen.findByRole('dialog', { name: 'Restaurar esta alteração?' });
    await user.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    await waitFor(() =>
      expect(fake.calls.some((c) => c.name === 'restore_song_version')).toBe(true),
    );
  });

  it('modo culto: "1 de 2 · Culto de domingo", Próxima/Anterior no tom do dia e deslizar', async () => {
    const { user, router } = open('member', `/repertorio/${SONG_ID}?tom=B&evento=${SERVICE_ID}`);
    await findHeading('Grande é o Senhor');
    expect(await screen.findByText('1 de 2 · Culto de domingo em B')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Sequência do repertório' });
    expect(
      (within(nav).getByRole('button', { name: /Anterior/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(within(nav).getByRole('button', { name: /Próxima/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/repertorio/${SONG2_ID}`));
    expect(router.state.location.search).toBe(`?evento=${SERVICE_ID}`);
    await findHeading('Música sem cifra');
    expect(await screen.findByText('2 de 2 · Culto de domingo')).toBeTruthy();

    // Deslizar para a direita volta para a anterior, no tom do dia (B).
    const content = screen.getByRole('tablist').closest('section')!;
    fireEvent.touchStart(content, { touches: [{ clientX: 50, clientY: 100 }] });
    fireEvent.touchEnd(content, { changedTouches: [{ clientX: 250, clientY: 110 }] });
    await waitFor(() => expect(router.state.location.pathname).toBe(`/repertorio/${SONG_ID}`));
    expect(router.state.location.search).toBe(`?tom=B&evento=${SERVICE_ID}`);

    // Rolagem na vertical não troca de música.
    await findHeading('Grande é o Senhor');
    const again = screen.getByRole('tablist').closest('section')!;
    fireEvent.touchStart(again, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(again, { changedTouches: [{ clientX: 20, clientY: 400 }] });
    expect(router.state.location.pathname).toBe(`/repertorio/${SONG_ID}`);
  });

  it('fora do repertório do evento: sem sequência', async () => {
    open('member', `/repertorio/${SONG_ID}`);
    await findHeading('Grande é o Senhor');
    expect(screen.queryByRole('navigation', { name: 'Sequência do repertório' })).toBeNull();
  });
});
