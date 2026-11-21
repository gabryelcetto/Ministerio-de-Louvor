import { ArrowDown, ArrowUp, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { FormError } from '@/components/common/form-error';
import { KeyChip } from '@/components/common/key-chip';
import { ErrorState, LoadingState } from '@/components/common/states';
import { useUnsavedGuard } from '@/components/common/use-unsaved-guard';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMyPermissions } from '@/features/auth';
import { useSingleFlight } from '@/hooks/use-single-flight';
import { allKeys } from '@/lib/chords';
import { useEventDetail } from '../hooks';
import {
  addSong,
  move,
  moveLabel,
  NOTE_MAX,
  removeAt,
  SETLIST_MAX,
  setlistChanged,
  updateAt,
  type SetlistItem,
} from '../setlist';
import { useSaveSetlist, useSetlist, useSongSearch } from '../setlist-api';

/**
 * Editar repertório do evento (schedules.manage): buscar e adicionar, remover, subir/descer,
 * tom do dia (padrão: tom oficial) e uma observação por música. Também é o passo 3 de
 * "Montar escala" (?montar=1), depois das pessoas.
 */
export function SetlistEditorPage() {
  const { eventId = '' } = useParams();
  const [params] = useSearchParams();
  const step = params.get('montar') === '1';
  const permissions = useMyPermissions();
  const event = useEventDetail(eventId);
  const setlist = useSetlist(eventId);
  const back = `/escalas/${eventId}`;
  const title = step ? 'Montar escala' : 'Editar repertório';
  const subtitle = step
    ? `Passo 3 · Repertório${event.data ? ` de ${event.data.event.title}` : ''}`
    : event.data?.event.title;

  if (permissions.isPending || setlist.isPending || event.isPending) {
    return (
      <>
        <ScreenHeader title={title} back={back} />
        <LoadingState label="Carregando repertório…" />
      </>
    );
  }
  if (!permissions.data?.includes('schedules.manage')) {
    return (
      <>
        <ScreenHeader title={title} back={back} />
        <p role="alert" className="mx-auto max-w-[45rem] rounded-2xl border bg-card p-4 text-sm">
          Você não tem permissão para montar o repertório.
        </p>
      </>
    );
  }
  if (setlist.isError || event.isError || !event.data) {
    return (
      <>
        <ScreenHeader title={title} back={back} />
        <ErrorState onRetry={() => void setlist.refetch()} />
      </>
    );
  }
  return (
    <>
      <ScreenHeader title={title} subtitle={subtitle} back={back} />
      <Editor eventId={eventId} initial={setlist.data} step={step} />
    </>
  );
}

function Editor({
  eventId,
  initial,
  step,
}: {
  eventId: string;
  initial: SetlistItem[];
  step: boolean;
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState<SetlistItem[]>(initial);
  const [saved, setSaved] = useState(false);
  const save = useSaveSetlist(eventId);
  const once = useSingleFlight({ keepLockedOnSuccess: true });
  const dirty = setlistChanged(items, initial);
  const guard = useUnsavedGuard(dirty && !saved);

  useEffect(() => {
    if (saved) void navigate(`/escalas/${eventId}#repertorio`, { replace: true });
  }, [saved, navigate, eventId]);

  return (
    <form
      noValidate
      aria-label="Repertório do evento"
      className="mx-auto flex max-w-[45rem] flex-col gap-5 pb-28"
      onSubmit={(e) => {
        e.preventDefault();
        void once(async () => {
          await save.mutateAsync(items);
          setSaved(true);
        }).catch(() => undefined); // o erro aparece pelo save.error
      }}
    >
      <section aria-labelledby="repertorio-lista" className="flex flex-col gap-3">
        <h2 id="repertorio-lista" className="section-label">
          Músicas ({items.length})
        </h2>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Nenhuma música ainda. Busque abaixo para adicionar.
          </p>
        ) : (
          <ol aria-label="Ordem do repertório" className="flex flex-col gap-2">
            {items.map((item, index) => (
              <li key={item.songId}>
                <SetlistRow
                  item={item}
                  index={index}
                  last={index === items.length - 1}
                  onMove={(delta) => setItems((l) => move(l, index, delta))}
                  onRemove={() => setItems((l) => removeAt(l, index))}
                  onChange={(patch) => setItems((l) => updateAt(l, index, patch))}
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      <SongPicker
        chosen={new Set(items.map((i) => i.songId))}
        full={items.length >= SETLIST_MAX}
        onAdd={(song) => setItems((l) => addSong(l, song))}
      />

      <FormError error={save.error} fallback="Não foi possível salvar o repertório." />

      <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 border-t bg-card px-4 py-3 md:bottom-0 md:left-60 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-[45rem] items-center justify-end gap-2">
          <Button asChild variant="outline">
            <Link to={`/escalas/${eventId}`}>{step ? 'Pular' : 'Cancelar'}</Link>
          </Button>
          <Button type="submit" disabled={save.isPending || saved}>
            {save.isPending ? 'Salvando…' : 'Salvar repertório'}
          </Button>
        </div>
      </div>
      {guard}
    </form>
  );
}

function SetlistRow({
  item,
  index,
  last,
  onMove,
  onRemove,
  onChange,
}: {
  item: SetlistItem;
  index: number;
  last: boolean;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onChange: (patch: { key?: string; notes?: string }) => void;
}) {
  const id = useId();
  const minor = (item.defaultKey ?? '').endsWith('m');
  return (
    <div
      role="group"
      aria-label={`${index + 1}. ${item.title}`}
      className="flex flex-col gap-3 rounded-2xl border bg-card p-3"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-chip text-sm font-bold"
        >
          {index + 1}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{item.title}</span>
          {item.artist && (
            <span className="truncate text-caption text-muted-foreground">{item.artist}</span>
          )}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          aria-label={moveLabel(item.title, -1)}
        >
          <ArrowUp aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={last}
          onClick={() => onMove(1)}
          aria-label={moveLabel(item.title, 1)}
        >
          <ArrowDown aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={`Tirar ${item.title}`}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-tom`}>Tom do dia</Label>
          <select
            id={`${id}-tom`}
            value={item.key}
            onChange={(e) => onChange({ key: e.target.value })}
            className="h-11 rounded-lg border bg-card px-3 text-sm"
          >
            <option value="">{item.defaultKey ? `Oficial (${item.defaultKey})` : 'Sem tom'}</option>
            {allKeys(minor).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-obs`}>Observação (opcional)</Label>
          <Input
            id={`${id}-obs`}
            value={item.notes}
            maxLength={NOTE_MAX}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Ex.: só voz e violão na 1ª parte"
          />
        </div>
      </div>
    </div>
  );
}

function SongPicker({
  chosen,
  full,
  onAdd,
}: {
  chosen: ReadonlySet<string>;
  full: boolean;
  onAdd: (song: Parameters<typeof addSong>[1]) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const result = useSongSearch(query);
  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
    >
      <h2 id={`${id}-titulo`} className="section-label">
        Adicionar música
      </h2>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>Buscar no repertório</Label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={id}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      {full && (
        <p className="text-sm text-muted-foreground">
          O repertório tem no máximo {SETLIST_MAX} músicas.
        </p>
      )}
      {result.isPending ? (
        <p className="text-sm text-muted-foreground">Buscando…</p>
      ) : result.isError ? (
        <p className="text-sm text-destructive">Não foi possível buscar.</p>
      ) : result.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma música encontrada.</p>
      ) : (
        <ul
          aria-label="Resultado da busca"
          className="flex max-h-72 flex-col divide-y overflow-y-auto"
        >
          {result.data.map((song) => {
            const added = chosen.has(song.id);
            return (
              <li key={song.id} className="flex items-center gap-3 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{song.title}</span>
                  {song.artist && (
                    <span className="truncate text-caption text-muted-foreground">
                      {song.artist}
                    </span>
                  )}
                </span>
                {(song.officialKey ?? song.originalKey) && (
                  <KeyChip value={(song.officialKey ?? song.originalKey)!} label="Tom oficial" />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={added || full}
                  onClick={() => onAdd(song)}
                >
                  <Plus aria-hidden="true" />
                  {added ? 'Na lista' : 'Adicionar'}
                  <span className="sr-only">: {song.title}</span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
