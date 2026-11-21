import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { dayKey } from '@/lib/dates';
import { supabase } from '@/services/supabase';
import type { EventSummary } from '@/features/escalas';

/** Quantos dias à frente a agenda mostra. */
export const AGENDA_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AgendaItem extends EventSummary {
  /** O usuário logado está escalado neste evento? */
  scheduled: boolean;
}

/** Eventos de hoje (inclusive os que já passaram hoje) até AGENDA_DAYS dias à frente. */
export async function fetchAgenda(userId: string, now: Date = new Date()): Promise<AgendaItem[]> {
  // Busca desde 24h atrás e corta pelo dia no fuso da igreja (o banco não sabe o "hoje" do app).
  const from = new Date(now.getTime() - DAY_MS).toISOString();
  const to = new Date(now.getTime() + AGENDA_DAYS * DAY_MS).toISOString();

  const { data, error } = await supabase
    .from('events')
    .select('id, type, title, starts_at, ends_at, location, status, event_assignments(user_id)')
    .gte('starts_at', from)
    .lte('starts_at', to)
    .order('starts_at');
  if (error) throw error;

  const today = dayKey(now);
  return data
    .filter((e) => dayKey(e.starts_at) >= today)
    .map(({ event_assignments, ...event }) => ({
      ...event,
      scheduled: event_assignments.some((a) => a.user_id === userId),
    }));
}

export function useAgenda() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['events', 'agenda', userId],
    queryFn: () => fetchAgenda(userId as string),
    enabled: Boolean(userId),
  });
}
