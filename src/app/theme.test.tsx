// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/hooks/theme-provider';
import { useTheme } from '@/hooks/use-theme';
import { findHeading, renderApp } from '@/test/render-app';
import { ThemeChoiceDialog } from './theme-choice-dialog';

vi.mock('@/services/supabase', async () => ({
  supabase: (await import('@/test/fake-supabase')).fake.client,
}));

/** matchMedia controlável: o "celular" pode estar no escuro e mudar com o app aberto. */
let systemDark = false;
const listeners = new Set<(e: { matches: boolean }) => void>();
beforeEach(() => {
  systemDark = false;
  listeners.clear();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' && systemDark,
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.delete(cb),
  }));
});
afterEach(() => vi.unstubAllGlobals());

const isDark = () => document.documentElement.classList.contains('dark');

function Probe() {
  const { pref, resolved, chosen, setPref } = useTheme();
  return (
    <div>
      <p>
        {pref}/{resolved}/{chosen ? 'escolhido' : 'novo'}
      </p>
      <button type="button" onClick={() => setPref('dark')}>
        escuro
      </button>
    </div>
  );
}

describe('ThemeProvider', () => {
  it('padrão automático, seguindo o celular (inclusive quando ele muda)', async () => {
    systemDark = true;
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText('system/dark/novo')).toBeTruthy();
    expect(isDark()).toBe(true);
    systemDark = false;
    for (const cb of listeners) cb({ matches: false });
    await waitFor(() => expect(isDark()).toBe(false));
  });

  it('salva a escolha e aplica', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'escuro' }));
    expect(screen.getByText('dark/dark/escolhido')).toBeTruthy();
    expect(localStorage.getItem('louvor.theme')).toBe('dark');
    expect(isDark()).toBe(true);
  });

  it('useTheme fora do provider explica o erro', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useTheme precisa estar dentro de <ThemeProvider>');
    spy.mockRestore();
  });
});

describe('modal "Como você prefere ver o app?"', () => {
  it('aparece no primeiro acesso, mostra a prévia e salva ao continuar', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeChoiceDialog />
      </ThemeProvider>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Como você prefere ver o app?' });
    // "Automático" vem marcado.
    expect((within(dialog).getByLabelText(/Automático/) as HTMLInputElement).checked).toBe(true);
    await user.click(within(dialog).getByLabelText(/Escuro/));
    expect(isDark()).toBe(true); // prévia
    expect(localStorage.getItem('louvor.theme')).toBeNull(); // ainda não salvou
    await user.click(within(dialog).getByRole('button', { name: 'Continuar' }));
    expect(localStorage.getItem('louvor.theme')).toBe('dark');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('fechar sem escolher salva "automático" e não mostra de novo', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <ThemeProvider>
        <ThemeChoiceDialog />
      </ThemeProvider>,
    );
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByLabelText(/Claro/));
    // Esc (o navegador dispara "cancel" no <dialog>)
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(localStorage.getItem('louvor.theme')).toBe('system');
    expect(isDark()).toBe(false);
    unmount();
    render(
      <ThemeProvider>
        <ThemeChoiceDialog />
      </ThemeProvider>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('tocar fora da folha também fecha como "automático"', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeChoiceDialog />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('dialog'));
    expect(localStorage.getItem('louvor.theme')).toBe('system');
  });

  it('não aparece para quem já escolheu (inclusive na versão anterior)', () => {
    localStorage.setItem('tema', 'light');
    render(
      <ThemeProvider>
        <ThemeChoiceDialog />
      </ThemeProvider>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('no app: aparece depois do login no primeiro acesso; não na segunda vez', async () => {
    renderApp('/', { as: 'member', theme: null });
    expect(
      await screen.findByRole('dialog', { name: 'Como você prefere ver o app?' }),
    ).toBeTruthy();
    renderApp('/', { as: 'member', theme: 'light' });
    await findHeading(/Isa/);
  });
});

describe('Configurações → Aparência', () => {
  it('troca o tema quando quiser', async () => {
    const { user } = renderApp('/configuracoes', { as: 'member', theme: 'light' });
    await findHeading('Configurações');
    const group = screen.getByRole('radiogroup', { name: 'Tema' });
    await user.click(within(group).getByLabelText(/Escuro/));
    expect(isDark()).toBe(true);
    expect(localStorage.getItem('louvor.theme')).toBe('dark');
    await user.click(within(group).getByLabelText(/Automático/));
    expect(isDark()).toBe(false);
    expect(localStorage.getItem('louvor.theme')).toBe('system');
  });

  it('login segue o sistema mesmo com tema escuro salvo', async () => {
    systemDark = false;
    renderApp('/login', { as: null, theme: 'dark' });
    await screen.findByLabelText('E-mail');
    await waitFor(() => expect(isDark()).toBe(false));
  });
});
