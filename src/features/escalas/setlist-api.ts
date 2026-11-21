import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { invalidateSchedules } from './manage';
import { toRpcItems, type SetlistItem } from './setlist';

/** Repertório salvo do evento, no formato do editor. */
export async function fetchSetlist(eventId: string): Promise<SetlistItem[]> {
  const { data, error } = await supabase
    .from('event_songs')
    .select(
      'position, key_for_event, notes, song:songs(id, title, artist, official_key, original_key)',
    )
    .eq('event_id', eventId)
    .order('position');
  if (error) throw error;
  return data
    .filter((row) => row.song)
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      songId: row.song!.id,
      title: row.song!.title,
      artist: row.song!.artist,
      defaultKey: row.song!.official_key ?? row.song!.original_key,
      key: row.key_for_event ?? '',
      notes: row.notes ?? '',
    }));
}

export interface SongOption {
  id: string;
  title: string;
  artist: string | null;
  officialKey: string | null;
  originalKey: string | null;
}

/** Busca no repertório (sem acento; arquivadas ficam de fora). */
export async function searchSongOptions(query: string): Promise<SongOption[]> {
  const { data, error } = await supabase.rpc('search_songs', { q: query.trim() });
  if (error) throw error;
  return data
    .filter((s) => !s.archived_at)
    .slice(0, 20)
    .map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      officialKey: s.official_key,
      originalKey: s.original_key,
    }));
}

export async function saveSetlist(eventId: string, items: readonly SetlistItem[]): Promise<number> {
  const { data, error } = await supabase.rpc('set_event_songs', {
    p_event_id: eventId,
    p_items: toRpcItems(items),
  });
  if (error) throw error;
  return data;
}

export function useSetlist(eventId: string) {
  return useQuery({
    queryKey: ['events', 'setlist', eventId],
    queryFn: () => fetchSetlist(eventId),
  });
}

export function useSongSearch(query: string) {
  return useQuery({
    queryKey: ['songs', 'picker', query.trim()],
    queryFn: () => searchSongOptions(query),
  });
}

export function useSaveSetlist(eventId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (items: readonly SetlistItem[]) => saveSetlist(eventId, items),
    onSuccess: () => invalidateSchedules(client),
  });
}
