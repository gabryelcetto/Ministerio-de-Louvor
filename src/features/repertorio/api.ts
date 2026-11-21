import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import type { ReviewStatus, SongRow } from '@/types/app.types';
import { uniqueCategories } from './song-key';

export type SongListItem = Pick<
  SongRow,
  'id' | 'title' | 'artist' | 'category' | 'original_key' | 'official_key'
>;

/** Busca sem acento (search_songs no banco) + filtro opcional por categoria. */
export async function searchSongs(query: string, category: string | null): Promise<SongListItem[]> {
  let request = supabase
    .rpc('search_songs', { q: query.trim() })
    .select('id, title, artist, category, original_key, official_key');
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
