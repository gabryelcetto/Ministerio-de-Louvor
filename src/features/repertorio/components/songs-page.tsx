import { Headphones, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { KeyChip } from '@/components/common/key-chip';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermission } from '@/features/auth';
import { cn } from '@/lib/utils';
import { useSongCategories, useSongSearch, useSongsWithAudio, type SongListItem } from '../api';

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
  const canAdd = usePermission('songs.manage');
  const withAudio = useSongsWithAudio();

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

      {categories.data && categories.data.length > 0 && (
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
      ) : songs.data.length === 0 ? (
        <EmptyState>
          {query.trim() || category
            ? 'Nenhuma música encontrada com esses filtros.'
            : 'Nenhuma música cadastrada ainda.'}
        </EmptyState>
      ) : (
        <>
          <p className="text-caption text-muted-foreground" aria-live="polite">
            {songs.data.length === 1 ? '1 música' : `${songs.data.length} músicas`}
          </p>
          <ul
            aria-label="Músicas"
            className={cn(
              'flex flex-col divide-y divide-line overflow-hidden rounded-xl border bg-card',
              songs.isPlaceholderData && 'opacity-60',
            )}
          >
            {songs.data.map((song) => (
              <li key={song.id}>
                <SongListRow song={song} hasAudio={withAudio.data?.has(song.id) ?? false} />
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

function SongListRow({ song, hasAudio }: { song: SongListItem; hasAudio: boolean }) {
  const key = song.official_key ?? song.original_key;
  return (
    <Link
      to={`/repertorio/${song.id}`}
      className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-semibold">{song.title}</span>
        {song.artist && (
          <span className="truncate text-sm text-muted-foreground">{song.artist}</span>
        )}
      </span>
      {hasAudio && (
        <Headphones
          aria-label="Tem áudio de referência"
          role="img"
          className="size-4 shrink-0 text-muted-foreground"
        />
      )}
      {key && <KeyChip value={key} label={song.official_key ? 'Tom oficial' : 'Tom original'} />}
    </Link>
  );
}
