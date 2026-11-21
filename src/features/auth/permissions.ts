import { useMyPermissions } from '@/features/auth/hooks/use-me';
import type { PermissionKey } from '@/types/app.types';

/**
 * usePermission('chords.edit_official') → true/false.
 * SOMENTE para a interface (mostrar/esconder botões). Quem protege os dados é o RLS no banco.
 */
export function usePermission(key: PermissionKey): boolean {
  const { data } = useMyPermissions();
  return data?.includes(key) ?? false;
}
