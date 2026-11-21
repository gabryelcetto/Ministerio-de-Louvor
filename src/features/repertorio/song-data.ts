import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { requireAffected } from '@/lib/errors';
import { supabase } from '@/services/supabase';
import { normalizeKey } from '@/lib/chords';
import { invalidateAfterSave, songKeys } from './editing';

/**
 * Dados da música (título, artista, categoria, tom original, link e observações).
 * Cadastrar exige songs.manage; editar dados também; arquivar exige songs.delete.
 * Quem decide é o banco (RLS + trigger guard_song_changes); aqui só validamos o formulário.
 */

const optionalText = (max: number) => z.string().trim().max(max, `Use até ${max} caracteres.`);

const keyField = z
  .string()
  .trim()
  .refine((v) => v === '' || normalizeKey(v) !== null, 'Tom inválido.');

export const songDataSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título.').max(200, 'Use até 200 caracteres.'),
  artist: optionalText(200),
  category: optionalText(60),
  originalKey: keyField,
  mediaUrl: z
    .string()
    .trim()
    .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Use um link começando com https://'),
  notes: optionalText(1000),
});

export type SongDataValues = z.infer<typeof songDataSchema>;

const lenient = (max: number) =>
  z
    .string()
    .trim()
    .transform((v) => v.slice(0, max));

/** Link válido (http/https) ou vazio. */
export function isMediaUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

/**
 * Nova música: só o título é obrigatório. O resto NUNCA impede o salvamento: texto longo
 * demais é cortado, link que não começa com http(s) e tom desconhecido ficam de fora (a tela
 * avisa embaixo do campo).
 */
export const newSongSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título.').max(200, 'Use até 200 caracteres.'),
  artist: lenient(200),
  category: lenient(60),
  originalKey: z
    .string()
    .trim()
    .transform((v) => (v && normalizeKey(v) ? v : '')),
  mediaUrl: z
    .string()
    .trim()
    .transform((v) => (isMediaUrl(v) ? v : '')),
  notes: lenient(1000),
});

const orNull = (v: string) => (v.trim() === '' ? null : v.trim());

export interface NewSongInput extends SongDataValues {
  officialKey: string;
  lyrics: string;
  chords: string;
}

/** Cadastra a música com letra e cifra numa transação só (RPC create_song). */
export async function createSong(input: NewSongInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_song', {
    p_title: input.title.trim(),
    p_artist: input.artist,
    p_category: input.category,
    p_original_key: input.originalKey,
    p_official_key: input.officialKey,
    p_media_url: input.mediaUrl,
    p_notes: input.notes,
    p_lyrics: input.lyrics,
    p_chords: input.chords,
  });
  if (error) throw error;
  return data;
}

export async function updateSongData(songId: string, values: SongDataValues): Promise<void> {
  const { data, error } = await supabase
    .from('songs')
    .update({
      title: values.title.trim(),
      artist: orNull(values.artist),
      category: orNull(values.category),
      original_key: orNull(values.originalKey),
      media_url: orNull(values.mediaUrl),
      notes: orNull(values.notes),
    })
    .eq('id', songId)
    .select('id');
  if (error) throw error;
  requireAffected(data);
}

/** Arquivar tira a música da busca (não apaga histórico nem escalas antigas). */
export async function setSongArchived(songId: string, archived: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('songs')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', songId)
    .select('id');
  if (error) throw error;
  requireAffected(data);
}

export function useCreateSong() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createSong,
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['songs', 'search'] }),
        client.invalidateQueries({ queryKey: ['songs', 'categories'] }),
      ]),
  });
}

export function useUpdateSongData(songId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: SongDataValues) => updateSongData(songId, values),
    onSuccess: async () => {
      await invalidateAfterSave(client, songId, 'song');
      await client.invalidateQueries({ queryKey: ['songs', 'categories'] });
    },
  });
}

export function useSetSongArchived(songId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (archived: boolean) => setSongArchived(songId, archived),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: songKeys.detail(songId) }),
        client.invalidateQueries({ queryKey: ['songs', 'search'] }),
        client.invalidateQueries({ queryKey: ['songs', 'archived'] }),
      ]),
  });
}

/** Valores do formulário a partir da música salva. */
export function songDataDefaults(song: {
  title: string;
  artist: string | null;
  category: string | null;
  original_key: string | null;
  media_url: string | null;
  notes: string | null;
}): SongDataValues {
  return {
    title: song.title,
    artist: song.artist ?? '',
    category: song.category ?? '',
    originalKey: song.original_key ?? '',
    mediaUrl: song.media_url ?? '',
    notes: song.notes ?? '',
  };
}
