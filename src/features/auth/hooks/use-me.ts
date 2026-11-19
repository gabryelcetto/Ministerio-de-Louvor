import { useQuery } from '@tanstack/react-query';
import { fetchMyPermissions, fetchMyProfile } from '../api';
import { useSession } from '../session-context';

/** Perfil do usuário logado. */
export function useMyProfile() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['me', 'profile', userId],
    queryFn: () => fetchMyProfile(userId as string),
    enabled: Boolean(userId),
  });
}

/** Permissões efetivas do usuário logado (consulta ao banco). */
export function useMyPermissions() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['me', 'permissions', userId],
    queryFn: fetchMyPermissions,
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });
}
