import 'fake-indexeddb/auto';
import { QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
  type PersistedClient,
} from '@tanstack/react-query-persist-client';
import { describe, expect, it, vi } from 'vitest';
import {
  OFFLINE_CACHE_BUSTER,
  OFFLINE_CACHE_KEY,
  clearOfflineCache,
  createOfflinePersister,
  shouldPersistQueryKey,
  type KeyValueStore,
} from './offline-cache';

function memoryStore(): KeyValueStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (k) => data.get(k),
    set: async (k, v) => void data.set(k, v),
    del: async (k) => void data.delete(k),
  };
}

const broken: KeyValueStore = {
  get: () => Promise.reject(new Error('bloqueado')),
  set: () => Promise.reject(new Error('cheio')),
  del: () => Promise.reject(new Error('bloqueado')),
};

describe('cache offline', () => {
  it('não salva áudio (URLs assinadas); salva o resto', () => {
    expect(shouldPersistQueryKey(['media', 'song', 's1'])).toBe(false);
    expect(shouldPersistQueryKey(['recordings', 'local', 'rehearsal', 'e1'])).toBe(false);
    expect(shouldPersistQueryKey(['songs', 'detail', 's1'])).toBe(true);
    expect(shouldPersistQueryKey(['events', 'detail', 'e1'])).toBe(true);
    expect(shouldPersistQueryKey([])).toBe(true);
  });

  it('salva, restaura e apaga na chave do app', async () => {
    const store = memoryStore();
    const persister = createOfflinePersister<{ n: number }>(store);
    expect(await persister.restoreClient()).toBeUndefined();
    await persister.persistClient({ n: 1 });
    expect(store.data.get(OFFLINE_CACHE_KEY)).toEqual({ n: 1 });
    expect(await persister.restoreClient()).toEqual({ n: 1 });
    await clearOfflineCache(store);
    expect(store.data.size).toBe(0);
  });

  it('IndexedDB com problema não derruba o app', async () => {
    const persister = createOfflinePersister(broken);
    await expect(persister.persistClient({})).resolves.toBeUndefined();
    await expect(persister.restoreClient()).resolves.toBeUndefined();
    await expect(persister.removeClient()).resolves.toBeUndefined();
  });

  it('a música aberta volta depois de fechar o app (IndexedDB de verdade)', async () => {
    const persister = createOfflinePersister<PersistedClient>();
    const first = new QueryClient();
    first.setQueryData(['songs', 'detail', 's1'], { title: 'Grande é o Senhor' });
    first.setQueryData(['media', 'song', 's1'], [{ url: 'https://assinada' }]);
    await persistQueryClientSave({
      queryClient: first,
      persister,
      buster: OFFLINE_CACHE_BUSTER,
      dehydrateOptions: { shouldDehydrateQuery: (q) => shouldPersistQueryKey(q.queryKey) },
    });

    const second = new QueryClient();
    await persistQueryClientRestore({
      queryClient: second,
      persister,
      buster: OFFLINE_CACHE_BUSTER,
    });
    expect(second.getQueryData(['songs', 'detail', 's1'])).toEqual({ title: 'Grande é o Senhor' });
    expect(second.getQueryData(['media', 'song', 's1'])).toBeUndefined();

    // Sair da conta apaga o que foi salvo.
    await clearOfflineCache();
    const third = new QueryClient();
    await persistQueryClientRestore({
      queryClient: third,
      persister,
      buster: OFFLINE_CACHE_BUSTER,
    });
    expect(third.getQueryData(['songs', 'detail', 's1'])).toBeUndefined();
  });

  it('cache de outra versão do app é descartado', async () => {
    const persister = createOfflinePersister<PersistedClient>();
    const first = new QueryClient();
    first.setQueryData(['songs', 'detail', 's2'], { title: 'Antiga' });
    await persistQueryClientSave({ queryClient: first, persister, buster: 'outra' });
    const second = new QueryClient();
    const removeSpy = vi.spyOn(persister, 'removeClient');
    await persistQueryClientRestore({
      queryClient: second,
      persister,
      buster: OFFLINE_CACHE_BUSTER,
    });
    expect(second.getQueryData(['songs', 'detail', 's2'])).toBeUndefined();
    expect(removeSpy).toHaveBeenCalled();
  });
});
