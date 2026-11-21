import { useCallback, useRef } from 'react';

/**
 * Uma gravação por vez: enquanto a anterior não terminou, novos pedidos são ignorados.
 * Resolve o duplo toque em "Salvar" — dois cliques no mesmo instante chegam antes de o botão
 * virar "Salvando…" (o estado do React ainda é o da renderização anterior), e a trava em ref
 * vale na hora.
 *
 * `keepLockedOnSuccess`: depois de dar certo, continua travado (telas que saem logo em seguida,
 * como "Nova música", não podem gravar de novo no instante antes de navegar).
 */
export function useSingleFlight({ keepLockedOnSuccess = false } = {}) {
  const busy = useRef(false);
  return useCallback(
    async <T>(task: () => Promise<T>): Promise<T | undefined> => {
      if (busy.current) return undefined;
      busy.current = true;
      let ok = false;
      try {
        const result = await task();
        ok = true;
        return result;
      } finally {
        if (!ok || !keepLockedOnSuccess) busy.current = false;
      }
    },
    [keepLockedOnSuccess],
  );
}
