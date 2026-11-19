import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/session-context';
import { supabase } from '@/lib/supabase';
import type { Dashboard, Json } from '@/types/database.types';

const EMPTY: Dashboard = {
  next_service: null,
  next_rehearsal: null,
  my_assignments: [],
  next_service_songs: [],
  recent_announcements: [],
  unread_notifications: 0,
};

/**
 * get_dashboard() devolve `jsonb`. Aqui garantimos o formato de `Dashboard`
 * (listas nunca nulas, contador numérico) para a tela não precisar se defender.
 */
export function parseDashboard(raw: Json | null): Dashboard {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return EMPTY;
  const value = raw as Partial<Record<keyof Dashboard, unknown>>;
  const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const unread = Number(value.unread_notifications ?? 0);
  return {
    next_service: (value.next_service as Dashboard['next_service']) ?? null,
    next_rehearsal: (value.next_rehearsal as Dashboard['next_rehearsal']) ?? null,
    my_assignments: list(value.my_assignments),
    next_service_songs: list<Dashboard['next_service_songs'][number]>(
      value.next_service_songs,
    ).sort((a, b) => a.position - b.position),
    recent_announcements: list(value.recent_announcements),
    unread_notifications: Number.isFinite(unread) && unread > 0 ? unread : 0,
  };
}

export async function fetchDashboard(): Promise<Dashboard> {
  const { data, error } = await supabase.rpc('get_dashboard');
  if (error) throw error;
  return parseDashboard(data);
}

export function useDashboard() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['dashboard', userId],
    queryFn: fetchDashboard,
    enabled: Boolean(userId),
  });
}

export interface DashboardScheduleItem {
  eventId: string;
  title: string;
  type: Dashboard['my_assignments'][number]['event_type'];
  startsAt: string;
  location: string | null;
  functions: string[];
}

/** Uma linha por evento (a pessoa pode ter mais de uma função no mesmo culto). */
export function groupDashboardAssignments(
  assignments: Dashboard['my_assignments'],
): DashboardScheduleItem[] {
  const byEvent = new Map<string, DashboardScheduleItem>();
  for (const a of assignments) {
    const item = byEvent.get(a.event_id) ?? {
      eventId: a.event_id,
      title: a.event_title,
      type: a.event_type,
      startsAt: a.starts_at,
      location: a.location,
      functions: [],
    };
    if (!item.functions.includes(a.function)) item.functions.push(a.function);
    byEvent.set(a.event_id, item);
  }
  return [...byEvent.values()].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}
