/**
 * Contrato da Edge Function `reset-member-password` (entrada e saída) e validação da entrada.
 * TypeScript puro: usado pela função (Deno) e pelo app.
 */

/** Resposta de sucesso (200). A senha só aparece aqui, uma única vez. */
export interface ResetResult {
  userId: string;
  /** Nome para mostrar e usar na mensagem (apelido ou nome completo). */
  fullName: string;
  email: string;
  temporaryPassword: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResetParse = { ok: true; value: { userId: string } } | { ok: false; error: string };

export function parseResetInput(raw: unknown): ResetParse {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Dados inválidos.' };
  }
  const userId = (raw as Record<string, unknown>).userId;
  if (typeof userId !== 'string' || !UUID_RE.test(userId.trim())) {
    return { ok: false, error: 'Integrante inválido.' };
  }
  return { ok: true, value: { userId: userId.trim().toLowerCase() } };
}
