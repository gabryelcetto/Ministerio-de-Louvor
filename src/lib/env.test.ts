import { describe, expect, it } from 'vitest';
import { MissingEnvError, readPublicEnv } from './env';

describe('readPublicEnv', () => {
  it('retorna os valores (sem espaços) quando estão presentes', () => {
    expect(
      readPublicEnv({
        VITE_SUPABASE_URL: ' https://abc.supabase.co ',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_123',
      }),
    ).toEqual({
      supabaseUrl: 'https://abc.supabase.co',
      supabasePublishableKey: 'sb_publishable_123',
    });
  });

  it('lista todas as variáveis ausentes numa mensagem clara', () => {
    expect(() => readPublicEnv({})).toThrow(MissingEnvError);
    expect(() => readPublicEnv({ VITE_SUPABASE_URL: '' })).toThrow(
      /VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  it('recusa URL inválida', () => {
    expect(() =>
      readPublicEnv({ VITE_SUPABASE_URL: 'abc', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' }),
    ).toThrow(/inválida/);
  });
});
