import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { requireAffected } from '@/lib/errors';
import { supabase } from '@/services/supabase';
import type { Section } from './sections';

/** Funções do ministério com o grupo (cantores/instrumentistas), para a tela de gestão. */
export interface MinistryFunction {
  id: number;
  name: string;
  sortOrder: number;
  section: Section;
  /** false = desativada (some das escolhas, continua no histórico). */
  active: boolean;
}

export const FUNCTION_NAME_MAX = 40;

/** Nova função: o grupo é obrigatório (o banco também recusa sem grupo). */
export const functionFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome da função.')
    .max(FUNCTION_NAME_MAX, `Use até ${FUNCTION_NAME_MAX} caracteres.`),
  section: z.enum(['vocal', 'instrumental'], { message: 'Escolha o grupo.' }),
});

export type FunctionFormValues = z.infer<typeof functionFormSchema>;

export const SECTION_OPTION: Record<Section, { label: string; hint: string }> = {
  vocal: { label: 'Cantores', hint: 'Vocal, backing vocal, ministro(a)…' },
  instrumental: { label: 'Instrumentistas', hint: 'Teclado, violão, bateria, som…' },
};

function toSection(value: string): Section {
  return value === 'vocal' ? 'vocal' : 'instrumental';
}

export async function fetchMinistryFunctions(): Promise<MinistryFunction[]> {
  const { data, error } = await supabase
    .from('ministry_functions')
    .select('id, name, sort_order, section, active')
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data.map((f) => ({
    id: f.id,
    name: f.name,
    sortOrder: f.sort_order,
    section: toSection(f.section),
    active: f.active,
  }));
}

/** Próxima posição na lista: depois da última. */
export function nextSortOrder(functions: readonly Pick<MinistryFunction, 'sortOrder'>[]): number {
  return functions.reduce((max, f) => Math.max(max, f.sortOrder), 0) + 1;
}

export async function addMinistryFunction(
  values: FunctionFormValues & { sortOrder: number },
): Promise<void> {
  const { data, error } = await supabase
    .from('ministry_functions')
    .insert({ name: values.name.trim(), section: values.section, sort_order: values.sortOrder })
    .select('id');
  if (error) throw error;
  requireAffected(data);
}

export async function setFunctionSection(input: { id: number; section: Section }): Promise<void> {
  const { data, error } = await supabase
    .from('ministry_functions')
    .update({ section: input.section })
    .eq('id', input.id)
    .select('id');
  if (error) throw error;
  requireAffected(data);
}

export function useManagedFunctions() {
  return useQuery({ queryKey: ['ministry-functions', 'manage'], queryFn: fetchMinistryFunctions });
}

function useInvalidateFunctions() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['ministry-functions'] }),
      client.invalidateQueries({ queryKey: ['members'] }),
    ]);
}

export function useAddFunction() {
  const invalidate = useInvalidateFunctions();
  return useMutation({ mutationFn: addMinistryFunction, onSuccess: invalidate });
}

export function useSetFunctionSection() {
  const invalidate = useInvalidateFunctions();
  return useMutation({ mutationFn: setFunctionSection, onSuccess: invalidate });
}

export async function renameFunction(input: { id: number; name: string }): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error('Informe o nome da função.');
  const { data, error } = await supabase
    .from('ministry_functions')
    .update({ name })
    .eq('id', input.id)
    .select('id');
  if (error) throw error;
  requireAffected(data);
}

export async function setFunctionActive(input: { id: number; active: boolean }): Promise<void> {
  const { data, error } = await supabase
    .from('ministry_functions')
    .update({ active: input.active })
    .eq('id', input.id)
    .select('id');
  if (error) throw error;
  requireAffected(data);
}

export async function moveFunction(input: { id: number; delta: -1 | 1 }): Promise<void> {
  const { error } = await supabase.rpc('move_ministry_function', {
    p_id: input.id,
    p_delta: input.delta,
  });
  if (error) throw error;
}

export async function deleteFunction(id: number): Promise<void> {
  const { error } = await supabase.rpc('delete_ministry_function', { p_id: id });
  if (error) throw error;
}

export function useRenameFunction() {
  const invalidate = useInvalidateFunctions();
  return useMutation({ mutationFn: renameFunction, onSuccess: invalidate });
}

export function useSetFunctionActive() {
  const invalidate = useInvalidateFunctions();
  return useMutation({ mutationFn: setFunctionActive, onSuccess: invalidate });
}

export function useMoveFunction() {
  const invalidate = useInvalidateFunctions();
  return useMutation({ mutationFn: moveFunction, onSuccess: invalidate });
}

export function useDeleteFunction() {
  const invalidate = useInvalidateFunctions();
  return useMutation({ mutationFn: deleteFunction, onSuccess: invalidate });
}
