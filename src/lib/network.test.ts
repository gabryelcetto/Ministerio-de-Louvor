import { afterEach, describe, expect, it, vi } from 'vitest';
import { friendlyError } from './errors';
import { MESSAGES } from './messages';
import { fetchWithTimeout, isKnownOffline, networkError, REQUEST_TIMEOUT_MS } from './network';

afterEach(() => vi.useRealTimers());

/** fetch de mentira que só responde quando o teste manda (ou rejeita ao ser cancelado). */
function pendingFetch() {
  const calls: { signal: AbortSignal | undefined }[] = [];
  let respond: (r: Response) => void = () => {};
  const fn = vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        calls.push({ signal: init?.signal ?? undefined });
        respond = resolve;
        // Igual ao fetch do navegador: sinal já cancelado rejeita na hora.
        const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
        if (init?.signal?.aborted) abort();
        init?.signal?.addEventListener('abort', abort);
      }),
  );
  return { fn: fn as unknown as typeof fetch, calls, respond: (r: Response) => respond(r) };
}

describe('tempo limite e sem internet nas chamadas (pendência 45)', () => {
  it('sem internet: falha na hora com o erro de rede do navegador', async () => {
    const base = pendingFetch();
    const f = fetchWithTimeout(base.fn, { isOffline: () => true });
    const error = await f('https://x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TypeError);
    expect(base.calls).toHaveLength(0);
    expect(friendlyError(error)).toBe(MESSAGES.offline);
  });

  it('servidor não responde: desiste no tempo limite e mostra "Sem conexão"', async () => {
    vi.useFakeTimers();
    const base = pendingFetch();
    const f = fetchWithTimeout(base.fn, { timeoutMs: 1000, isOffline: () => false });
    const done = f('https://x').catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(999);
    expect(base.calls[0]!.signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const error = await done;
    expect(error).toBeInstanceOf(TypeError);
    expect((error as Error).message).toMatch(/tempo esgotado/);
    expect(friendlyError(error)).toBe(MESSAGES.offline);
  });

  it('resposta a tempo passa direto (e o temporizador é desarmado)', async () => {
    vi.useFakeTimers();
    const base = pendingFetch();
    const f = fetchWithTimeout(base.fn, { timeoutMs: 1000, isOffline: () => false });
    const done = f('https://x', { method: 'POST' });
    const response = new Response('ok');
    base.respond(response);
    await expect(done).resolves.toBe(response);
    await vi.advanceTimersByTimeAsync(5000);
    expect(base.calls[0]!.signal!.aborted).toBe(false);
  });

  it('cancelamento de quem chamou continua sendo cancelamento (não vira "sem conexão")', async () => {
    const base = pendingFetch();
    const f = fetchWithTimeout(base.fn, { timeoutMs: 60_000, isOffline: () => false });
    const controller = new AbortController();
    const done = f('https://x', { signal: controller.signal }).catch((e: unknown) => e);
    controller.abort();
    expect(((await done) as Error).name).toBe('AbortError');

    const already = new AbortController();
    already.abort();
    const early = await f('https://x', { signal: already.signal }).catch((e: unknown) => e);
    expect((early as Error).name).toBe('AbortError');
  });

  it('erro de rede comum passa como veio', async () => {
    const boom = new TypeError('Failed to fetch');
    const f = fetchWithTimeout(() => Promise.reject(boom), { isOffline: () => false });
    await expect(f('https://x')).rejects.toBe(boom);
  });

  it('padrões: 15 s e navigator.onLine', async () => {
    expect(REQUEST_TIMEOUT_MS).toBe(15_000);
    expect(isKnownOffline({ onLine: false })).toBe(true);
    expect(isKnownOffline({ onLine: true })).toBe(false);
    expect(isKnownOffline({})).toBe(false);
    expect(isKnownOffline(undefined)).toBe(false);
    expect(networkError('offline').message).toMatch(/sem internet/);
    // Sem opções: usa o navigator do ambiente (online no Node).
    const ok = new Response('ok');
    await expect(fetchWithTimeout(() => Promise.resolve(ok))('https://x')).resolves.toBe(ok);
  });
});
