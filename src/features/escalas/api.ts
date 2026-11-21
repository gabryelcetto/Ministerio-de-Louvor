import { supabase } from '@/services/supabase';
import {
  groupAssignmentsByEvent,
  groupTeamByFunction,
  groupTeamBySection,
  resolveEventKey,
  keySource,
  type EventSummary,
  type MyAssignmentRow,
  type MyScheduleItem,
  type TeamAssignmentRow,
  type TeamGroup,
  type TeamSectionGroup,
} from './schedule-utils';
import type { EventRow } from '@/types/app.types';

/** Quantos dias para trás "Minhas escalas" mostra em "Anteriores". */
export const PAST_DAYS = 60;

/** Escalas do usuário logado (de PAST_DAYS atrás em diante), agrupadas por evento. */
export async function fetchMySchedules(
  userId: string,
  now: Date = new Date(),
): Promise<MyScheduleItem[]> {
  const since = new Date(now.getTime() - PAST_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('event_assignments')
    // Strings de select precisam ser literais únicos (sem `${}` ou `+`) para o supabase-js inferir o tipo.
    .select(
      'id, notes, event:events!inner(id, type, title, starts_at, ends_at, location, status), function:ministry_functions(name, sort_order)',
    )
    .eq('user_id', userId)
    .gte('event.starts_at', since);
  if (error) throw error;
  return groupAssignmentsByEvent(data satisfies MyAssignmentRow[]);
}

export interface EventSongItem {
  id: string;
  position: number;
  notes: string | null;
  songId: string;
  title: string;
  artist: string | null;
  /** Tom do dia já resolvido (tom do evento > oficial > original). */
  key: string | null;
  keySource: ReturnType<typeof keySource>;
}

export interface EventDetail {
  event: EventSummary & Pick<EventRow, 'notes'>;
  team: TeamGroup[];
  /** Equipe em Cantores e Instrumentistas (tela do evento). */
  teamBySection: TeamSectionGroup[];
  songs: EventSongItem[];
}

/** Evento com equipe (por função) e repertório (na ordem). `null` se não existir/sem acesso. */
export async function fetchEventDetail(eventId: string): Promise<EventDetail | null> {
  const { data, error } = await supabase
    .from('events')
    .select(
      'id, type, title, starts_at, ends_at, location, status, notes, event_assignments(id, notes, profile:profiles(id, full_name, display_name), function:ministry_functions(id, name, sort_order, section)), event_songs(id, position, key_for_event, notes, song:songs(id, title, artist, official_key, original_key))',
    )
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { event_assignments, event_songs, ...event } = data;

  const songs = [...event_songs]
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      id: row.id,
      position: row.position,
      notes: row.notes?.trim() || null,
      songId: row.song?.id ?? '',
      title: row.song?.title ?? 'Música indisponível',
      artist: row.song?.artist ?? null,
      key: resolveEventKey(row.key_for_event, row.song),
      keySource: keySource(row.key_for_event, row.song),
    }));

  return {
    event,
    team: groupTeamByFunction(event_assignments satisfies TeamAssignmentRow[]),
    teamBySection: groupTeamBySection(event_assignments satisfies TeamAssignmentRow[]),
    songs,
  };
}

export interface ScheduleOverview {
  event: EventSummary;
  teamCount: number;
  songCount: number;
}

/**
 * "Todas" as escalas (quem monta escala): próximas (do mais perto ao mais longe) ou anteriores
 * (dos últimos PAST_DAYS dias, do mais recente), com o tamanho da equipe e do repertório.
 */
export async function fetchAllSchedules(
  period: 'proximas' | 'anteriores',
  now: Date = new Date(),
): Promise<ScheduleOverview[]> {
  const nowIso = now.toISOString();
  const since = new Date(now.getTime() - PAST_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const base = supabase
    .from('events')
    .select(
      'id, type, title, starts_at, ends_at, location, status, event_assignments(id), event_songs(id)',
    );
  const { data, error } =
    period === 'proximas'
      ? await base.gte('starts_at', nowIso).order('starts_at').limit(60)
      : await base
          .lt('starts_at', nowIso)
          .gte('starts_at', since)
          .order('starts_at', { ascending: false })
          .limit(60);
  if (error) throw error;
  return data.map(({ event_assignments, event_songs, ...event }) => ({
    event,
    teamCount: event_assignments.length,
    songCount: event_songs.length,
  }));
}
