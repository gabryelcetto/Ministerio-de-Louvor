import { invokeEdgeFunction } from '@/services/edge-function';
import { supabase } from '@/services/supabase';
import type { ProfileRow } from '@/types/app.types';

/** Colunas legíveis de profiles (phone NÃO: só via get_member_contacts). */
export const PROFILE_COLUMNS =
  'id, full_name, display_name, access_role, is_owner, status, must_change_password, temp_password_expires_at, created_at, updated_at';

export async function fetchMyProfile(userId: string): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data as ProfileRow;
}

/** Permissões efetivas calculadas pelo banco (has_permission para cada chave). */
export async function fetchMyPermissions(): Promise<string[]> {
  const { data, error } = await supabase.rpc('my_permissions');
  if (error) throw error;
  return (data ?? []) as string[];
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Troca a senha pela Edge Function `change-password` (pendência 30): ela troca no Auth e libera
 * a conta (must_change_password = false) numa operação só. Com `currentPassword`, confere antes
 * a senha atual (tela "Trocar senha" em Configurações). Senha provisória vencida (7 dias): a
 * função recusa e explica.
 */
export async function changePassword(newPassword: string, currentPassword?: string) {
  await invokeEdgeFunction<{ ok: true }>(
    'change-password',
    { password: newPassword, ...(currentPassword !== undefined ? { currentPassword } : {}) },
    'Não foi possível trocar a senha. Tente de novo.',
  );
}
