import { ArchiveRestore, Headphones, Plus, Search, Star } from 'lucide-react';
import { FavoriteToggle } from './favorite-toggle';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { KeyChip } from '@/components/common/key-chip';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermission } from '@/features/auth';
import { cn } from '@/lib/utils';
import { useSetSongArchived } from '../song-data';
import { relativeAgo } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import {
  useArchivedSongs,
  useFavorites,
  useSongCategories,
  useSongSearch,
  useSongStats,
  useSongsWithAudio,
  type SongListItem,
} from '../api';
import {
  applyFilter,
  FILTER_LABEL,
  ORDER_LABEL,
  parseFilter,
  parseOrder,
  sortSongs,
  type SongFilter,
  type SongOrder,
  type SongStat,
} from '../song-list';
import { LABELS } from '@/lib/messages';

/** Espera o usuário parar de digitar antes de consultar o banco. */
function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Repertório: busca sem acento (search_songs) + filtro por categoria. Estado na URL. */
export function SongsPage() {
  const [params, setParams] = useSearchParams();
  const category = params.get('categoria');
  const [text, setText] = useState(params.get('busca') ?? '');
  const query = useDebounced(text);

  // Guarda a busca na URL (voltar da música mantém a lista como estava).
  useEffect(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (query.trim()) next.set('busca', query.trim());
        else next.delete('busca');
        return next;
      },
      { replace: true },
    );
  }, [query, setParams]);

  const setParam = (name: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );
  const setCategory = (value: string | null) => setParam('categoria', value);

  const canAdd = usePermission('songs.manage');
  const canArchive = usePermission('songs.delete');
  const order = parseOrder(params.get('ordem'));
  const filter = parseFilter(params.get('filtro'), canArchive);
  const archivedView = filter === 'arquivadas';

  const search = useSongSearch(query, category);
  const archived = useArchivedSongs(query, archivedView);
  const songs = archivedView ? archived : search;
  const categories = useSongCategories();
  const withAudio = useSongsWithAudio();
  const favorites = useFavorites();
  const stats = useSongStats();
  const shown = songs.data
    ? sortSongs(
        applyFilter(songs.data, filter, { withAudio: withAudio.data, favorites: favorites.data }),
        order,
        stats.data,
      )
    : [];
  const filterOptions: SongFilter[] = canArchive
    ? ['audio', 'favoritas', 'arquivadas']
    : ['audio', 'favoritas'];

  return (
    <section className="mx-auto flex max-w-[45rem] flex-col gap-4">
      <h1 className="text-screen-title">Repertório</h1>

      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          inputMode="search"
          aria-label="Buscar música"
          placeholder="Buscar música ou artista"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-12 pl-11 text-base"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-semibold">
          Ordenar por
          <select
            value={order}
            onChange={(e) => setParam('ordem', e.target.value === 'az' ? null : e.target.value)}
            className="h-11 rounded-lg border bg-card px-3 text-sm font-normal"
          >
            {(Object.keys(ORDER_LABEL) as SongOrder[]).map((o) => (
              <option key={o} value={o}>
                {ORDER_LABEL[o]}
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Mostrar só" className="flex flex-wrap gap-2">
          {filterOptions.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setParam('filtro', filter === value ? null : value)}
              className={cn(
                'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filter === value
                  ? 'bg-brand-soft text-brand-text'
                  : 'bg-chip text-foreground hover:bg-muted',
              )}
            >
              {value === 'audio' && <Headphones aria-hidden="true" className="size-4" />}
              {value === 'favoritas' && <Star aria-hidden="true" className="size-4" />}
              {FILTER_LABEL[value]}
            </button>
          ))}
        </div>
      </div>

      {!archivedView && categories.data && categories.data.length > 0 && (
        // Rolagem horizontal: as categorias não quebram linha no celular.
        <div
          role="group"
          aria-label="Filtrar por categoria"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0"
        >
          {[null, ...categories.data].map((value) => {
            const active = category === value;
            return (
              <button
                key={value ?? 'todas'}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(value)}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center rounded-lg px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-brand-soft text-brand-text'
                    : 'bg-chip text-foreground hover:bg-muted',
                )}
              >
                {value ?? 'Todas'}
              </button>
            );
          })}
        </div>
      )}

      {songs.isPending ? (
        <LoadingState label="Carregando músicas…" />
      ) : songs.isError ? (
        <ErrorState onRetry={() => void songs.refetch()} />
      ) : shown.length === 0 ? (
        <EmptyState>
          {archivedView
            ? 'Nenhuma música arquivada.'
            : query.trim() || category || filter
              ? 'Nenhuma música encontrada com esses filtros.'
              : 'Nenhuma música cadastrada ainda.'}
        </EmptyState>
      ) : (
        <>
          <p className="text-caption text-muted-foreground" aria-live="polite">
            {shown.length === 1 ? '1 música' : `${shown.length} músicas`}
            {archivedView ? (shown.length === 1 ? ' arquivada' : ' arquivadas') : ''}
          </p>
          <ul
            aria-label="Músicas"
            className={cn(
              'flex flex-col divide-y divide-line overflow-hidden rounded-xl border bg-card',
              songs.isPlaceholderData && 'opacity-60',
            )}
          >
            {shown.map((song) => (
              <li key={song.id}>
                {archivedView ? (
                  <ArchivedRow song={song} />
                ) : (
                  <SongListRow
                    song={song}
                    hasAudio={withAudio.data?.has(song.id) ?? false}
                    favorite={favorites.data?.has(song.id) ?? false}
                    stat={stats.data?.get(song.id)}
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {canAdd && (
        // Botão flutuante, acima da barra de baixo no celular.
        <Button
          asChild
          size="lg"
          className="fixed right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-30 rounded-full px-5 shadow-lg md:right-8 md:bottom-8"
        >
          <Link to="/repertorio/nova">
            <Plus aria-hidden="true" />
            Nova música
          </Link>
        </Button>
      )}
    </section>
  );
}

function SongListRow({
  song,
  hasAudio,
  favorite,
  stat,
}: {
  song: SongListItem;
  hasAudio: boolean;
  favorite: boolean;
  stat: SongStat | undefined;
}) {
  const key = song.official_key ?? song.original_key;
  const played = stat?.lastPlayedAt ? `tocada ${relativeAgo(stat.lastPlayedAt)}` : null;
  return (
    <div className="flex items-center">
      <Link
        to={`/repertorio/${song.id}`}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pr-2 pl-4 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-semibold">{song.title}</span>
          {(song.artist || played) && (
            <span className="truncate text-sm text-muted-foreground">
              {[song.artist, played].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        {hasAudio && (
          <Headphones
            aria-label="Tem áudio de referência"
            role="img"
            className="size-4 shrink-0 text-muted-foreground"
          />
        )}
        {key && (
          <KeyChip value={key} label={song.official_key ? LABELS.officialKey : 'Tom original'} />
        )}
      </Link>
      <FavoriteToggle songId={song.id} title={song.title} favorite={favorite} />
    </div>
  );
}

/** Música arquivada (só quem pode arquivar vê): abre e pode "Desarquivar". */
function ArchivedRow({ song }: { song: SongListItem }) {
  const restore = useSetSongArchived(song.id);
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center gap-3">
        <Link
          to={`/repertorio/${song.id}`}
          className="min-w-0 flex-1 truncate font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {song.title}
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={restore.isPending}
          onClick={() => restore.mutate(false)}
        >
          <ArchiveRestore aria-hidden="true" />
          Desarquivar
          <span className="sr-only">: {song.title}</span>
        </Button>
      </div>
      {restore.isError && (
        <p role="alert" className="text-sm text-destructive">
          {friendlyError(restore.error)}
        </p>
      )}
    </div>
  );
}
