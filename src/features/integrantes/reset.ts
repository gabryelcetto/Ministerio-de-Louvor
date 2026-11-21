import { useMutation, useQueryClient } from '@tanstack/react-query';
import { brand } from '@/config/brand';
import type { AccessRole } from '@/types/app.types';
import type { ResetResult } from '../../../supabase/functions/_shared/reset.ts';
import { invokeEdgeFunction } from './edge';

export type { ResetResult };

export interface ResetActor {
  id: string;
  isOwner: boolean;
  canManageMembers: boolean;
}

export interface ResetTarget {
  id: string;
  role: AccessRole;
  isOwner: boolean;
}

/**
 * Mostra o botão "Redefinir senha"? Espelha as regras do banco (assert_can_reset_password), só
 * para a interface — quem decide de verdade é o banco, chamado pela Edge Function.
 */
export function canResetPassword(me: ResetActor | null, target: ResetTarget): boolean {
  if (!me?.canManageMembers) return false;
  if (target.id === me.id) return false; // a própria senha é em Configurações
  if (target.isOwner) return false; // ninguém redefine a do dono por aqui
  if (target.role === 'admin' && !me.isOwner) return false; // outro admin: só o dono
  return true;
}

export async function resetMemberPassword(userId: string): Promise<ResetResult> {
  const data = await invokeEdgeFunction<ResetResult>(
    'reset-member-password',
    { userId },
    'Não foi possível redefinir a senha. Tente de novo.',
  );
  if (!data.temporaryPassword) throw new Error('Resposta inesperada do servidor.');
  return data;
}

/** Mensagem pronta para o WhatsApp depois de redefinir a senha. */
export function buildResetMessage(input: {
  fullName: string;
  email: string;
  temporaryPassword: string;
  appUrl: string;
}): string {
  const firstName = input.fullName.trim().split(/\s+/)[0] ?? '';
  return [
    `Olá, ${firstName}! Sua senha do app do ${brand.appName} (${brand.churchName}) foi redefinida.`,
    '',
    `Endereço: ${input.appUrl}`,
    `E-mail: ${input.email}`,
    `Senha provisória: ${input.temporaryPassword}`,
    '',
    'Ao entrar, o app vai pedir para você criar uma senha nova.',
  ].join('\n');
}

export function useResetPassword() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: resetMemberPassword,
    onSuccess: () => client.invalidateQueries({ queryKey: ['members'] }),
  });
}
