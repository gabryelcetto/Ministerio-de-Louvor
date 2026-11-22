import type { AssignmentResponse, EventRow } from '@/types/app.types';
import { combinedResponse } from './presence';

/** Campos do evento usados nas listas. */
export type EventSummary = Pick<
  EventRow,
  'id' | 'type' | 'title' | 'starts_at' | 'ends_at' | 'location' | 'status'
>;

export interface FunctionRef {
  id?: number;
  name: string;
  sort_order: number;
  /** Grupo da função (cantores/instrumentistas), quando a consulta traz. */
  section?: string;
}

/** Uma linha de event_assignments do usuário logado, com evento e função. */
export interface MyAssignmentRow {
  id: string;
  notes: string | null;
  event: EventSummary | null;
  function: FunctionRef | null;
  response?: AssignmentResponse;
}

/** Um evento em "Minhas escalas": a pessoa pode ter mais de uma função no mesmo evento. */
export interface MyScheduleItem {
  event: EventSummary;
  functions: string[];
  notes: string[];
  /** "Confirmo" / "Não posso" (com várias funções: uma recusa pesa mais). */
  response: AssignmentResponse;
  /** As escalas da pessoa no evento (uma por função), para responder. */
  assignmentIds: string[];
}

/** Junta as atribuições por evento e ordena as funções pela ordem do ministério. */
export function groupAssignmentsByEvent(rows: readonly MyAssignmentRow[]): MyScheduleItem[] {
  const byEvent = new Map<
    string,
    {
      event: EventSummary;
      fns: FunctionRef[];
      notes: string[];
      ids: string[];
      responses: AssignmentResponse[];
    }
  >();
  for (const row of rows) {
    if (!row.event) continue;
    const entry = byEvent.get(row.event.id) ?? {
      event: row.event,
      fns: [],
      notes: [],
      ids: [],
      responses: [],
    };
    if (row.function) entry.fns.push(row.function);
    if (row.notes?.trim()) entry.notes.push(row.notes.trim());
    entry.ids.push(row.id);
    entry.responses.push(row.response ?? 'pending');
    byEvent.set(row.event.id, entry);
  }
  return [...byEvent.values()].map(({ event, fns, notes, ids, responses }) => ({
    event,
    functions: [...fns].sort(byFunctionOrder).map((f) => f.name),
    notes,
    response: combinedResponse(responses),
    assignmentIds: ids,
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
  /** Resposta da pessoa (Fase H). Ausente = "pending". */
  response?: AssignmentResponse;
  response_note?: string | null;
  suggested_user_id?: string | null;
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

/** Iniciais para o avatar: "Isa Integrante" → "II"; "Lucas" → "L". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export type TeamSection = 'vocal' | 'instrumental' | 'outros';

export const TEAM_SECTION_LABEL: Record<TeamSection, string> = {
  vocal: 'Cantores',
  instrumental: 'Instrumentistas',
  outros: 'Outras funções',
};

export interface TeamChip {
  userId: string;
  name: string;
  initials: string;
  /** Funções da pessoa neste grupo, na ordem do ministério ("Vocal · Violão"). */
  functions: string[];
  notes: string[];
  /** "Confirmo" / "Não posso" (com várias funções: uma recusa pesa mais). */
  response: AssignmentResponse;
}

export interface TeamSectionGroup {
  section: TeamSection;
  label: string;
  members: TeamChip[];
}

/**
 * Equipe do evento em "Cantores" e "Instrumentistas" (pelo grupo da função), uma ficha por
 * pessoa em cada grupo, na ordem da primeira função dela e depois do nome.
 */
export function groupTeamBySection(rows: readonly TeamAssignmentRow[]): TeamSectionGroup[] {
  const sections = new Map<
    TeamSection,
    Map<
      string,
      Omit<TeamChip, 'response'> & { order: FunctionRef; responses: AssignmentResponse[] }
    >
  >();
  const sorted = [...rows].sort((a, b) =>
    byFunctionOrder(
      a.function ?? { name: '', sort_order: Number.MAX_SAFE_INTEGER },
      b.function ?? { name: '', sort_order: Number.MAX_SAFE_INTEGER },
    ),
  );
  for (const row of sorted) {
    const section: TeamSection =
      row.function?.section === 'vocal'
        ? 'vocal'
        : row.function?.section === 'instrumental'
          ? 'instrumental'
          : 'outros';
    const people = sections.get(section) ?? new Map();
    const userId = row.profile?.id ?? row.id;
    const name = row.profile ? displayName(row.profile) : 'Integrante';
    const chip = people.get(userId) ?? {
      userId,
      name,
      initials: initials(name),
      functions: [],
      notes: [],
      responses: [] as AssignmentResponse[],
      order: row.function ?? { name: '', sort_order: Number.MAX_SAFE_INTEGER },
    };
    const fn = row.function?.name ?? 'Sem função';
    if (!chip.functions.includes(fn)) chip.functions.push(fn);
    if (row.notes?.trim()) chip.notes.push(row.notes.trim());
    chip.responses.push(row.response ?? 'pending');
    people.set(userId, chip);
    sections.set(section, people);
  }
  return (['vocal', 'instrumental', 'outros'] as const)
    .filter((section) => sections.has(section))
    .map((section) => ({
      section,
      label: TEAM_SECTION_LABEL[section],
      members: [...sections.get(section)!.values()]
        .sort((a, b) => byFunctionOrder(a.order, b.order) || a.name.localeCompare(b.name, 'pt-BR'))
        .map((chip) => ({
          userId: chip.userId,
          name: chip.name,
          initials: chip.initials,
          functions: chip.functions,
          notes: chip.notes,
          response: combinedResponse(chip.responses),
        })),
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

/**
 * Modo culto: posição da música no repertório do evento e as vizinhas (para ‹ Anterior e
 * Próxima ›). `null` quando a música não está no repertório.
 */
export function setlistPosition<T extends { songId: string }>(
  songs: readonly T[],
  songId: string,
): { index: number; total: number; prev: T | null; next: T | null } | null {
  const index = songs.findIndex((s) => s.songId === songId);
  if (index < 0) return null;
  return {
    index,
    total: songs.length,
    prev: songs[index - 1] ?? null,
    next: songs[index + 1] ?? null,
  };
}

/** Deslize na horizontal (troca de música) sem confundir com a rolagem da cifra. */
export function swipeDirection(dx: number, dy: number, threshold = 70): -1 | 1 | 0 {
  if (Math.abs(dx) < threshold || Math.abs(dy) > Math.abs(dx) / 2) return 0;
  return dx < 0 ? 1 : -1;
}
