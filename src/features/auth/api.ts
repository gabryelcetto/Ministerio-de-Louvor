import { UserFacingError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { ProfileRow } from '@/types/app.types';

/** Colunas legíveis de profiles (phone NÃO: só via get_member_contacts). */
export const PROFILE_COLUMNS =
  'id, full_name, display_name, access_role, is_owner, status, must_change_password, created_at, updated_at';

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
 * Troca a senha no Supabase Auth e, em seguida, libera a conta no banco
 * (`complete_password_change`: must_change_password = false, só para o próprio usuário).
 * Com `currentPassword`, confere antes a senha atual (tela "Trocar senha" em Configurações):
 * quem pegar o celular desbloqueado não troca a senha de ninguém.
 */
export async function changePassword(newPassword: string, currentPassword?: string) {
  if (currentPassword !== undefined) {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) throw new UserFacingError('Sua sessão expirou. Entre de novo.');
    const { error } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (error) {
      if (/invalid login credentials/i.test(error.message)) {
        throw new UserFacingError('A senha atual está incorreta.');
      }
      throw error;
    }
  }
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) throw updateError;
  const { error: rpcError } = await supabase.rpc('complete_password_change');
  if (rpcError) throw rpcError;
}
