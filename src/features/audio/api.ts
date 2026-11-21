import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { displayName } from '@/features/escalas/schedule-utils';
import { readPublicEnv } from '@/lib/env';
import { requireAffected, UserFacingError } from '@/lib/errors';
import { baseMimeType } from '@/lib/audio/format';
import { uploadWithProgress } from '@/lib/audio/upload';
import { supabase } from '@/lib/supabase';

export const AUDIO_BUCKET = 'audios';
/** Validade do link de reprodução (o bucket é privado). */
const SIGNED_URL_SECONDS = 60 * 60;

export type MediaKind = 'rehearsal' | 'reference';

export interface MediaItem {
  id: string;
  kind: MediaKind;
  storagePath: string;
  mimeType: string;
  durationSeconds: number | null;
  sizeBytes: number;
  createdAt: string;
  createdBy: string | null;
  author: string | null;
  /** Link temporário para tocar (null se o Storage não gerou). */
  url: string | null;
}

const keys = {
  event: (eventId: string) => ['media', 'event', eventId] as const,
  song: (songId: string) => ['media', 'song', songId] as const,
  usage: ['media', 'usage'] as const,
};

async function fetchMedia(filter: { eventId?: string; songId?: string }): Promise<MediaItem[]> {
  let query = supabase
    .from('media_files')
    .select(
      'id, kind, storage_path, mime_type, duration_seconds, size_bytes, created_at, created_by, author:profiles(full_name, display_name)',
    )
    .order('created_at', { ascending: false });
  if (filter.eventId) query = query.eq('event_id', filter.eventId);
  if (filter.songId) query = query.eq('song_id', filter.songId);
  const { data, error } = await query;
  if (error) throw error;
  if (data.length === 0) return [];

  const { data: signed, error: signError } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrls(
      data.map((m) => m.storage_path),
      SIGNED_URL_SECONDS,
    );
  if (signError) throw signError;
  const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));

  return data.map((m) => ({
    id: m.id,
    kind: m.kind as MediaKind,
    storagePath: m.storage_path,
    mimeType: m.mime_type,
    durationSeconds: m.duration_seconds === null ? null : Number(m.duration_seconds),
    sizeBytes: Number(m.size_bytes),
    createdAt: m.created_at,
    createdBy: m.created_by,
    author: m.author ? displayName(m.author) : null,
    url: urlByPath.get(m.storage_path) ?? null,
  }));
}

export function useEventRecordings(eventId: string) {
  return useQuery({
    queryKey: keys.event(eventId),
    queryFn: () => fetchMedia({ eventId }),
    // O link assinado vale 1 h: recarrega antes de vencer.
    staleTime: 30 * 60_000,
  });
}

export function useSongReferences(songId: string) {
  return useQuery({
    queryKey: keys.song(songId),
    queryFn: () => fetchMedia({ songId }),
    staleTime: 30 * 60_000,
  });
}

export interface UploadAudioInput {
  kind: MediaKind;
  /** Evento (gravação de ensaio) ou música (referência). */
  targetId: string;
  blob: Blob;
  mimeType: string;
  extension: string;
  durationSeconds: number | null;
  onProgress?: (fraction: number) => void;
}

/**
 * Envia o arquivo (com progresso) e registra em media_files. Se o registro falhar, apaga o
 * arquivo enviado para não sobrar lixo no Storage.
 */
export async function uploadAudio(input: UploadAudioInput): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) throw new UserFacingError('Sua sessão expirou. Entre de novo.');

  const env = readPublicEnv(import.meta.env);
  const contentType = baseMimeType(input.mimeType) || 'audio/mpeg';
  const path = `${input.kind}/${input.targetId}/${crypto.randomUUID()}.${input.extension}`;

  await uploadWithProgress({
    supabaseUrl: env.supabaseUrl,
    apiKey: env.supabasePublishableKey,
    accessToken: session.access_token,
    bucket: AUDIO_BUCKET,
    path,
    file: input.blob,
    contentType,
    onProgress: input.onProgress,
  });

  const { error } = await supabase
    .from('media_files')
    .insert({
      kind: input.kind,
      event_id: input.kind === 'rehearsal' ? input.targetId : null,
      song_id: input.kind === 'reference' ? input.targetId : null,
      storage_path: path,
      mime_type: contentType,
      duration_seconds:
        input.durationSeconds === null ? null : Math.round(input.durationSeconds * 100) / 100,
      size_bytes: input.blob.size,
      created_by: session.user.id,
    })
    .select('id');
  if (error) {
    await supabase.storage.from(AUDIO_BUCKET).remove([path]);
    throw error;
  }
}

/** Apaga o arquivo (pela API do Storage) e o registro. Só o autor ou o admin conseguem. */
export async function deleteAudio(item: Pick<MediaItem, 'id' | 'storagePath'>): Promise<void> {
  const { data: removed, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .remove([item.storagePath]);
  if (error) throw error;
  if (!removed || removed.length === 0) {
    // A policy do bucket esconde o arquivo de quem não pode apagar (0 removidos, sem erro).
    throw new UserFacingError('Você só pode apagar os áudios que você enviou.');
  }
  const { data, error: rowError } = await supabase
    .from('media_files')
    .delete()
    .eq('id', item.id)
    .select('id');
  if (rowError) throw rowError;
  requireAffected(data);
}

export function useUploadAudio(kind: MediaKind, targetId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<UploadAudioInput, 'kind' | 'targetId'>) =>
      uploadAudio({ ...input, kind, targetId }),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: kind === 'rehearsal' ? keys.event(targetId) : keys.song(targetId),
      }),
  });
}

export function useDeleteAudio(kind: MediaKind, targetId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteAudio,
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({
          queryKey: kind === 'rehearsal' ? keys.event(targetId) : keys.song(targetId),
        }),
        client.invalidateQueries({ queryKey: keys.usage }),
      ]),
  });
}

export interface StorageUsage {
  totalBytes: number;
  rehearsalBytes: number;
  referenceBytes: number;
  files: number;
  limitBytes: number;
}

export async function fetchStorageUsage(): Promise<StorageUsage> {
  const { data, error } = await supabase.rpc('get_storage_usage');
  if (error) throw error;
  const v = (data ?? {}) as Record<string, unknown>;
  const n = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  return {
    totalBytes: n(v.total_bytes),
    rehearsalBytes: n(v.rehearsal_bytes),
    referenceBytes: n(v.reference_bytes),
    files: n(v.files),
    limitBytes: n(v.limit_bytes) || 1024 * 1024 * 1024,
  };
}

export function useStorageUsage(enabled: boolean) {
  return useQuery({ queryKey: keys.usage, queryFn: fetchStorageUsage, enabled });
}

/** Duração de um arquivo de áudio escolhido (null se o navegador não souber ler). */
export function readAudioDuration(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(blob);
    const finish = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? audio.duration : null);
    audio.onerror = () => finish(null);
    setTimeout(() => finish(null), 5000);
    audio.src = url;
  });
}
