/**
 * Contrato da Edge Function `change-password` (entrada e regras). TypeScript puro: usado pela
 * função (Deno) e pelo app.
 *
 * - Primeiro acesso / senha redefinida (must_change_password): não pede a senha atual (a pessoa
 *   acabou de entrar com a provisória), mas a provisória precisa estar no prazo (7 dias).
 * - "Trocar senha" em Configurações: pede a senha atual.
 */
import { passwordProblems } from './password.ts';

export interface ChangePasswordInput {
  password: string;
  currentPassword?: string;
}

export type ChangePasswordParse =
  { ok: true; value: ChangePasswordInput } | { ok: false; error: string };

export const EXPIRED_MESSAGE =
  'Sua senha provisória venceu. Peça a um administrador para gerar outra.';

export function parseChangePasswordInput(raw: unknown): ChangePasswordParse {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Dados inválidos.' };
  }
  const body = raw as Record<string, unknown>;
  if (typeof body.password !== 'string') return { ok: false, error: 'Informe a nova senha.' };
  const problems = passwordProblems(body.password);
  if (problems.length > 0) return { ok: false, error: problems[0] as string };
  const current = body.currentPassword;
  if (current !== undefined && (typeof current !== 'string' || current === '')) {
    return { ok: false, error: 'Informe a senha atual.' };
  }
  return {
    ok: true,
    value: { password: body.password, ...(current ? { currentPassword: current } : {}) },
  };
}

/** A senha provisória venceu? (sem prazo = não vence) */
export function isTemporaryExpired(
  expiresAt: string | null | undefined,
  now = new Date(),
): boolean {
  return !!expiresAt && Date.parse(expiresAt) <= now.getTime();
}

/**
 * O que a troca exige, olhando o perfil:
 *  - 'expired': provisória vencida → recusar;
 *  - 'first-access': troca obrigatória → não pede a senha atual;
 *  - 'needs-current': troca normal → precisa da senha atual.
 */
export function changeRequirement(
  profile: { must_change_password: boolean; temp_password_expires_at: string | null },
  now = new Date(),
): 'expired' | 'first-access' | 'needs-current' {
  if (!profile.must_change_password) return 'needs-current';
  return isTemporaryExpired(profile.temp_password_expires_at, now) ? 'expired' : 'first-access';
}
