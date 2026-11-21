// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSingleFlight } from './use-single-flight';

describe('useSingleFlight (uma gravação por vez)', () => {
  it('ignora o segundo pedido enquanto o primeiro não terminou', async () => {
    const { result } = renderHook(() => useSingleFlight());
    let finish: (v: string) => void = () => {};
    const calls: string[] = [];
    const task = (name: string) => () =>
      new Promise<string>((resolve) => {
        calls.push(name);
        finish = resolve;
      });
    const first = result.current(task('a'));
    const second = await result.current(task('b'));
    expect(second).toBeUndefined();
    finish('ok');
    expect(await first).toBe('ok');
    expect(calls).toEqual(['a']);
    // Terminou: libera para a próxima.
    const third = result.current(task('c'));
    finish('ok2');
    expect(await third).toBe('ok2');
    expect(calls).toEqual(['a', 'c']);
  });

  it('libera mesmo quando a gravação falha', async () => {
    const { result } = renderHook(() => useSingleFlight());
    await expect(result.current(() => Promise.reject(new Error('rede')))).rejects.toThrow('rede');
    expect(await result.current(async () => 1)).toBe(1);
  });
});

describe('useSingleFlight com keepLockedOnSuccess', () => {
  it('depois de dar certo, fica travado; se falhar, libera', async () => {
    const { result } = renderHook(() => useSingleFlight({ keepLockedOnSuccess: true }));
    await expect(result.current(() => Promise.reject(new Error('rede')))).rejects.toThrow();
    expect(await result.current(async () => 'salvou')).toBe('salvou');
    expect(await result.current(async () => 'de novo')).toBeUndefined();
  });
});
