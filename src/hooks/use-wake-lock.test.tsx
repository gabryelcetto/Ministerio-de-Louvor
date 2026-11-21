// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock } from './use-wake-lock';

function install(request: () => Promise<{ release: () => Promise<void> }>) {
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
}
afterEach(() => {
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined });
});

describe('useWakeLock (tela ligada no modo tocar)', () => {
  it('pede a trava, pede de novo ao voltar para a aba e solta ao sair', async () => {
    const release = vi.fn(async () => undefined);
    const request = vi.fn(async () => ({ release }));
    install(request);
    const { unmount } = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    unmount();
    await waitFor(() => expect(release).toHaveBeenCalled());
  });

  it('inativo (editando) não pede', () => {
    const request = vi.fn();
    install(request);
    renderHook(() => useWakeLock(false));
    expect(request).not.toHaveBeenCalled();
  });

  it('sem suporte ou sem permissão: segue sem erro', async () => {
    renderHook(() => useWakeLock(true));
    const request = vi.fn(async () => {
      throw new Error('NotAllowedError');
    });
    install(request);
    const { unmount } = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalled());
    unmount();
  });

  it('saiu da tela antes da resposta: solta a trava que chegou atrasada', async () => {
    const release = vi.fn(async () => undefined);
    let resolve: (v: { release: typeof release }) => void = () => {};
    install(() => new Promise((r) => (resolve = r)));
    const { unmount } = renderHook(() => useWakeLock(true));
    unmount();
    resolve({ release });
    await waitFor(() => expect(release).toHaveBeenCalled());
  });
});
