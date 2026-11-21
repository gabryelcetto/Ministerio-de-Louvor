import type { EventRow } from '@/types/app.types';

/** Campos do evento usados nas listas. */
export type EventSummary = Pick<
  EventRow,
  'id' | 'type' | 'title' | 'starts_at' | 'ends_at' | 'location' | 'status'
>;

export interface FunctionRef {
  id?: number;
  name: string;
  sort_order: number;
}

/** Uma linha de event_assignments do usuário logado, com evento e função. */
export interface MyAssignmentRow {
  id: string;
  notes: string | null;
  event: EventSummary | null;
  function: FunctionRef | null;
}

/** Um evento em "Minhas escalas": a pessoa pode ter mais de uma função no mesmo evento. */
export interface MyScheduleItem {
  event: EventSummary;
  functions: string[];
  notes: string[];
}

/** Junta as atribuições por evento e ordena as funções pela ordem do ministério. */
export function groupAssignmentsByEvent(rows: readonly MyAssignmentRow[]): MyScheduleItem[] {
  const byEvent = new Map<string, { event: EventSummary; fns: FunctionRef[]; notes: string[] }>();
  for (const row of rows) {
    if (!row.event) continue;
    const entry = byEvent.get(row.event.id) ?? { event: row.event, fns: [], notes: [] };
    if (row.function) entry.fns.push(row.function);
    if (row.notes?.trim()) entry.notes.push(row.notes.trim());
    byEvent.set(row.event.id, entry);
  }
  return [...byEvent.values()].map(({ event, fns, notes }) => ({
    event,
    functions: [...fns].sort(byFunctionOrder).map((f) => f.name),
    notes,
  }));
}

/** Próximas (mais perto primeiro) e anteriores (mais recente primeiro). */
export function splitByTime<T extends { event: Pick<EventRow, 'starts_at' | 'ends_at'> }>(
  items: readonly T[],
  now: Date = new Date(),
): { upcoming: T[]; past: T[] } {
  const nowMs = now.getTime();
  // Um evento em andamento ainda é "próximo": vale o término (ou o início, se não houver término).
  const isPast = (item: T) => Date.parse(item.event.ends_at ?? item.event.starts_at) < nowMs;
  const start = (item: T) => Date.parse(item.event.starts_at);
  return {
    upcoming: items.filter((i) => !isPast(i)).sort((a, b) => start(a) - start(b)),
    past: items.filter(isPast).sort((a, b) => start(b) - start(a)),
  };
}

export interface TeamMember {
  assignmentId: string;
  userId: string;
  name: string;
  notes: string | null;
}

export interface TeamGroup {
  function: string;
  members: TeamMember[];
}

export interface TeamAssignmentRow {
  id: string;
  notes: string | null;
  profile: { id: string; full_name: string; display_name: string | null } | null;
  function: FunctionRef | null;
}

export function displayName(profile: { full_name: string; display_name: string | null }): string {
  return profile.display_name?.trim() || profile.full_name.trim() || 'Sem nome';
}

/** Equipe do evento agrupada por função (ordem do ministério), nomes em ordem alfabética. */
export function groupTeamByFunction(rows: readonly TeamAssignmentRow[]): TeamGroup[] {
  const groups = new Map<string, { fn: FunctionRef; members: TeamMember[] }>();
  for (const row of rows) {
    const fn = row.function ?? { name: 'Sem função', sort_order: Number.MAX_SAFE_INTEGER };
    const group = groups.get(fn.name) ?? { fn, members: [] };
    group.members.push({
      assignmentId: row.id,
      userId: row.profile?.id ?? '',
      name: row.profile ? displayName(row.profile) : 'Integrante',
      notes: row.notes?.trim() || null,
    });
    groups.set(fn.name, group);
  }
  return [...groups.values()]
    .sort((a, b) => byFunctionOrder(a.fn, b.fn))
    .map(({ fn, members }) => ({
      function: fn.name,
      members: members.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    }));
}

function byFunctionOrder(a: FunctionRef, b: FunctionRef): number {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'pt-BR');
}

/** Mesma regra do get_dashboard(): tom do dia > tom oficial > tom original. */
export function resolveEventKey(
  keyForEvent: string | null,
  song: { official_key: string | null; original_key: string | null } | null,
): string | null {
  return keyForEvent?.trim() || song?.official_key?.trim() || song?.original_key?.trim() || null;
}

/** De onde veio o tom mostrado (para explicar ao músico). */
export function keySource(
  keyForEvent: string | null,
  song: { official_key: string | null; original_key: string | null } | null,
): 'event' | 'official' | 'original' | null {
  if (keyForEvent?.trim()) return 'event';
  if (song?.official_key?.trim()) return 'official';
  if (song?.original_key?.trim()) return 'original';
  return null;
}

/** Endereço da música já no tom do dia (e com o evento, para o subtítulo "Culto em A"). */
export function songInEventHref(songId: string, key: string | null, eventId?: string): string {
  const params = new URLSearchParams();
  if (key) params.set('tom', key);
  if (eventId) params.set('evento', eventId);
  const query = params.toString();
  return `/repertorio/${songId}${query ? `?${query}` : ''}`;
}
