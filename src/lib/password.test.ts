import { describe, expect, it } from 'vitest';
import {
  generatePassword,
  isValidPassword,
  newPasswordSchema,
  passwordProblems,
  PASSWORD_MIN_LENGTH,
} from './password';

describe('regra de senha (igual ao Supabase Auth)', () => {
  it('aceita 10+ caracteres com letras e números', () => {
    expect(isValidPassword('louvor2026x')).toBe(true);
    expect(isValidPassword('A1b2c3d4e5')).toBe(true);
  });

  it('explica cada problema em português', () => {
    expect(passwordProblems('abc1')).toEqual(['Use pelo menos 10 caracteres.']);
    expect(passwordProblems('somenteletras')).toEqual(['Inclua pelo menos um número.']);
    expect(passwordProblems('1234567890')).toEqual([
      'Inclua pelo menos uma letra (A a Z, sem acento).',
    ]);
    expect(passwordProblems('')).toHaveLength(3);
  });

  it('letra acentuada não conta como letra (o Auth só conta A–Z)', () => {
    expect(isValidPassword('ççççççç123')).toBe(false);
  });

  it('recusa senha acima do limite do bcrypt (72 bytes)', () => {
    expect(isValidPassword(`a1${'x'.repeat(71)}`)).toBe(false);
  });
});

describe('senha provisória', () => {
  it('tem 4 grupos de 4, letras e números, e passa na regra', () => {
    for (let i = 0; i < 200; i++) {
      const password = generatePassword();
      expect(password).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
      expect(password.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
      expect(isValidPassword(password)).toBe(true);
    }
  });

  it('não usa caracteres que se confundem (0, O, 1, l, I)', () => {
    const all = Array.from({ length: 300 }, () => generatePassword()).join('');
    expect(all).not.toMatch(/[0O1lIoi]/);
  });

  it('não se repete', () => {
    const set = new Set(Array.from({ length: 500 }, () => generatePassword()));
    expect(set.size).toBe(500);
  });

  it('refaz o sorteio quando faltam números (gerador determinístico)', () => {
    // 1ª rodada: só letras; depois, valores que caem em dígitos e letras alternados.
    let call = 0;
    const fake = (buffer: Uint32Array<ArrayBuffer>) => {
      call++;
      buffer[0] = call <= 16 ? 0 : call % 2 === 0 ? 0 : 50;
      return buffer;
    };
    const password = generatePassword(fake);
    expect(isValidPassword(password)).toBe(true);
    expect(call).toBeGreaterThan(16);
  });
});

describe('newPasswordSchema', () => {
  it('valida a regra e a confirmação', () => {
    expect(
      newPasswordSchema.safeParse({ password: 'louvor2026x', confirm: 'louvor2026x' }).success,
    ).toBe(true);
    const different = newPasswordSchema.safeParse({
      password: 'louvor2026x',
      confirm: 'louvor2026y',
    });
    expect(different.success).toBe(false);
    expect(different.error?.issues[0]?.message).toBe('As senhas não são iguais.');
    const weak = newPasswordSchema.safeParse({ password: 'curta1', confirm: 'curta1' });
    expect(weak.error?.issues.map((i) => i.message)).toContain('Use pelo menos 10 caracteres.');
  });
});
