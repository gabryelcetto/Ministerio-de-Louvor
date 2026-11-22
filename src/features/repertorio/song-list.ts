/**
 * Ordenação e filtros da lista do repertório (estado na URL: ?ordem=&filtro=).
 * As contagens ("Mais tocadas", "Há mais tempo sem tocar") vêm prontas do banco
 * (get_song_stats); aqui só se ordena.
 */

export type SongOrder = 'az' | 'recentes' | 'mais-tocadas' | 'sem-tocar';
export type SongFilter = 'audio' | 'favoritas' | 'arquivadas';

export const ORDER_LABEL: Record<SongOrder, string> = {
  az: 'A–Z',
  recentes: 'Adicionadas recentemente',
  'mais-tocadas': 'Mais tocadas',
  'sem-tocar': 'Há mais tempo sem tocar',
};

export const FILTER_LABEL: Record<SongFilter, string> = {
  audio: 'Com áudio',
  favoritas: 'Favoritas',
  arquivadas: 'Arquivadas',
};

export function parseOrder(value: string | null): SongOrder {
  return value && value in ORDER_LABEL ? (value as SongOrder) : 'az';
}

export function parseFilter(value: string | null, canSeeArchived: boolean): SongFilter | null {
  if (value === 'audio' || value === 'favoritas') return value;
  if (value === 'arquivadas' && canSeeArchived) return value;
  return null;
}

export interface SongStat {
  playCount: number;
  lastPlayedAt: string | null;
}

interface Sortable {
  id: string;
  title: string;
  created_at: string;
}

const byTitle = (a: Sortable, b: Sortable) => a.title.localeCompare(b.title, 'pt-BR');

export function sortSongs<T extends Sortable>(
  songs: readonly T[],
  order: SongOrder,
  stats: ReadonlyMap<string, SongStat> = new Map(),
): T[] {
  const count = (s: T) => stats.get(s.id)?.playCount ?? 0;
  const last = (s: T) => {
    const value = stats.get(s.id)?.lastPlayedAt;
    return value ? Date.parse(value) : null;
  };
  const list = [...songs];
  switch (order) {
    case 'recentes':
      return list.sort(
        (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || byTitle(a, b),
      );
    case 'mais-tocadas':
      return list.sort((a, b) => count(b) - count(a) || byTitle(a, b));
    case 'sem-tocar':
      // Nunca tocadas primeiro; depois da mais antiga para a mais recente.
      return list.sort((a, b) => {
        const la = last(a);
        const lb = last(b);
        if (la === lb) return byTitle(a, b);
        if (la === null) return -1;
        if (lb === null) return 1;
        return la - lb;
      });
    default:
      return list.sort(byTitle);
  }
}

export function applyFilter<T extends { id: string }>(
  songs: readonly T[],
  filter: SongFilter | null,
  sets: { withAudio?: ReadonlySet<string>; favorites?: ReadonlySet<string> },
): T[] {
  if (filter === 'audio') return songs.filter((s) => sets.withAudio?.has(s.id));
  if (filter === 'favoritas') return songs.filter((s) => sets.favorites?.has(s.id));
  return [...songs];
}
