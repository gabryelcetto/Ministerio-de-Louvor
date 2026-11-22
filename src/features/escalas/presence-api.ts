import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requireAffected } from '@/lib/errors';
import { supabase } from '@/services/supabase';
import type { AssignmentResponse } from '@/types/app.types';
import { invalidateSchedules } from './manage';

/** Responde por todas as funções da pessoa no evento (uma chamada por escala). */
export async function respondToEvent(
  assignmentIds: readonly string[],
  response: Exclude<AssignmentResponse, 'pending'>,
  note = '',
  suggestedUserId: string | null = null,
): Promise<void> {
  for (const id of assignmentIds) {
    const { error } = await supabase.rpc('respond_assignment', {
      p_assignment_id: id,
      p_response: response,
      ...(response === 'declined' && note.trim() ? { p_note: note.trim() } : {}),
      // A sugestão vale para uma função só (a primeira).
      ...(response === 'declined' && suggestedUserId && id === assignmentIds[0]
        ? { p_suggested_user_id: suggestedUserId }
        : {}),
    });
    if (error) throw error;
  }
}

export interface Substitute {
  user_id: string;
  name: string;
}

export async function fetchSubstitutes(assignmentId: string): Promise<Substitute[]> {
  const { data, error } = await supabase.rpc('assignment_substitutes', {
    p_assignment_id: assignmentId,
  });
  if (error) throw error;
  return data;
}

export async function swapAssignment(assignmentId: string, userId: string): Promise<string> {
  const { data, error } = await supabase.rpc('swap_assignment', {
    p_assignment_id: assignmentId,
    p_user_id: userId,
  });
  if (error) throw error;
  return data;
}

export function useRespond() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      assignmentIds: string[];
      response: Exclude<AssignmentResponse, 'pending'>;
      note?: string;
      suggestedUserId?: string | null;
    }) => respondToEvent(input.assignmentIds, input.response, input.note, input.suggestedUserId),
    onSuccess: () => invalidateSchedules(client),
  });
}

export function useSubstitutes(assignmentId: string | null) {
  return useQuery({
    queryKey: ['schedules', 'substitutes', assignmentId],
    queryFn: () => fetchSubstitutes(assignmentId ?? ''),
    enabled: !!assignmentId,
  });
}

export function useSwapAssignment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { assignmentId: string; userId: string }) =>
      swapAssignment(input.assignmentId, input.userId),
    onSuccess: () => invalidateSchedules(client),
  });
}

// Indisponibilidade ----------------------------------------------------------------------------

export interface Unavailability {
  id: string;
  user_id: string;
  starts_on: string;
  ends_on: string;
  note: string | null;
}

export async function fetchMyUnavailability(userId: string): Promise<Unavailability[]> {
  const { data, error } = await supabase
    .from('member_unavailability')
    .select('id, user_id, starts_on, ends_on, note')
    .eq('user_id', userId)
    .order('starts_on');
  if (error) throw error;
  return data;
}

/** Quem está indisponível num dia (só quem monta escala enxerga os dos outros, pelo RLS). */
export async function fetchUnavailableOn(day: string): Promise<Unavailability[]> {
  const { data, error } = await supabase
    .from('member_unavailability')
    .select('id, user_id, starts_on, ends_on, note')
    .lte('starts_on', day)
    .gte('ends_on', day);
  if (error) throw error;
  return data;
}

export async function addUnavailability(input: {
  startsOn: string;
  endsOn: string;
  note: string;
}): Promise<void> {
  const { data, error } = await supabase
    .from('member_unavailability')
    .insert({
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      note: input.note.trim() || null,
    })
    .select('id');
  if (error) throw error;
  requireAffected(data);
}

export async function deleteUnavailability(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('member_unavailability')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw error;
  requireAffected(data);
}

export function useMyUnavailability(userId: string | undefined) {
  return useQuery({
    queryKey: ['unavailability', 'mine', userId],
    queryFn: () => fetchMyUnavailability(userId ?? ''),
    enabled: !!userId,
  });
}

export function useUnavailableOn(day: string | null) {
  return useQuery({
    queryKey: ['unavailability', 'day', day],
    queryFn: () => fetchUnavailableOn(day ?? ''),
    enabled: !!day,
  });
}

export function useAddUnavailability() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: addUnavailability,
    onSuccess: () => client.invalidateQueries({ queryKey: ['unavailability'] }),
  });
}

export function useDeleteUnavailability() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteUnavailability,
    onSuccess: () => client.invalidateQueries({ queryKey: ['unavailability'] }),
  });
}
