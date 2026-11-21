import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { displayName } from '@/features/escalas';
import { readPublicEnv } from '@/lib/env';
import { requireAffected, UserFacingError } from '@/lib/errors';
import { baseMimeType } from '@/lib/audio/format';
import { uploadWithProgress } from '@/lib/audio/upload';
import { supabase } from '@/services/supabase';

export const AUDIO_BUCKET = 'audios';
/** Validade do link de reprodução (o bucket é privado). */
const SIGNED_URL_SECONDS = 60 * 60;

export type MediaKind = 'rehearsal' | 'reference';

/** Até 3 áudios de referência por música (o banco garante; o app avisa antes). */
export const MAX_REFERENCES_PER_SONG = 3;
/** Nome do áudio: até 60 caracteres (mesma regra do banco). */
export const LABEL_MAX = 60;
export const LABEL_SUGGESTIONS = ['Voz guia', 'Arranjo', 'Ensaio'] as const;

/** Nome digitado → valor gravado: espaços sobrando saem; vazio vira null (sem nome). */
export function normalizeLabel(value: string): string | null {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed : null;
}

/** Problema no nome digitado (null = ok). */
export function labelProblem(value: string): string | null {
  const label = normalizeLabel(value);
  return label && label.length > LABEL_MAX ? `Use até ${LABEL_MAX} caracteres.` : null;
}

/** Título mostrado na lista: o nome, ou "Gravação N" / "Áudio N" quando não tem nome. */
export function mediaTitle(kind: MediaKind, label: string | null, position: number): string {
  return label ?? `${kind === 'rehearsal' ? 'Gravação' : 'Áudio'} ${position}`;
}

export interface MediaItem {
  id: string;
  kind: MediaKind;
  storagePath: string;
  mimeType: string;
  durationSeconds: number | null;
  sizeBytes: number;
  createdAt: string;
  createdBy: string | null;
  /** Nome dado pelo autor ou admin (null = sem nome). */
  label: string | null;
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
      'id, kind, label, storage_path, mime_type, duration_seconds, size_bytes, created_at, created_by, author:profiles(full_name, display_name)',
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
    label: m.label,
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
 * O banco aceita um envio novo? (limite de 3 referências por música e de 90% do espaço).
 * Consultado ANTES de mandar o arquivo: a mensagem vem em português e a internet não é gasta.
 */
export async function checkAudioUpload(kind: MediaKind, targetId: string): Promise<void> {
  const { error } = await supabase.rpc('check_audio_upload', { p_kind: kind, p_target: targetId });
  if (error) throw error;
}

/**
 * Confere os limites, envia o arquivo (com progresso) e registra em media_files. Se o registro
 * falhar, apaga o arquivo enviado para não sobrar lixo no Storage. Devolve o id do registro.
 */
export async function uploadAudio(input: UploadAudioInput): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) throw new UserFacingError('Sua sessão expirou. Entre de novo.');
  await checkAudioUpload(input.kind, input.targetId);

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

  const { data, error } = await supabase
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
  const id = requireAffected(data)[0]?.id;
  if (!id) throw new Error('Resposta inesperada do servidor.');
  return id;
}

/** Dá (ou troca) o nome do áudio. Só o autor ou o admin conseguem (RLS + GRANT de coluna). */
export async function renameAudio(input: { id: string; label: string | null }): Promise<void> {
  const { data, error } = await supabase
    .from('media_files')
    .update({ label: input.label })
    .eq('id', input.id)
    .select('id');
  if (error) throw error;
  requireAffected(data);
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
      Promise.all([
        client.invalidateQueries({
          queryKey: kind === 'rehearsal' ? keys.event(targetId) : keys.song(targetId),
        }),
        client.invalidateQueries({ queryKey: keys.usage }),
      ]),
  });
}

export function useRenameAudio(kind: MediaKind, targetId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: renameAudio,
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
  /** A partir daqui (90% de 1 GB) o banco recusa envios novos. */
  blockBytes: number;
}

/** Nível do aviso de espaço: ok, perto (≥ 70%) ou bloqueado (≥ 90%, o banco recusa envios). */
export function storageLevel(
  usage: Pick<StorageUsage, 'totalBytes' | 'blockBytes' | 'limitBytes'>,
): 'ok' | 'warn' | 'blocked' {
  if (usage.totalBytes >= usage.blockBytes) return 'blocked';
  return usage.totalBytes >= usage.limitBytes * 0.7 ? 'warn' : 'ok';
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
    blockBytes: n(v.block_bytes) || Math.floor(1024 * 1024 * 1024 * 0.9),
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
