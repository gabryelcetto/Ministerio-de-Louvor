import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { displayName } from '@/features/escalas/schedule-utils';
import { requireAffected } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { ChangeType, VersionField } from '@/types/app.types';

/**
 * Edição de música (fase F). Quem decide se pode é o banco (RLS + triggers); a interface só
 * esconde botões. Toda escrita pede `.select()` + `requireAffected()`: um UPDATE barrado pelo
 * RLS não dá erro, só afeta 0 linhas.
 */

/** Letra: qualquer integrante ativo (policies de insert/update de song_lyrics). */
export async function saveLyrics(songId: string, content: string): Promise<void> {
  const { data, error } = await supabase
    .from('song_lyrics')
    .upsert({ song_id: songId, content }, { onConflict: 'song_id' })
    .select('song_id');
  if (error) throw error;
  requireAffected(data);
}

/**
 * Cifra: só com chords.edit_official (policy de UPDATE). Quem edita a oficial também aprova:
 * a cifra volta a `official`. Se ainda não existia cifra, o INSERT é permitido a qualquer
 * ativo, mas o trigger a marca `pending` quando falta a permissão.
 */
export async function saveChords(songId: string, content: string): Promise<void> {
  const { data, error } = await supabase
    .from('song_chords')
    .upsert({ song_id: songId, content, review_status: 'official' }, { onConflict: 'song_id' })
    .select('song_id');
  if (error) throw error;
  requireAffected(data);
}

/** Tom oficial: só com songs.set_official_key (o trigger recusa com 42501). `null` limpa. */
export async function setOfficialKey(songId: string, key: string | null): Promise<void> {
  const { data, error } = await supabase
    .from('songs')
    .update({ official_key: key })
    .eq('id', songId)
    .select('id');
  if (error) throw error;
  requireAffected(data);
}

export interface SongVersion {
  id: string;
  field: VersionField;
  changeType: ChangeType;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  author: string | null;
  /** A versão mais recente de cada campo é o conteúdo atual (restaurar não mudaria nada). */
  isCurrent: boolean;
}

export const VERSIONS_LIMIT = 100;

/** Marca como "atual" a primeira versão de cada campo numa lista do mais recente ao mais antigo. */
export function markCurrent<T extends { field: VersionField }>(
  versions: readonly T[],
): (T & { isCurrent: boolean })[] {
  const seen = new Set<VersionField>();
  return versions.map((v) => {
    const isCurrent = !seen.has(v.field);
    seen.add(v.field);
    return { ...v, isCurrent };
  });
}

export async function fetchVersions(songId: string): Promise<SongVersion[]> {
  const { data, error } = await supabase
    .from('song_versions')
    .select(
      'id, field, change_type, old_value, new_value, changed_at, author:profiles(full_name, display_name)',
    )
    .eq('song_id', songId)
    .order('changed_at', { ascending: false })
    .limit(VERSIONS_LIMIT);
  if (error) throw error;
  return markCurrent(
    data.map((v) => ({
      id: v.id,
      field: v.field,
      changeType: v.change_type,
      oldValue: v.old_value,
      newValue: v.new_value,
      changedAt: v.changed_at,
      author: v.author ? displayName(v.author) : null,
    })),
  );
}

/** Só com history.restore (a função confere e responde 42501). Grava uma NOVA versão "restore". */
export async function restoreVersion(versionId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_song_version', { version_id: versionId });
  if (error) throw error;
}

export const songKeys = {
  detail: (songId: string) => ['songs', 'detail', songId] as const,
  versions: (songId: string) => ['songs', 'versions', songId] as const,
};

/**
 * O que precisa recarregar depois de cada tipo de alteração:
 * - letra/cifra: a música e o histórico;
 * - tom oficial e restauração (pode mexer em tom, título…): também a lista do repertório, o
 *   painel e o detalhe dos eventos, que mostram o tom resolvido (tom do dia > oficial > original).
 */
export async function invalidateAfterSave(
  client: QueryClient,
  songId: string,
  scope: 'content' | 'song',
): Promise<void> {
  const keys: (readonly unknown[])[] = [songKeys.detail(songId), songKeys.versions(songId)];
  if (scope === 'song') keys.push(['songs', 'search'], ['dashboard'], ['events', 'detail']);
  await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
}

export function useSongVersions(songId: string | undefined) {
  return useQuery({
    queryKey: songKeys.versions(songId ?? ''),
    queryFn: () => fetchVersions(songId as string),
    enabled: Boolean(songId),
  });
}

export function useSaveLyrics(songId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => saveLyrics(songId, content),
    onSuccess: () => invalidateAfterSave(client, songId, 'content'),
  });
}

export function useSaveChords(songId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => saveChords(songId, content),
    onSuccess: () => invalidateAfterSave(client, songId, 'content'),
  });
}

export function useSetOfficialKey(songId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (key: string | null) => setOfficialKey(songId, key),
    onSuccess: () => invalidateAfterSave(client, songId, 'song'),
  });
}

export function useRestoreVersion(songId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: restoreVersion,
    onSuccess: () => invalidateAfterSave(client, songId, 'song'),
  });
}
