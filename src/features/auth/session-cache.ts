import type { AuthChangeEvent } from '@supabase/supabase-js';

/**
 * Quando limpar o cache do TanStack Query numa mudança de sessão.
 *
 * Só quando o dono dos dados muda: saiu, ou entrou OUTRA pessoa. O Supabase também emite
 * `SIGNED_IN` para o MESMO usuário (ao recarregar a página e quando a tela "Trocar senha" confere
 * a senha atual com signInWithPassword); limpar nesses casos desmontava a tela no meio da ação.
 */
export function shouldClearCache(
  event: AuthChangeEvent,
  previousUserId: string | null,
  nextUserId: string | null,
): boolean {
  if (event === 'SIGNED_OUT') return true;
  return previousUserId !== null && nextUserId !== null && previousUserId !== nextUserId;
}
