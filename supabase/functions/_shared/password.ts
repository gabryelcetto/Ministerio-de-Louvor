/**
 * Regra de senha e gerador de senha provisória. TypeScript puro (sem Deno/Node/React): usado
 * pela Edge Function `invite-member` e pelo app (src/lib/password.ts).
 *
 * A regra é a mesma do Supabase Auth (supabase/config.toml):
 *   minimum_password_length = 10, password_requirements = "letters_digits"
 * O Auth só conta letras A–Z/a–z e dígitos 0–9 (letra acentuada não conta como letra).
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72; // limite do bcrypt usado pelo Auth

/** Problemas da senha, em português. Lista vazia = senha válida. */
export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push(`Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_LENGTH) {
    problems.push(`Use no máximo ${PASSWORD_MAX_LENGTH} caracteres.`);
  }
  if (!/[A-Za-z]/.test(password)) problems.push('Inclua pelo menos uma letra (A a Z, sem acento).');
  if (!/[0-9]/.test(password)) problems.push('Inclua pelo menos um número.');
  return problems;
}

export function isValidPassword(password: string): boolean {
  return passwordProblems(password).length === 0;
}

// Sem caracteres que se confundem ao ditar/copiar: 0/O/o, 1/l/I/i.
const LETTERS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const ALPHABET = LETTERS + DIGITS;

/** Preenche o buffer com números aleatórios (crypto.getRandomValues; trocável em teste). */
export type RandomFill = (buffer: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer>;

/** Inteiro uniforme em [0, max) com rejeição (sem viés de módulo). */
function randomIndex(max: number, random: RandomFill): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  for (;;) {
    const value = random(buffer)[0] as number;
    if (value < limit) return value % max;
  }
}

const cryptoRandom: RandomFill = (buffer) => crypto.getRandomValues(buffer);

/**
 * Senha provisória forte: 16 caracteres (≈ 92 bits) em 4 grupos separados por "-", fácil de
 * ler no WhatsApp. Ex.: "Kp7m-Xq2r-8ZtA-w3Nd". Garante letras e números (regra do Auth).
 * `random` é injetável só para teste.
 */
export function generatePassword(random: RandomFill = cryptoRandom): string {
  for (;;) {
    const chars = Array.from({ length: 16 }, () => ALPHABET[randomIndex(ALPHABET.length, random)]);
    const plain = chars.join('');
    const digits = plain.replace(/[^0-9]/g, '').length;
    if (digits >= 2 && plain.length - digits >= 2) {
      return [0, 4, 8, 12].map((i) => plain.slice(i, i + 4)).join('-');
    }
  }
}
