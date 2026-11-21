/**
 * Tempo limite e "sem internet" para as chamadas ao servidor (pendências 45 e 46).
 *
 * Sem isto, uma gravação feita com o aparelho offline podia ficar parada em "Salvando…" por muito
 * tempo. O fetch embrulhado:
 * - falha NA HORA quando o navegador sabe que está offline (`navigator.onLine === false`);
 * - desiste depois de `timeoutMs` sem resposta.
 * Nos dois casos lança um `TypeError("Failed to fetch …")`, o mesmo erro de rede do navegador:
 * as bibliotecas (supabase-js, auth) já tratam esse erro como "sem rede", e o friendlyError
 * mostra "Sem conexão. Tente de novo.". Nada do que a pessoa digitou ou gravou se perde: só a
 * chamada falha.
 */

/** Espera máxima por uma resposta do servidor. */
export const REQUEST_TIMEOUT_MS = 15_000;

/** Envio de arquivo: desiste quando o progresso fica parado por este tempo. */
export const UPLOAD_STALL_TIMEOUT_MS = 30_000;

/** O navegador sabe que está sem internet? (`onLine` true não garante que há rede.) */
export function isKnownOffline(nav: { onLine?: boolean } | undefined = globalThis.navigator) {
  return nav?.onLine === false;
}

/** Erro igual ao do navegador quando a rede falha. */
export function networkError(reason: 'offline' | 'timeout'): TypeError {
  return new TypeError(
    `Failed to fetch (${reason === 'offline' ? 'sem internet' : 'tempo esgotado'})`,
  );
}

type Fetch = typeof fetch;

export function fetchWithTimeout(
  baseFetch: Fetch,
  {
    timeoutMs = REQUEST_TIMEOUT_MS,
    isOffline = () => isKnownOffline(),
  }: { timeoutMs?: number; isOffline?: () => boolean } = {},
): Fetch {
  return async (input, init) => {
    if (isOffline()) throw networkError('offline');
    const controller = new AbortController();
    const callerSignal = init?.signal ?? undefined;
    // Quem chamou pode cancelar: repassa o cancelamento (o erro de cancelamento continua o dele).
    const forward = () => controller.abort(callerSignal?.reason);
    if (callerSignal?.aborted) forward();
    else callerSignal?.addEventListener('abort', forward, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      return await baseFetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (timedOut) throw networkError('timeout');
      throw error;
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', forward);
    }
  };
}
