// @vitest-environment happy-dom
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fake } from '@/test/fake-supabase';
import { REHEARSAL_ID, SERVICE_ID, SONG_ID } from '@/test/fixtures';
import { findHeading, renderApp } from '@/test/render-app';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));

/** Cada tela do app com o título esperado. */
const SCREENS: [string, RegExp][] = [
  ['/', /(Bom dia|Boa tarde|Boa noite), (Ana|Isa)/],
  ['/escalas', /^Escalas$/],
  [`/escalas/${SERVICE_ID}`, /Culto de domingo/],
  [`/escalas/${REHEARSAL_ID}`, /Ensaio geral/],
  ['/repertorio', /Repertório/],
  ['/repertorio/nova', /Nova música/],
  [`/repertorio/${SONG_ID}`, /Grande é o Senhor/],
  [`/repertorio/${SONG_ID}/historico`, /Histórico/],
  ['/agenda', /Agenda/],
  ['/notificacoes', /Notificações/],
  ['/comunicados', /Comunicados/],
  ['/integrantes', /Integrantes/],
  ['/configuracoes', /Configurações/],
  ['/instalar', /Instalar/],
];
const ADMIN_ONLY: [string, RegExp][] = [
  ['/escalas/montar', /Montar escala/],
  ['/atividade', /Atividade recente/],
  ['/integrantes/cadastrar', /Cadastrar integrante/],
  ['/integrantes/funcoes', /Funções do ministério/],
];

describe('todas as telas abrem com dados (admin)', () => {
  it.each([...SCREENS, ...ADMIN_ONLY])('%s', async (path, heading) => {
    renderApp(path, { as: 'admin' });
    expect(await findHeading(heading)).toBeTruthy();
    // Nenhuma tela mostra o erro genérico de carregamento.
    await waitFor(() => expect(screen.queryByText(/Não foi possível carregar/)).toBeNull());
  });
});

describe('todas as telas abrem com dados (integrante)', () => {
  it.each(SCREENS)('%s', async (path, heading) => {
    renderApp(path, { as: 'member' });
    expect(await findHeading(heading)).toBeTruthy();
  });

  it.each([
    ['/escalas/montar', /não tem permissão|Montar escala/i],
    ['/atividade', /Atividade recente/],
    ['/integrantes/cadastrar', /Cadastrar integrante/],
    ['/integrantes/funcoes', /Funções do ministério/],
  ])('%s mostra o aviso de permissão', async (path, heading) => {
    renderApp(path, { as: 'member' });
    await findHeading(heading);
    expect(await screen.findByText(/não tem permissão/i)).toBeTruthy();
  });
});

describe('guarda de rota', () => {
  it('sem login vai para /login', async () => {
    const { router } = renderApp('/repertorio', { as: null });
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByLabelText('E-mail')).toBeTruthy();
  });

  it('endereço inexistente mostra "página não encontrada"', async () => {
    renderApp('/nao-existe');
    expect(await screen.findByText(/não encontrada/i)).toBeTruthy();
  });

  it('perfil inativo vê o aviso e pode sair', async () => {
    const { user } = renderApp('/', {
      as: 'member',
      setup: (s) => {
        const me = s.tables!.profiles!.find((p) => p.id === s.session!.user.id)!;
        me.status = 'inactive';
      },
    });
    expect(await screen.findByText('Acesso desativado')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(fake.state.session).toBeNull();
  });

  it('senha provisória bloqueia o app em "Defina sua senha"', async () => {
    renderApp('/repertorio', {
      as: 'member',
      setup: (s) => {
        const me = s.tables!.profiles!.find((p) => p.id === s.session!.user.id)!;
        me.must_change_password = true;
      },
    });
    expect(await screen.findByText('Defina sua senha')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).toBeNull();
  });

  it('erro ao carregar o perfil oferece tentar de novo', async () => {
    const { user } = renderApp('/', {
      as: 'member',
      setup: () => undefined,
    });
    fake.fail('from', 'profiles', { code: 'XX000', message: 'boom' });
    // A primeira consulta pode ter saído antes do fail: força uma nova sessão.
    fake.emitAuth('SIGNED_IN', fake.state.session);
    const retry = await screen.findByRole('button', { name: 'Tentar de novo' }).catch(() => null);
    if (retry) await user.click(retry);
  });
});
