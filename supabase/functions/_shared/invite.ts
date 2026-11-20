/**
 * Contrato da Edge Function `invite-member` (entrada e saída) e a validação da entrada.
 * TypeScript puro: usado pela função (Deno) e pelo app (src/features/integrantes/invite.ts).
 */

export type InviteRole = 'member' | 'leader' | 'admin';

export interface InviteInput {
  fullName: string;
  displayName: string | null;
  email: string;
  accessRole: InviteRole;
  functionIds: number[];
}

/** Resposta de sucesso (201). A senha só aparece aqui, uma única vez. */
export interface InviteResult {
  userId: string;
  fullName: string;
  email: string;
  temporaryPassword: string;
}

/** Resposta de erro (4xx/5xx): mensagem pronta para mostrar, em português. */
export interface InviteError {
  error: string;
}

export const NAME_MIN = 2;
export const NAME_MAX = 120;
export const DISPLAY_NAME_MAX = 40;
const ROLES: readonly InviteRole[] = ['member', 'leader', 'admin'];
// Simples de propósito: quem confirma de verdade é o Auth; aqui só barra erro de digitação.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParseResult = { ok: true; value: InviteInput } | { ok: false; error: string };

export function parseInviteInput(raw: unknown): ParseResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Dados do cadastro inválidos.' };
  }
  const r = raw as Record<string, unknown>;

  const fullName = typeof r.fullName === 'string' ? r.fullName.trim().replace(/\s+/g, ' ') : '';
  if (fullName.length < NAME_MIN || fullName.length > NAME_MAX) {
    return {
      ok: false,
      error: `Informe o nome completo (de ${NAME_MIN} a ${NAME_MAX} caracteres).`,
    };
  }

  const display = typeof r.displayName === 'string' ? r.displayName.trim() : '';
  if (display.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `O nome de exibição pode ter até ${DISPLAY_NAME_MAX} caracteres.` };
  }

  const email = typeof r.email === 'string' ? r.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: 'Informe um e-mail válido.' };
  }

  const accessRole = r.accessRole ?? 'member';
  if (typeof accessRole !== 'string' || !ROLES.includes(accessRole as InviteRole)) {
    return { ok: false, error: 'Perfil de acesso inválido.' };
  }

  const ids = r.functionIds ?? [];
  if (
    !Array.isArray(ids) ||
    ids.length > 20 ||
    !ids.every((id) => Number.isInteger(id) && (id as number) > 0 && (id as number) < 32768)
  ) {
    return { ok: false, error: 'Funções do ministério inválidas.' };
  }

  return {
    ok: true,
    value: {
      fullName,
      displayName: display || null,
      email,
      accessRole: accessRole as InviteRole,
      functionIds: [...new Set(ids as number[])],
    },
  };
}
