/**
 * Repertório do evento em edição: adicionar, remover, subir/descer, tom do dia e observação.
 * Puro (a tela só chama estas funções); o banco grava tudo numa transação (set_event_songs).
 */
import type { Json } from '@/types/app.types';

export interface SetlistItem {
  songId: string;
  title: string;
  artist: string | null;
  /** Tom oficial (ou original) da música: padrão do "tom do dia". */
  defaultKey: string | null;
  /** Tom do dia escolhido ('' = usar o padrão). */
  key: string;
  notes: string;
}

export const SETLIST_MAX = 30;
export const NOTE_MAX = 200;

export function addSong(
  list: readonly SetlistItem[],
  song: {
    id: string;
    title: string;
    artist: string | null;
    officialKey: string | null;
    originalKey: string | null;
  },
): SetlistItem[] {
  if (list.length >= SETLIST_MAX || list.some((i) => i.songId === song.id)) return [...list];
  return [
    ...list,
    {
      songId: song.id,
      title: song.title,
      artist: song.artist,
      defaultKey: song.officialKey ?? song.originalKey,
      key: '',
      notes: '',
    },
  ];
}

export function removeAt(list: readonly SetlistItem[], index: number): SetlistItem[] {
  return list.filter((_, i) => i !== index);
}

/** Move o item uma posição para cima (-1) ou para baixo (+1); nas pontas não faz nada. */
export function move(list: readonly SetlistItem[], index: number, delta: -1 | 1): SetlistItem[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item!);
  return next;
}

export function updateAt(
  list: readonly SetlistItem[],
  index: number,
  patch: Partial<Pick<SetlistItem, 'key' | 'notes'>>,
): SetlistItem[] {
  return list.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

/** Tom que vai valer no evento: o escolhido ou, se vazio, o oficial/original. */
export function effectiveKey(item: Pick<SetlistItem, 'key' | 'defaultKey'>): string | null {
  return item.key || item.defaultKey;
}

/** Itens no formato da RPC set_event_songs (posição = ordem da lista). */
export function toRpcItems(list: readonly SetlistItem[]): Json {
  return list.map((i) => ({
    song_id: i.songId,
    key_for_event: i.key || null,
    notes: i.notes.trim().slice(0, NOTE_MAX) || null,
  }));
}

/** Mudou algo em relação ao que estava salvo? */
export function setlistChanged(a: readonly SetlistItem[], b: readonly SetlistItem[]): boolean {
  return JSON.stringify(toRpcItems(a)) !== JSON.stringify(toRpcItems(b));
}

/** "Mover Graça para cima" etc.: rótulos dos botões acessíveis. */
export function moveLabel(title: string, delta: -1 | 1): string {
  return `${delta < 0 ? 'Subir' : 'Descer'} ${title}`;
}
