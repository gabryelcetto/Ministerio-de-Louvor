import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { monthRange } from '@/lib/dates';
import { supabase } from '@/services/supabase';
import type { EventSummary } from '@/features/escalas';

export interface AgendaItem extends EventSummary {
  /** O usuário logado está escalado neste evento? */
  scheduled: boolean;
}

/** Eventos de um mês ("2026-11"), no fuso da igreja — inclusive meses que já passaram. */
export async function fetchAgendaMonth(userId: string, month: string): Promise<AgendaItem[]> {
  const { from, to } = monthRange(month);
  const { data, error } = await supabase
    .from('events')
    .select('id, type, title, starts_at, ends_at, location, status, event_assignments(user_id)')
    .gte('starts_at', from)
    .lt('starts_at', to)
    .order('starts_at');
  if (error) throw error;
  return data.map(({ event_assignments, ...event }) => ({
    ...event,
    scheduled: event_assignments.some((a) => a.user_id === userId),
  }));
}

/** Já passou? (o término, ou o início quando não há término) */
export function isPastEvent(event: Pick<EventSummary, 'starts_at' | 'ends_at'>, now = new Date()) {
  return Date.parse(event.ends_at ?? event.starts_at) < now.getTime();
}

export function useAgendaMonth(month: string) {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['events', 'agenda', userId, month],
    queryFn: () => fetchAgendaMonth(userId as string, month),
    enabled: Boolean(userId),
    // Ao trocar de mês, mantém o anterior na tela até o novo chegar.
    placeholderData: keepPreviousData,
  });
}
