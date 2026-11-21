/**
 * Monta o app de verdade (rotas, guarda de rota, layout e telas) num roteador em memória, com o
 * Supabase de mentira. Use em arquivos com `// @vitest-environment happy-dom` e com:
 *   vi.mock('@/services/supabase', async () => ({ supabase: (await import('@/test/fake-supabase')).fake.client }));
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { SessionProvider } from '@/features/auth/session-provider';
import { fake, type FakeState } from './fake-supabase';
import { baseState } from './fixtures';

export function newQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

export interface RenderAppOptions {
  as?: 'admin' | 'member' | null;
  /** Altera o estado inicial do banco de mentira antes de montar. */
  setup?: (state: Partial<FakeState>) => void;
}

/** App inteiro na rota `path`. */
export function renderApp(path: string, { as = 'admin', setup }: RenderAppOptions = {}) {
  const state = baseState(as);
  setup?.(state);
  fake.reset(state);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  const utils = render(
    <QueryClientProvider client={newQueryClient()}>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>,
  );
  return { ...utils, user, router };
}

/** Um componente solto, com consultas, sessão e roteador (sem as rotas do app). */
export function renderWithProviders(
  ui: ReactElement,
  { as = 'admin', setup, path = '/' }: RenderAppOptions & { path?: string } = {},
) {
  const state = baseState(as);
  setup?.(state);
  fake.reset(state);
  const user = userEvent.setup();
  const utils = render(
    <QueryClientProvider client={newQueryClient()}>
      <SessionProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  );
  return { ...utils, user };
}

/** Espera o título principal da tela (h1). */
export function findHeading(name: string | RegExp) {
  return screen.findByRole('heading', { level: 1, name }, { timeout: 3000 });
}
