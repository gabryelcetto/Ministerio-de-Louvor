import { describe, expect, it } from 'vitest';
import { shouldClearCache } from './session-cache';

describe('shouldClearCache', () => {
  it('limpa ao sair', () => {
    expect(shouldClearCache('SIGNED_OUT', 'a', null)).toBe(true);
  });

  it('limpa quando entra outra pessoa', () => {
    expect(shouldClearCache('SIGNED_IN', 'a', 'b')).toBe(true);
  });

  it('NÃO limpa quando o mesmo usuário "entra de novo" (recarregar, conferir senha atual)', () => {
    expect(shouldClearCache('SIGNED_IN', 'a', 'a')).toBe(false);
    expect(shouldClearCache('USER_UPDATED', 'a', 'a')).toBe(false);
    expect(shouldClearCache('TOKEN_REFRESHED', 'a', 'a')).toBe(false);
  });

  it('primeiro login (não havia ninguém): nada para limpar', () => {
    expect(shouldClearCache('SIGNED_IN', null, 'a')).toBe(false);
    expect(shouldClearCache('INITIAL_SESSION', null, 'a')).toBe(false);
  });
});
