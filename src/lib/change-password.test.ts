import { describe, expect, it } from 'vitest';
import {
  changeRequirement,
  EXPIRED_MESSAGE,
  isTemporaryExpired,
  parseChangePasswordInput,
} from '../../supabase/functions/_shared/change-password.ts';

describe('troca de senha (Edge Function change-password)', () => {
  it('valida a nova senha e a senha atual', () => {
    expect(parseChangePasswordInput(null)).toEqual({ ok: false, error: 'Dados inválidos.' });
    expect(parseChangePasswordInput([])).toEqual({ ok: false, error: 'Dados inválidos.' });
    expect(parseChangePasswordInput({})).toEqual({ ok: false, error: 'Informe a nova senha.' });
    expect(parseChangePasswordInput({ password: 'curta1' })).toEqual({
      ok: false,
      error: 'Use pelo menos 10 caracteres.',
    });
    expect(parseChangePasswordInput({ password: 'SenhaBoa2026', currentPassword: '' })).toEqual({
      ok: false,
      error: 'Informe a senha atual.',
    });
    expect(parseChangePasswordInput({ password: 'SenhaBoa2026', currentPassword: 9 })).toEqual({
      ok: false,
      error: 'Informe a senha atual.',
    });
    expect(parseChangePasswordInput({ password: 'SenhaBoa2026' })).toEqual({
      ok: true,
      value: { password: 'SenhaBoa2026' },
    });
    expect(
      parseChangePasswordInput({ password: 'SenhaBoa2026', currentPassword: 'Antiga2025x' }),
    ).toEqual({ ok: true, value: { password: 'SenhaBoa2026', currentPassword: 'Antiga2025x' } });
  });

  it('senha provisória vence em 7 dias', () => {
    const now = new Date('2026-11-22T12:00:00Z');
    expect(isTemporaryExpired(null, now)).toBe(false);
    expect(isTemporaryExpired('2026-11-22T12:00:00Z', now)).toBe(true);
    expect(isTemporaryExpired('2026-11-29T12:00:00Z', now)).toBe(false);
  });

  it('o que a troca exige', () => {
    const now = new Date('2026-11-22T12:00:00Z');
    expect(
      changeRequirement({ must_change_password: false, temp_password_expires_at: null }, now),
    ).toBe('needs-current');
    expect(
      changeRequirement(
        { must_change_password: true, temp_password_expires_at: '2026-11-25T00:00:00Z' },
        now,
      ),
    ).toBe('first-access');
    expect(
      changeRequirement(
        { must_change_password: true, temp_password_expires_at: '2026-11-20T00:00:00Z' },
        now,
      ),
    ).toBe('expired');
    expect(EXPIRED_MESSAGE).toBe(
      'Sua senha provisória venceu. Peça a um administrador para gerar outra.',
    );
  });
});
