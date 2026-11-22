import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { normalizeSearch } from '@/lib/text';
import { supabase } from '@/services/supabase';
import type { Json, ReviewStatus, SongRow } from '@/types/app.types';
import type { SongStat } from './song-list';
import { uniqueCategories } from './song-key';

export type SongListItem = Pick<
  SongRow,
  'id' | 'title' | 'artist' | 'category' | 'original_key' | 'official_key' | 'created_at'
>;

/** Busca sem acento (search_songs no banco) + filtro opcional por categoria. */
export async function searchSongs(query: string, category: string | null): Promise<SongListItem[]> {
  let request = supabase
    .rpc('search_songs', { q: query.trim() })
    .select('id, title, artist, category, original_key, official_key, created_at');
  if (category) request = request.eq('category', category);
  const { data, error } = await request;
  if (error) throw error;
  return data;
}

/** Categorias usadas pelas músicas ativas (para os filtros). */
export async function fetchCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('songs')
    .select('category')
    .is('archived_at', null)
    .not('category', 'is', null);
  if (error) throw error;
  return uniqueCategories(data.map((row) => row.category));
}

export interface SongDetail extends SongRow {
  lyrics: string | null;
  chords: string | null;
  chordsStatus: ReviewStatus | null;
}

/** Música com letra e cifra. `null` se não existir ou não for visível. */
export async function fetchSong(songId: string): Promise<SongDetail | null> {
  const { data, error } = await supabase
    .from('songs')
    .select(
      'id, title, artist, category, original_key, official_key, media_url, notes, created_by, archived_at, created_at, updated_at, song_lyrics(content), song_chords(content, review_status)',
    )
    .eq('id', songId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { song_lyrics, song_chords, ...song } = data;
  return {
    ...song,
    lyrics: song_lyrics?.content.trim() ? song_lyrics.content : null,
    chords: song_chords?.content.trim() ? song_chords.content : null,
    chordsStatus: song_chords?.review_status ?? null,
  };
}

export function useSongSearch(query: string, category: string | null) {
  return useQuery({
    queryKey: ['songs', 'search', query.trim(), category],
    queryFn: () => searchSongs(query, category),
    // Mantém a lista anterior enquanto a nova busca chega (sem "piscar" ao digitar).
    placeholderData: keepPreviousData,
  });
}

export function useSongCategories() {
  return useQuery({
    queryKey: ['songs', 'categories'],
    queryFn: fetchCategories,
    staleTime: 10 * 60_000,
  });
}

export function useSong(songId: string | undefined) {
  return useQuery({
    queryKey: ['songs', 'detail', songId],
    queryFn: () => fetchSong(songId as string),
    enabled: Boolean(songId),
  });
}

/** Músicas que têm áudio de referência (ícone de fone na lista do repertório). */
export async function fetchSongsWithAudio(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('media_files')
    .select('song_id')
    .eq('kind', 'reference');
  if (error) throw error;
  return new Set(data.map((row) => row.song_id).filter((id): id is string => Boolean(id)));
}

export function useSongsWithAudio() {
  return useQuery({
    queryKey: ['media', 'songs-with-audio'],
    queryFn: fetchSongsWithAudio,
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------------------------
// Fase G (item 8): contagens, "Tocada em", favoritas e arquivadas.
// ---------------------------------------------------------------------------------------------

/** Quantas vezes cada música foi tocada e quando (contado no banco: get_song_stats). */
export async function fetchSongStats(): Promise<Map<string, SongStat>> {
  const { data, error } = await supabase.rpc('get_song_stats');
  if (error) throw error;
  return new Map(
    data.map((r) => [r.song_id, { playCount: r.play_count, lastPlayedAt: r.last_played_at }]),
  );
}

export interface SongPlays {
  total: number;
  recent: { id: string; title: string; starts_at: string; key: string | null }[];
}

export function parseSongPlays(raw: Json | null): SongPlays {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { total: 0, recent: [] };
  const value = raw as { total?: unknown; recent?: unknown };
  return {
    total: Number(value.total) || 0,
    recent: Array.isArray(value.recent) ? (value.recent as SongPlays['recent']) : [],
  };
}

export async function fetchSongPlays(songId: string): Promise<SongPlays> {
  const { data, error } = await supabase.rpc('get_song_plays', { p_song_id: songId });
  if (error) throw error;
  return parseSongPlays(data);
}

/** Favoritas da pessoa logada (o RLS devolve só as próprias). */
export async function fetchFavorites(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('song_favorites')
    .select('song_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set(data.map((r) => r.song_id));
}

export async function setFavorite(input: { songId: string; userId: string; on: boolean }) {
  if (input.on) {
    const { error } = await supabase
      .from('song_favorites')
      .upsert({ song_id: input.songId, user_id: input.userId }, { ignoreDuplicates: true });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('song_favorites')
      .delete()
      .eq('song_id', input.songId)
      .eq('user_id', input.userId);
    if (error) throw error;
  }
}

/** Músicas arquivadas (só quem pode arquivar vê o chip "Arquivadas"). */
export async function fetchArchivedSongs(query: string): Promise<SongListItem[]> {
  const { data, error } = await supabase
    .from('songs')
    .select('id, title, artist, category, original_key, official_key, created_at')
    .not('archived_at', 'is', null)
    .order('title');
  if (error) throw error;
  const q = normalizeSearch(query);
  return q ? data.filter((s) => normalizeSearch(`${s.title} ${s.artist ?? ''}`).includes(q)) : data;
}

export function useSongStats() {
  return useQuery({ queryKey: ['songs', 'stats'], queryFn: fetchSongStats, staleTime: 5 * 60_000 });
}

export function useSongPlays(songId: string) {
  return useQuery({ queryKey: ['songs', 'plays', songId], queryFn: () => fetchSongPlays(songId) });
}

export function useFavorites() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['songs', 'favorites', userId],
    queryFn: () => fetchFavorites(userId as string),
    enabled: Boolean(userId),
  });
}

export function useToggleFavorite() {
  const { session } = useSession();
  const client = useQueryClient();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: ({ songId, on }: { songId: string; on: boolean }) =>
      setFavorite({ songId, on, userId: userId as string }),
    // Estrela muda na hora; se o banco recusar, volta como estava.
    onMutate: async ({ songId, on }) => {
      const key = ['songs', 'favorites', userId];
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Set<string>>(key);
      const next = new Set(previous ?? []);
      if (on) next.add(songId);
      else next.delete(songId);
      client.setQueryData(key, next);
      return { previous };
    },
    onError: (_error, _vars, context) => {
      client.setQueryData(['songs', 'favorites', userId], context?.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['songs', 'favorites', userId] }),
  });
}

export function useArchivedSongs(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ['songs', 'archived', query.trim()],
    queryFn: () => fetchArchivedSongs(query),
    enabled,
  });
}
