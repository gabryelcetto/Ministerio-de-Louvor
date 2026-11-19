import { ChevronRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useSongCategories, useSongSearch, type SongListItem } from '../api';

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

  const setCategory = (value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set('categoria', value);
        else next.delete('categoria');
        return next;
      },
      { replace: true },
    );

  const songs = useSongSearch(query, category);
  const categories = useSongCategories();

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Repertório</h1>
        <p className="text-sm text-muted-foreground">
          Busque pelo nome ou autor — acentos não importam.
        </p>
      </header>

      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          inputMode="search"
          aria-label="Buscar música"
          placeholder="Buscar música ou autor…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-11 pl-9 text-base"
        />
      </div>

      {categories.data && categories.data.length > 0 && (
        <div role="group" aria-label="Filtrar por categoria" className="flex flex-wrap gap-2">
          {[null, ...categories.data].map((value) => {
            const active = category === value;
            return (
              <button
                key={value ?? 'todas'}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(value)}
                className={cn(
                  'inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted',
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
      ) : songs.data.length === 0 ? (
        <EmptyState>
          {query.trim() || category
            ? 'Nenhuma música encontrada com esses filtros.'
            : 'Nenhuma música cadastrada ainda.'}
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {songs.data.length === 1 ? '1 música' : `${songs.data.length} músicas`}
          </p>
          <ul className={cn('flex flex-col gap-2', songs.isPlaceholderData && 'opacity-60')}>
            {songs.data.map((song) => (
              <li key={song.id}>
                <SongListRow song={song} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function SongListRow({ song }: { song: SongListItem }) {
  const key = song.official_key ?? song.original_key;
  return (
    <Link
      to={`/repertorio/${song.id}`}
      className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-semibold">{song.title}</span>
        <span className="truncate text-sm text-muted-foreground">
          {[song.artist, song.category].filter(Boolean).join(' · ') || 'Sem autor'}
        </span>
      </span>
      {key && (
        <span className="flex shrink-0 flex-col items-center">
          <span className="min-w-10 rounded-md bg-muted px-2 py-1 text-center text-sm font-bold">
            <span className="sr-only">Tom: </span>
            {key}
          </span>
          <span className="mt-0.5 text-[0.7rem] text-muted-foreground">
            {song.official_key ? 'oficial' : 'original'}
          </span>
        </span>
      )}
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
