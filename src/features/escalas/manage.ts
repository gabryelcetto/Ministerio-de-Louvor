import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { requireAffected } from '@/lib/errors';
import { zonedLocalToIso } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import type { EventType } from '@/types/app.types';
import { displayName } from './schedule-utils';

/**
 * Montar escala (fase F). Banco: criar evento exige events.manage; incluir/remover pessoas
 * exige schedules.manage. Os triggers avisam cada pessoa (notificação) ao entrar/sair.
 */

export interface EventDraft {
  type: EventType;
  title: string;
  /** Valor de <input type="datetime-local">, no horário de São Paulo. */
  startsAt: string;
  endsAt: string;
  location: string;
  notes: string;
}

export interface AssignmentDraft {
  /** Chave local da linha no formulário. */
  key: string;
  userId: string;
  functionId: number | null;
  notes: string;
}

export interface ExistingAssignment {
  id: string;
  userId: string;
  functionId: number;
}

export interface SchedulingEvent {
  id: string;
  type: EventType;
  title: string;
  startsAt: string;
  status: 'scheduled' | 'cancelled';
  assignments: (ExistingAssignment & { notes: string | null })[];
}

export interface SchedulingMember {
  id: string;
  name: string;
  functionIds: number[];
}

export interface SchedulingData {
  events: SchedulingEvent[];
  members: SchedulingMember[];
  /** section: vocal/instrumental (filtro da montagem; não é permissão). */
  functions: { id: number; name: string; section: string }[];
}

export type DraftErrors = Partial<Record<'title' | 'startsAt' | 'endsAt', string>>;

/** Validação do evento novo (o banco também confere: título obrigatório, término ≥ início). */
export function validateEventDraft(draft: EventDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.title.trim()) errors.title = 'Informe o título.';
  const starts = zonedLocalToIso(draft.startsAt);
  if (!starts) errors.startsAt = 'Informe data e hora de início.';
  if (draft.endsAt.trim()) {
    const ends = zonedLocalToIso(draft.endsAt);
    if (!ends) errors.endsAt = 'Data de término inválida.';
    else if (starts && Date.parse(ends) < Date.parse(starts)) {
      errors.endsAt = 'O término precisa ser depois do início.';
    }
  }
  return errors;
}

/**
 * Linhas prontas para gravar: ignora linhas incompletas, repetidas e as que já estão na escala
 * (o banco recusaria pela unique (evento, pessoa, função)).
 */
export function assignmentsToInsert(
  eventId: string,
  drafts: readonly AssignmentDraft[],
  existing: readonly ExistingAssignment[],
): { event_id: string; user_id: string; function_id: number; notes: string | null }[] {
  const seen = new Set(existing.map((a) => `${a.userId}:${a.functionId}`));
  const rows = [];
  for (const d of drafts) {
    if (!d.userId || d.functionId === null) continue;
    const key = `${d.userId}:${d.functionId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      event_id: eventId,
      user_id: d.userId,
      function_id: d.functionId,
      notes: d.notes.trim() || null,
    });
  }
  return rows;
}

/** Linhas do formulário que não serão gravadas (incompletas ou duplicadas), para avisar. */
export function draftProblems(
  drafts: readonly AssignmentDraft[],
  existing: readonly ExistingAssignment[],
): Record<string, string> {
  const problems: Record<string, string> = {};
  const seen = new Set(existing.map((a) => `${a.userId}:${a.functionId}`));
  for (const d of drafts) {
    if (!d.userId && d.functionId === null) continue; // linha vazia: só ignora
    if (!d.userId) problems[d.key] = 'Escolha a pessoa.';
    else if (d.functionId === null) problems[d.key] = 'Escolha a função.';
    else {
      const key = `${d.userId}:${d.functionId}`;
      if (seen.has(key)) problems[d.key] = 'Essa pessoa já está nessa função.';
      seen.add(key);
    }
  }
  return problems;
}

/** Funções da pessoa primeiro (as que ela costuma fazer), depois as demais. */
export function functionOptions(
  functions: readonly { id: number; name: string }[],
  member: SchedulingMember | undefined,
): { own: { id: number; name: string }[]; others: { id: number; name: string }[] } {
  const own = new Set(member?.functionIds ?? []);
  return {
    own: functions.filter((f) => own.has(f.id)),
    others: functions.filter((f) => !own.has(f.id)),
  };
}

export async function fetchSchedulingData(now: Date = new Date()): Promise<SchedulingData> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const [events, members, functions] = await Promise.all([
    supabase
      .from('events')
      .select(
        'id, type, title, starts_at, status, event_assignments(id, user_id, function_id, notes)',
      )
      .gte('starts_at', since)
      .order('starts_at')
      .limit(60),
    supabase
      .from('profiles')
      .select('id, full_name, display_name, member_functions(function_id)')
      .eq('status', 'active'),
    supabase.from('ministry_functions').select('id, name, sort_order, section').order('sort_order'),
  ]);
  if (events.error) throw events.error;
  if (members.error) throw members.error;
  if (functions.error) throw functions.error;

  return {
    events: events.data.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      startsAt: e.starts_at,
      status: e.status,
      assignments: e.event_assignments.map((a) => ({
        id: a.id,
        userId: a.user_id,
        functionId: a.function_id,
        notes: a.notes,
      })),
    })),
    members: members.data
      .map((m) => ({
        id: m.id,
        name: displayName(m),
        functionIds: m.member_functions.map((mf) => mf.function_id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    functions: functions.data.map(({ id, name, section }) => ({ id, name, section })),
  };
}

export async function createEvent(draft: EventDraft): Promise<string> {
  const startsAt = zonedLocalToIso(draft.startsAt);
  if (!startsAt) throw new Error('Data de início inválida.');
  const { data, error } = await supabase
    .from('events')
    .insert({
      type: draft.type,
      title: draft.title.trim(),
      starts_at: startsAt,
      ends_at: draft.endsAt.trim() ? zonedLocalToIso(draft.endsAt) : null,
      location: draft.location.trim() || null,
      notes: draft.notes.trim() || null,
    })
    .select('id');
  if (error) throw error;
  const [row] = requireAffected(data);
  return row!.id;
}

export async function addAssignments(
  rows: ReturnType<typeof assignmentsToInsert>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const { data, error } = await supabase.from('event_assignments').insert(rows).select('id');
  if (error) throw error;
  return requireAffected(data).length;
}

export async function removeAssignment(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('event_assignments')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw error;
  requireAffected(data);
}

/** Escala mudou: agenda, detalhes, "minhas escalas", painel e notificações (os triggers geram). */
export async function invalidateSchedules(client: QueryClient): Promise<void> {
  await Promise.all(
    [['events'], ['schedules'], ['dashboard'], ['notifications']].map((queryKey) =>
      client.invalidateQueries({ queryKey }),
    ),
  );
}

export function useSchedulingData() {
  return useQuery({ queryKey: ['events', 'scheduling'], queryFn: () => fetchSchedulingData() });
}

export function useRemoveAssignment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: removeAssignment,
    onSuccess: () => invalidateSchedules(client),
  });
}
