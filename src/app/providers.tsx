import { QueryClient } from '@tanstack/react-query';
import {
  PersistQueryClientProvider,
  type PersistedClient,
} from '@tanstack/react-query-persist-client';
import { useState, type ReactNode } from 'react';
import { SessionProvider } from '@/features/auth/session-provider';
import { ThemeProvider } from '@/hooks/theme-provider';
import {
  OFFLINE_CACHE_BUSTER,
  OFFLINE_CACHE_MAX_AGE_MS,
  createOfflinePersister,
  shouldPersistQueryKey,
} from '@/lib/offline-cache';

/**
 * Providers globais: TanStack Query (cache das consultas, salvo no aparelho para o modo
 * offline), tema e sessão do Supabase Auth.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Fica na memória tanto quanto no aparelho (senão o cache salvo perde as consultas).
            gcTime: OFFLINE_CACHE_MAX_AGE_MS,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  const [persister] = useState(() => createOfflinePersister<PersistedClient>());
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: OFFLINE_CACHE_MAX_AGE_MS,
        buster: OFFLINE_CACHE_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === 'success' && shouldPersistQueryKey(query.queryKey),
        },
      }}
    >
      <ThemeProvider>
        <SessionProvider>{children}</SessionProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
