/**
 * Modo offline (Fase H, item 18): o cache das consultas (TanStack Query) fica salvo no
 * IndexedDB do aparelho (idb-keyval) e volta quando o app abre sem internet. Cifras, letra,
 * tom, transposição e modo culto funcionam com o que foi salvo; áudio não (as URLs assinadas
 * vencem e os arquivos são grandes). Ao sair da conta, o cache salvo é apagado.
 */
import { del, get, set } from 'idb-keyval';

/** Chave do cache salvo no IndexedDB. */
export const OFFLINE_CACHE_KEY = 'louvor-cache-consultas';

/** Quanto tempo o que foi salvo continua valendo (e quanto tempo as consultas ficam na memória). */
export const OFFLINE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Muda quando o formato salvo deixar de ser compatível (o app descarta o cache antigo). */
export const OFFLINE_CACHE_BUSTER = 'fase-h-1';

/**
 * Consultas que não vão para o cache salvo: áudios (URLs assinadas que vencem) e gravações
 * locais (já ficam no IndexedDB do gravador e precisam ser relidas a cada abertura).
 */
const NOT_PERSISTED = new Set(['media', 'recordings']);

export function shouldPersistQueryKey(queryKey: readonly unknown[]): boolean {
  return !NOT_PERSISTED.has(String(queryKey[0]));
}

export interface KeyValueStore {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
  del: (key: string) => Promise<void>;
}

const idbStore: KeyValueStore = { get, set, del };

/**
 * Persister no formato do `@tanstack/react-query-persist-client`. Erros do IndexedDB (aba
 * anônima, espaço cheio) não derrubam o app: o cache só deixa de ser salvo.
 */
export function createOfflinePersister<T>(
  store: KeyValueStore = idbStore,
  key = OFFLINE_CACHE_KEY,
) {
  return {
    async persistClient(client: T): Promise<void> {
      try {
        await store.set(key, client);
      } catch {
        // sem espaço ou IndexedDB bloqueado: segue sem salvar
      }
    },
    async restoreClient(): Promise<T | undefined> {
      try {
        return ((await store.get(key)) as T | undefined) ?? undefined;
      } catch {
        return undefined;
      }
    },
    async removeClient(): Promise<void> {
      try {
        await store.del(key);
      } catch {
        // nada salvo ou IndexedDB bloqueado
      }
    },
  };
}

/** Apaga o cache salvo neste aparelho (ao sair da conta). */
export function clearOfflineCache(store: KeyValueStore = idbStore): Promise<void> {
  return createOfflinePersister(store).removeClient();
}
