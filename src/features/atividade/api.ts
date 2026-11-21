import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import type { ChangeType, VersionField } from '@/types/app.types';

/**
 * Atividade recente de todo o repertório (song_versions + audit_logs). Só com
 * history.view_all: a RPC get_recent_activity confere no banco e recusa (42501) os demais.
 */
export interface ActivityItem {
  kind: 'version' | 'audit';
  occurredAt: string;
  actorId: string | null;
  actorName: string | null;
  songId: string | null;
  songTitle: string | null;
  field: VersionField | null;
  changeType: ChangeType | null;
  action: string | null;
}

export const ACTIVITY_LIMIT = 150;

const ACTION_LABEL: Record<string, string> = {
  archive_song: 'Excluiu a música',
  unarchive_song: 'Restaurou a música',
  restore_version: 'Restaurou uma alteração',
};

const FIELD_TEXT: Record<VersionField, string> = {
  lyrics: 'a letra',
  chords: 'a cifra',
  official_key: 'o tom oficial',
  metadata: 'os dados',
};

/** Frase curta: "Editou a cifra", "Cadastrou os dados", "Restaurou uma alteração (cifra)". */
export function describeActivity(
  item: Pick<ActivityItem, 'kind' | 'field' | 'changeType' | 'action'>,
): string {
  if (item.kind === 'audit') {
    const base = (item.action && ACTION_LABEL[item.action]) || 'Alteração administrativa';
    return item.field && item.field in FIELD_TEXT
      ? `${base} (${FIELD_TEXT[item.field].replace(/^(a|o|os) /, '')})`
      : base;
  }
  const what = item.field ? FIELD_TEXT[item.field] : 'a música';
  if (item.changeType === 'create')
    return item.field === 'metadata' ? 'Cadastrou a música' : `Criou ${what}`;
  if (item.changeType === 'restore') return `Restaurou ${what}`;
  return `Editou ${what}`;
}

export async function fetchActivity(filters: {
  actorId: string | null;
  songId: string | null;
}): Promise<ActivityItem[]> {
  const { data, error } = await supabase.rpc('get_recent_activity', {
    p_actor: filters.actorId ?? undefined,
    p_song: filters.songId ?? undefined,
    p_limit: ACTIVITY_LIMIT,
  });
  if (error) throw error;
  return data.map((row) => ({
    kind: row.kind === 'audit' ? 'audit' : 'version',
    occurredAt: row.occurred_at,
    actorId: row.actor_id,
    actorName: row.actor_name,
    songId: row.song_id,
    songTitle: row.song_title,
    field: (row.field as VersionField | null) ?? null,
    changeType: (row.change_type as ChangeType | null) ?? null,
    action: row.action,
  }));
}

export function useActivity(actorId: string | null, songId: string | null) {
  return useQuery({
    queryKey: ['activity', actorId, songId],
    queryFn: () => fetchActivity({ actorId, songId }),
  });
}

async function fetchActivityFilters() {
  const [people, songs] = await Promise.all([
    supabase.from('profiles').select('id, full_name, display_name').order('full_name'),
    supabase.from('songs').select('id, title').order('title'),
  ]);
  if (people.error) throw people.error;
  if (songs.error) throw songs.error;
  return {
    people: people.data.map((p) => ({ id: p.id, name: p.display_name?.trim() || p.full_name })),
    songs: songs.data,
  };
}

export function useActivityFilters() {
  return useQuery({ queryKey: ['activity', 'filters'], queryFn: fetchActivityFilters });
}
