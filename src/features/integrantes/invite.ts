import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { z } from 'zod';
import { brand } from '@/config/brand';
import { UserFacingError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import {
  DISPLAY_NAME_MAX,
  NAME_MAX,
  NAME_MIN,
  type InviteInput,
  type InviteResult,
  type InviteRole,
} from '../../../supabase/functions/_shared/invite.ts';

export type { InviteInput, InviteResult, InviteRole };
export { parseInviteInput } from '../../../supabase/functions/_shared/invite.ts';

/** Formulário "Cadastrar integrante" (mesmas regras da Edge Function). */
export const inviteFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(NAME_MIN, 'Informe o nome completo.')
    .max(NAME_MAX, `Use até ${NAME_MAX} caracteres.`),
  displayName: z.string().trim().max(DISPLAY_NAME_MAX, `Use até ${DISPLAY_NAME_MAX} caracteres.`),
  email: z.string().trim().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
  accessRole: z.enum(['member', 'admin']),
  functionIds: z.array(z.number().int().positive()),
});

export type InviteFormValues = z.infer<typeof inviteFormSchema>;

export const ROLE_OPTIONS: { value: InviteRole; label: string; hint: string }[] = [
  {
    value: 'member',
    label: 'Integrante',
    hint: 'Escalas, repertório, letras, cifras, tom oficial e cadastro de músicas.',
  },
  {
    value: 'admin',
    label: 'Administração',
    hint: 'Tudo, inclusive escalas, comunicados, integrantes, permissões e histórico geral.',
  },
];

/** Erro da Edge Function já em português (o corpo é `{ error: "..." }`). */
export class InviteFunctionError extends UserFacingError {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'InviteFunctionError';
  }
}

export async function inviteMember(values: InviteFormValues): Promise<InviteResult> {
  const body: InviteInput = {
    fullName: values.fullName,
    displayName: values.displayName.trim() || null,
    email: values.email,
    accessRole: values.accessRole,
    functionIds: values.functionIds,
  };
  const { data, error } = await supabase.functions.invoke<InviteResult>('invite-member', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response;
      let message = 'Não foi possível concluir o cadastro. Tente de novo.';
      try {
        const payload = (await response.json()) as { error?: unknown };
        if (typeof payload.error === 'string' && payload.error) message = payload.error;
      } catch {
        // corpo não é JSON: fica a mensagem genérica
      }
      throw new InviteFunctionError(message, response.status);
    }
    throw error; // rede etc.: friendlyError traduz
  }
  if (!data?.temporaryPassword) throw new Error('Resposta inesperada do servidor.');
  return data;
}

/** Mensagem pronta para colar no WhatsApp (endereço do app + e-mail + senha provisória). */
export function buildInviteMessage(input: {
  fullName: string;
  email: string;
  temporaryPassword: string;
  appUrl: string;
}): string {
  const firstName = input.fullName.trim().split(/\s+/)[0] ?? '';
  return [
    `Olá, ${firstName}! Seu acesso ao app do ${brand.appName} (${brand.churchName}) está pronto.`,
    '',
    `Endereço: ${input.appUrl}`,
    `E-mail: ${input.email}`,
    `Senha provisória: ${input.temporaryPassword}`,
    '',
    'No primeiro acesso o app vai pedir para você criar a sua própria senha.',
  ].join('\n');
}

export function whatsappLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export interface MinistryFunctionOption {
  id: number;
  name: string;
}

async function fetchFunctions(): Promise<MinistryFunctionOption[]> {
  const { data, error } = await supabase
    .from('ministry_functions')
    .select('id, name, sort_order')
    .order('sort_order');
  if (error) throw error;
  return data.map(({ id, name }) => ({ id, name }));
}

export function useMinistryFunctions() {
  return useQuery({
    queryKey: ['ministry-functions'],
    queryFn: fetchFunctions,
    staleTime: 10 * 60_000,
  });
}

export function useInviteMember() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: inviteMember,
    onSuccess: () => client.invalidateQueries({ queryKey: ['members'] }),
  });
}
