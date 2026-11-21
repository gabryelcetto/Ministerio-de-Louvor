// @vitest-environment happy-dom
import { FunctionsHttpError } from '@supabase/supabase-js';
// Fluxos de tela com o app inteiro (rotas + Supabase de mentira).
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fake } from '@/test/fake-supabase';
import { MEMBER_ID, OTHER_ID, SONG2_ID, session } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));

describe('login', () => {
  it('"Esqueci minha senha" explica que um administrador redefine (sem e-mail)', async () => {
    const { user } = renderApp('/login', { as: null });
    const button = await screen.findByRole('button', { name: 'Esqueci minha senha' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    await user.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/Peça a um administrador do ministério/)).toBeTruthy();
  });

  it('senha errada mostra a mensagem; certa entra no app', async () => {
    const { user, router } = renderApp('/login', {
      as: null,
      setup: (s) => {
        s.passwords = { 'isa@teste.local': 'SenhaCerta2026' };
      },
    });
    await user.type(await screen.findByLabelText('E-mail'), 'isa@teste.local');
    await user.type(screen.getByLabelText('Senha'), 'errada');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeTruthy();

    await user.clear(screen.getByLabelText('Senha'));
    await user.type(screen.getByLabelText('Senha'), 'SenhaCerta2026');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    fake.emitAuth('SIGNED_IN', session(MEMBER_ID, 'isa@teste.local'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('campos vazios são validados na tela', async () => {
    const { user } = renderApp('/login', { as: null });
    await user.click(await screen.findByRole('button', { name: 'Entrar' }));
    expect(await screen.findAllByText(/Informe|inválido/)).not.toHaveLength(0);
  });

  it('quem já está logado e abre /login vai para o início', async () => {
    const { router } = renderApp('/login', { as: 'member' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});

describe('primeiro acesso e troca de senha', () => {
  it('define a senha nova e libera o app', async () => {
    const { user } = renderApp('/', {
      as: 'member',
      setup: (s) => {
        s.tables!.profiles!.find((p) => p.id === MEMBER_ID)!.must_change_password = true;
      },
    });
    await screen.findByText('Defina sua senha');
    await user.type(screen.getByLabelText('Nova senha'), 'curta1');
    await user.type(screen.getByLabelText('Repita a nova senha'), 'curta2');
    await user.click(screen.getByRole('button', { name: 'Salvar e entrar' }));
    expect(await screen.findByText('Use pelo menos 10 caracteres.')).toBeTruthy();
    expect(screen.getByText('As senhas não são iguais.')).toBeTruthy();

    await user.clear(screen.getByLabelText('Nova senha'));
    await user.clear(screen.getByLabelText('Repita a nova senha'));
    await user.type(screen.getByLabelText('Nova senha'), 'NovaSenha2026');
    await user.type(screen.getByLabelText('Repita a nova senha'), 'NovaSenha2026');
    const calls: { name: string; body: unknown }[] = [];
    fake.onInvoke(async (name, { body }) => {
      calls.push({ name, body });
      // A Edge Function troca a senha e libera a conta numa operação só.
      fake.state.tables.profiles!.find((p) => p.id === MEMBER_ID)!.must_change_password = false;
      return { data: { ok: true }, error: null };
    });
    await user.click(screen.getByRole('button', { name: 'Salvar e entrar' }));
    await waitFor(() =>
      expect(calls).toEqual([{ name: 'change-password', body: { password: 'NovaSenha2026' } }]),
    );
  });

  it('senha provisória vencida: explica e não deixa trocar', async () => {
    renderApp('/', {
      as: 'member',
      setup: (s) => {
        const me = s.tables!.profiles!.find((p) => p.id === MEMBER_ID)!;
        me.must_change_password = true;
        me.temp_password_expires_at = '2020-01-01T00:00:00Z';
      },
    });
    expect(await screen.findByText('Senha provisória vencida')).toBeTruthy();
    expect(
      screen.getByText('Sua senha provisória venceu. Peça a um administrador para gerar outra.'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Nova senha')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy();
  });

  it('Configurações: confere a senha atual e troca a senha', async () => {
    const { user } = renderApp('/configuracoes', {
      as: 'member',
      setup: (s) => {
        s.passwords = { 'isa@teste.local': 'SenhaAtual2026' };
      },
    });
    await findHeading('Configurações');
    const sent: unknown[] = [];
    fake.onInvoke(async (_name, { body }) => {
      sent.push(body);
      const current = (body as { currentPassword?: string }).currentPassword;
      if (current !== 'SenhaAtual2026') {
        return {
          data: null,
          error: new FunctionsHttpError(
            new Response(JSON.stringify({ error: 'A senha atual está incorreta.' }), {
              status: 400,
            }),
          ),
        };
      }
      return { data: { ok: true }, error: null };
    });
    await user.type(screen.getByLabelText('Senha atual'), 'errada123');
    await user.type(screen.getByLabelText('Nova senha'), 'OutraSenha2027');
    await user.type(screen.getByLabelText('Repita a nova senha'), 'OutraSenha2027');
    await user.click(screen.getByRole('button', { name: 'Trocar senha' }));
    expect(await screen.findByText('A senha atual está incorreta.')).toBeTruthy();
    expect(sent[0]).toEqual({ password: 'OutraSenha2027', currentPassword: 'errada123' });
    await user.clear(screen.getByLabelText('Senha atual'));
    await user.type(screen.getByLabelText('Senha atual'), 'SenhaAtual2026');
    await user.click(screen.getByRole('button', { name: 'Trocar senha' }));
    expect(await screen.findByText('Senha alterada.')).toBeTruthy();
  });
});

describe('notificações', () => {
  it('filtra, marca uma e todas como lidas e abre o link', async () => {
    const { user, router } = renderApp('/notificacoes', { as: 'member' });
    await findHeading('Notificações');
    const filters = screen.getByRole('group', { name: 'Filtrar notificações' });
    for (const b of within(filters).getAllByRole('button')) await user.click(b);
    await user.click(within(filters).getAllByRole('button')[0]!);
    await user.click(screen.getByRole('button', { name: 'Marcar como lida: Você foi escalada' }));
    await waitFor(() => expect(fake.writes('notifications', 'update')).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Marcar todas como lidas' }));
    await user.click(screen.getAllByRole('link', { name: /Você foi escalada/ })[0]!);
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/escalas\//));
  });
});

describe('repertório', () => {
  it('nova música: título, cifra colada (prévia), tom sugerido pelo 1º acorde, mais detalhes e salvar', async () => {
    const { user, router } = renderApp('/repertorio/nova', { as: 'member' });
    await findHeading('Nova música');
    await screen.findByLabelText('Título');
    await user.click(screen.getByRole('button', { name: 'Salvar música' }));
    expect(await screen.findByText(/Informe o título/)).toBeTruthy();
    await user.type(screen.getByLabelText('Título'), 'Música colada');
    fireEvent.change(screen.getByLabelText('Cole a cifra ou a letra'), {
      target: {
        value:
          '[Intro] Em D\n\nG          D\nSanto santo santo\nEm        C\nDeus poderoso\n\n[Refrão]\nC    G\nAleluia',
      },
    });
    expect((await screen.findByText(/O app entendeu/)).textContent).toContain(
      'acordes em cima da letra',
    );
    expect(screen.getByRole('region', { name: 'Pré-visualização' })).toBeTruthy();
    // Primeiro acorde da cifra: Em.
    expect((screen.getByLabelText('Tom') as HTMLSelectElement).value).toBe('Em');
    expect(screen.getByText(/Sugerido pelo primeiro acorde \(Em\)/)).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Tom'), 'G');
    expect(screen.getByText('O tom em que a cifra foi escrita.')).toBeTruthy();

    await user.click(screen.getByText('Mais detalhes'));
    await user.click(screen.getByRole('button', { name: 'Gerar letra a partir da cifra' }));
    expect(
      (screen.getByLabelText('Letra (se for diferente da cifra)') as HTMLTextAreaElement).value,
    ).toContain('Santo santo santo');
    await user.selectOptions(screen.getByLabelText('Tom oficial do ministério'), 'A');
    // Link inválido não bloqueia: avisa que não vai ser salvo.
    await user.type(screen.getByLabelText('Link de áudio ou vídeo'), 'youtube.com/x');
    expect(screen.getByText(/não vai ser salvo/)).toBeTruthy();
    await user.dblClick(screen.getByRole('button', { name: 'Salvar música' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/repertorio/${SONG2_ID}`));
    const creates = fake.calls.filter((c) => c.name === 'create_song');
    expect(creates).toHaveLength(1);
    expect(creates[0]!.ops[0]!.args[0]).toMatchObject({
      p_title: 'Música colada',
      p_official_key: 'A',
      p_original_key: 'G',
      p_media_url: '',
    });
  });

  it('nova música só com a letra', async () => {
    const { user, router } = renderApp('/repertorio/nova', { as: 'member' });
    await findHeading('Nova música');
    await screen.findByLabelText('Título');
    await user.type(screen.getByLabelText('Título'), 'Só letra');
    fireEvent.change(screen.getByLabelText('Cole a cifra ou a letra'), {
      target: { value: 'Santo santo santo\nDeus poderoso' },
    });
    expect(await screen.findByText(/só a letra, sem acordes/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Salvar música' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/repertorio/${SONG2_ID}`));
    expect(fake.calls.find((c) => c.name === 'create_song')!.ops[0]!.args[0]).toMatchObject({
      p_lyrics: 'Santo santo santo\nDeus poderoso',
      p_chords: '',
    });
  });

  it('sem permissão de cadastrar músicas', async () => {
    renderApp('/repertorio/nova', {
      as: 'member',
      setup: (s) => {
        s.rpc!.my_permissions = [];
      },
    });
    expect(await screen.findByText('Você não tem permissão para cadastrar músicas.')).toBeTruthy();
  });
});

describe('nova música: não perde o que foi digitado', () => {
  it('sair (Voltar/menu) com algo digitado pede confirmação', async () => {
    const { user, router } = renderApp('/repertorio/nova', { as: 'member' });
    await findHeading('Nova música');
    await screen.findByLabelText('Título');
    // Sem nada digitado, sai sem perguntar.
    await router.navigate('/repertorio');
    await findHeading('Repertório');
    await router.navigate('/repertorio/nova');
    await findHeading('Nova música');
    await screen.findByLabelText('Título');
    fireEvent.change(screen.getByLabelText('Cole a cifra ou a letra'), {
      target: { value: 'G D Santo' },
    });
    await router.navigate('/repertorio');
    const dialog = await screen.findByRole('dialog', { name: 'Sair sem salvar?' });
    await user.click(within(dialog).getByRole('button', { name: 'Continuar editando' }));
    expect(router.state.location.pathname).toBe('/repertorio/nova');
    expect(
      (screen.getByLabelText('Cole a cifra ou a letra') as HTMLTextAreaElement).value,
    ).toContain('Santo');
    await router.navigate('/repertorio');
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Sair sem salvar?' })).getByRole('button', {
        name: 'Sair sem salvar',
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/repertorio'));
  });
});

describe('integrantes', () => {
  it('admin redefine a senha de uma integrante e vê a senha provisória', async () => {
    fake.onInvoke(async () => ({ data: null, error: null }));
    const { user } = renderApp('/integrantes', { as: 'admin' });
    await findHeading('Integrantes');
    fake.onInvoke(async (name, { body }) => ({
      data: {
        userId: (body as { userId: string }).userId,
        fullName: 'Isa',
        email: 'isa@teste.local',
        temporaryPassword: 'Abcd-Efgh-Jkmn-Pqrs',
      },
      error: name === 'reset-member-password' ? null : new Error('função errada'),
    }));
    await user.click(await screen.findByRole('button', { name: 'Redefinir senha de Isa' }));
    const confirm = await screen.findByRole('dialog', { name: 'Redefinir a senha de Isa?' });
    await user.click(within(confirm).getByRole('button', { name: 'Redefinir senha' }));
    const result = await screen.findByRole('dialog', { name: /Senha de Isa redefinida/ });
    expect(within(result).getByLabelText('Senha provisória').textContent).toBe(
      'Abcd-Efgh-Jkmn-Pqrs',
    );
    const message = within(result).getByLabelText(
      'Mensagem pronta para o WhatsApp',
    ) as HTMLTextAreaElement;
    expect(message.value).toContain('redefinida');
    await user.click(within(result).getByRole('button', { name: 'Copiar senha' }));
    expect(await within(result).findByText('Senha copiada.')).toBeTruthy();
    await user.click(within(result).getByRole('button', { name: 'Copiar mensagem' }));
    await user.click(within(result).getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /redefinida/ })).toBeNull());
  });

  it('busca por nome e mostra telefones para quem pode ver', async () => {
    const { user } = renderApp('/integrantes', { as: 'admin' });
    await findHeading('Integrantes');
    expect(await screen.findByRole('link', { name: /98765-4321/ })).toBeTruthy();
    await user.type(screen.getByLabelText('Buscar integrante'), 'lucas');
    expect(await screen.findByText('Lucas Teclado')).toBeTruthy();
    await user.clear(screen.getByLabelText('Buscar integrante'));
    await user.type(screen.getByLabelText('Buscar integrante'), 'ninguém');
    expect(await screen.findByText('Ninguém encontrado com esse nome.')).toBeTruthy();
  });

  it('cadastra integrante e mostra a senha provisória', async () => {
    const { user } = renderApp('/integrantes/cadastrar', { as: 'admin' });
    await findHeading('Cadastrar integrante');
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }));
    expect(await screen.findByText('Informe o nome completo.')).toBeTruthy();
    await user.type(screen.getByLabelText('Nome completo'), 'Maria da Silva');
    await user.type(screen.getByLabelText('E-mail'), 'maria@teste.local');
    await user.click(await screen.findByRole('checkbox', { name: 'Violão' }));
    await user.click(screen.getByRole('checkbox', { name: 'Violão' }));
    await user.click(screen.getByRole('checkbox', { name: 'Teclado' }));
    fake.onInvoke(async () => ({
      data: {
        userId: OTHER_ID,
        fullName: 'Maria',
        email: 'maria@teste.local',
        temporaryPassword: 'Wxyz-2345-Abcd-Efgh',
      },
      error: null,
    }));
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }));
    expect(await screen.findByText(/não será mostrada de novo/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cadastrar outra pessoa' }));
    expect(screen.getByLabelText('Nome completo')).toBeTruthy();
  });

  it('funções do ministério: grupo obrigatório, cadastra e troca o grupo', async () => {
    const { user } = renderApp('/integrantes/funcoes', { as: 'admin' });
    await findHeading('Funções do ministério');
    await user.click(await screen.findByRole('button', { name: 'Adicionar função' }));
    expect(await screen.findByText('Escolha o grupo.')).toBeTruthy();
    await user.type(screen.getByLabelText('Nome da função'), 'Ministro(a)');
    await user.click(screen.getByRole('radio', { name: /Cantores/ }));
    await user.click(screen.getByRole('button', { name: 'Adicionar função' }));
    await waitFor(() => expect(fake.writes('ministry_functions', 'insert')).toHaveLength(1));
    await user.selectOptions(await screen.findByLabelText('Grupo de Violão'), 'vocal');
    await waitFor(() =>
      expect(fake.writes('ministry_functions', 'update')).toEqual([{ section: 'vocal' }]),
    );
  });
});

describe('início, agenda, comunicados, escalas e instalar', () => {
  it('início mostra próximas escalas e a dica de instalar pode ser dispensada', async () => {
    const { user } = renderApp('/', { as: 'member' });
    await findHeading(/Isa/);
    const dismiss = screen.queryByRole('button', { name: /Dispensar|Fechar aviso/ });
    if (dismiss) await user.click(dismiss);
    expect((await screen.findAllByText(/Culto de domingo/)).length).toBeGreaterThan(0);
  });

  it('minhas escalas e detalhe do evento com repertório no tom do dia', async () => {
    const { user, router } = renderApp('/escalas', { as: 'member' });
    await findHeading('Escalas');
    await user.click((await screen.findAllByRole('link', { name: /Culto de domingo/ }))[0]!);
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/escalas\/c0/));
    expect(await screen.findByText('Abre o culto')).toBeTruthy();
  });

  it('instalar: passo a passo e botão quando o navegador oferece', async () => {
    renderApp('/instalar', { as: 'member' });
    await findHeading(/Instalar/);
    expect(screen.getAllByText(/Compartilhar|Instalar app|tela inicial/).length).toBeGreaterThan(0);
  });

  it('integrante sem escalas vê a lista vazia', async () => {
    renderApp('/escalas', {
      as: 'member',
      setup: (s) => {
        s.tables!.event_assignments = [];
      },
    });
    await findHeading('Escalas');
    expect(await screen.findByText(/Nenhuma|não está escalad/i)).toBeTruthy();
  });

  it('atividade recente: filtra por pessoa e por música', async () => {
    const { user } = renderApp('/atividade', { as: 'admin' });
    await findHeading('Atividade recente');
    await screen.findAllByText(/Grande é o Senhor/);
    const selects = screen.getAllByRole('combobox');
    for (const select of selects) {
      const option = select.querySelectorAll('option')[1];
      if (option) await user.selectOptions(select, option.getAttribute('value')!);
    }
    await waitFor(() =>
      expect(fake.calls.filter((c) => c.name === 'get_recent_activity').length).toBeGreaterThan(1),
    );
  });
});
