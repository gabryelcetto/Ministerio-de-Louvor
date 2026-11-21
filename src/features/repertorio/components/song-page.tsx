import {
  ArrowLeft,
  ExternalLink,
  History,
  KeyRound,
  Minus,
  Pencil,
  SquarePen,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/features/auth';
import { cn } from '@/lib/utils';
import { useSong, type SongDetail } from '../api';
import {
  currentKey,
  formatSemitones,
  keyOptions,
  mediaHost,
  normalizeSemitones,
  safeMediaUrl,
  semitonesTo,
  sheetBaseKey,
} from '../song-key';
import { chordProToLyrics } from '../editor-checks';
import { ChordSheet } from './chord-sheet';
import { ReferenceAudios } from '@/features/audio';
import { shortestSemitones } from '@/lib/audio/semitones';
import { ArchiveSongButton, SongDataEditor } from './song-data-editor';
import { ChordsEditor, LyricsEditor, OfficialKeyEditor } from './song-editors';

/** Tamanhos de letra para leitura tocando (o acorde acompanha, em `em`). */
const TEXT_SIZES = ['text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'] as const;
const DEFAULT_SIZE = 2;
const SIZE_STORAGE_KEY = 'repertorio:tamanho-letra';

function readStoredSize(): number {
  try {
    const value = Number(localStorage.getItem(SIZE_STORAGE_KEY));
    return Number.isInteger(value) && value >= 0 && value < TEXT_SIZES.length
      ? value
      : DEFAULT_SIZE;
  } catch {
    return DEFAULT_SIZE;
  }
}

export function SongPage() {
  const { songId } = useParams();
  const query = useSong(songId);

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to="/repertorio">
          <ArrowLeft aria-hidden="true" />
          Repertório
        </Link>
      </Button>

      {query.isPending ? (
        <LoadingState label="Carregando música…" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data === null ? (
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Música não encontrada</h1>
          <p className="text-muted-foreground">Ela pode ter sido removida do repertório.</p>
        </div>
      ) : (
        <SongView song={query.data} />
      )}
    </section>
  );
}

type Tab = 'cifra' | 'letra';

type Editing = 'letra' | 'cifra' | 'tom' | 'dados' | null;

const SAVED_MESSAGE: Record<Exclude<Editing, null>, string> = {
  letra: 'Letra salva.',
  cifra: 'Cifra salva.',
  tom: 'Tom oficial salvo.',
  dados: 'Dados da música salvos.',
};

function SongView({ song }: { song: SongDetail }) {
  const [params, setParams] = useSearchParams();
  const [size, setSizeState] = useState(readStoredSize);
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Só esconde/mostra botões: quem barra de verdade é o banco (RLS e triggers).
  const canEditChords = usePermission('chords.edit_official');
  const canSetKey = usePermission('songs.set_official_key');
  const canManageSongs = usePermission('songs.manage');
  const canArchive = usePermission('songs.delete');
  const media = safeMediaUrl(song.media_url);

  const tab: Tab =
    params.get('aba') === 'letra' || (!song.chords && params.get('aba') !== 'cifra')
      ? 'letra'
      : 'cifra';

  // Tom: guardado na URL (?tom=A), o que permite abrir já no "tom do dia" vindo de uma escala.
  const baseKey = sheetBaseKey(song.chords, song.original_key);
  const officialSemitones = semitonesTo(baseKey, song.official_key);
  const tomParam = params.get('tom');
  const semitones = baseKey
    ? tomParam
      ? semitonesTo(baseKey, tomParam)
      : officialSemitones
    : normalizeSemitones(Number(params.get('st')) || 0);
  const shownKey = currentKey(baseKey, semitones);

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [name, value] of Object.entries(changes)) {
          if (value === null) next.delete(name);
          else next.set(name, value);
        }
        return next;
      },
      { replace: true },
    );

  const setSemitones = (value: number) => {
    const n = normalizeSemitones(value);
    if (baseKey) update({ tom: currentKey(baseKey, n), st: null });
    else update({ st: n === 0 ? null : String(n), tom: null });
  };

  const setSize = (value: number) => {
    const next = Math.min(TEXT_SIZES.length - 1, Math.max(0, value));
    setSizeState(next);
    try {
      localStorage.setItem(SIZE_STORAGE_KEY, String(next));
    } catch {
      // Sem armazenamento (aba anônima etc.): o tamanho vale só nesta visita.
    }
  };

  const textSize = TEXT_SIZES[size] ?? 'text-xl';

  const startEditing = (what: Exclude<Editing, null>) => {
    setNotice(null);
    setEditing(what);
    if (what === 'letra' || what === 'cifra') update({ aba: what });
  };
  const finishEditing = (saved: boolean) => {
    if (saved && editing) setNotice(SAVED_MESSAGE[editing]);
    setEditing(null);
  };

  return (
    <>
      <header className="flex flex-col gap-2">
        {song.archived_at && (
          <p role="status" className="rounded-lg border border-accent bg-accent/15 p-3 text-sm">
            Música <strong>arquivada</strong>: não aparece na lista do repertório.
          </p>
        )}
        <h1 className="text-2xl font-semibold">{song.title}</h1>
        {song.artist && <p className="text-muted-foreground">{song.artist}</p>}
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {song.category && <Info label="Categoria">{song.category}</Info>}
          {song.original_key && <Info label="Tom original">{song.original_key}</Info>}
          <Info label="Tom oficial">{song.official_key ?? 'não definido'}</Info>
        </dl>
        {media && (
          <a
            href={media}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 self-start rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
            Ouvir / assistir ({mediaHost(media)})<span className="sr-only">(abre em nova aba)</span>
          </a>
        )}
        {song.notes && (
          <p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-line">{song.notes}</p>
        )}
        {!editing && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => startEditing('letra')}>
              <Pencil aria-hidden="true" />
              Editar letra
            </Button>
            {canEditChords && (
              <Button variant="outline" size="sm" onClick={() => startEditing('cifra')}>
                <Pencil aria-hidden="true" />
                {song.chords ? 'Editar cifra' : 'Adicionar cifra'}
              </Button>
            )}
            {canManageSongs && (
              <Button variant="outline" size="sm" onClick={() => startEditing('dados')}>
                <SquarePen aria-hidden="true" />
                Editar dados
              </Button>
            )}
            {canSetKey && (
              <Button variant="outline" size="sm" onClick={() => startEditing('tom')}>
                <KeyRound aria-hidden="true" />
                Definir tom oficial
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link to={`/repertorio/${song.id}/historico`}>
                <History aria-hidden="true" />
                Histórico
              </Link>
            </Button>
            {canArchive && (
              <ArchiveSongButton
                songId={song.id}
                title={song.title}
                archived={Boolean(song.archived_at)}
              />
            )}
          </div>
        )}
        <p role="status" aria-live="polite" className="text-sm font-medium text-primary">
          {notice}
        </p>
        {editing === 'dados' && <SongDataEditor song={song} onDone={finishEditing} />}
        {editing === 'tom' && (
          <OfficialKeyEditor
            songId={song.id}
            current={song.official_key}
            shownKey={shownKey}
            onDone={finishEditing}
          />
        )}
      </header>

      <SongTabs
        tab={tab}
        onChange={(value) => update({ aba: value })}
        extra={
          <div className="flex items-center gap-1" role="group" aria-label="Tamanho da letra">
            <SizeButton
              label="Diminuir letra"
              onClick={() => setSize(size - 1)}
              disabled={size === 0}
            >
              A−
            </SizeButton>
            <SizeButton
              label="Aumentar letra"
              onClick={() => setSize(size + 1)}
              disabled={size === TEXT_SIZES.length - 1}
            >
              A+
            </SizeButton>
          </div>
        }
        cifra={
          editing === 'cifra' ? (
            <ChordsEditor
              songId={song.id}
              initial={
                song.chords ??
                (song.lyrics
                  ? `${song.original_key ? `{key: ${song.original_key}}\n` : ''}${song.lyrics}`
                  : '')
              }
              onDone={finishEditing}
            />
          ) : song.chords ? (
            <div className="flex flex-col gap-3">
              {song.chordsStatus === 'pending' && (
                <p
                  role="note"
                  className="rounded-lg border border-accent bg-accent/15 p-3 text-sm text-foreground"
                >
                  Cifra enviada por um integrante e <strong>aguardando revisão</strong> da
                  liderança.
                </p>
              )}
              <ChordSheet
                content={song.chords}
                semitones={semitones}
                fromKey={baseKey}
                className={cn(textSize, 'leading-snug')}
              />
            </div>
          ) : (
            <p className="text-muted-foreground">Esta música ainda não tem cifra.</p>
          )
        }
        letra={
          editing === 'letra' ? (
            <LyricsEditor
              songId={song.id}
              initial={song.lyrics ?? (song.chords ? chordProToLyrics(song.chords) : '')}
              onDone={finishEditing}
            />
          ) : song.lyrics ? (
            <p className={cn('leading-relaxed whitespace-pre-line', textSize)}>{song.lyrics}</p>
          ) : song.chords ? (
            // Sem letra cadastrada: mostra a letra da própria cifra, sem acordes.
            <ChordSheet content={song.chords} showChords={false} className={textSize} />
          ) : (
            <p className="text-muted-foreground">Esta música ainda não tem letra.</p>
          )
        }
      />

      {/* O áudio de referência está no tom ORIGINAL: o player muda o tom pela diferença até o tom
          que está na tela (caminho mais curto, −6 a +5). */}
      <ReferenceAudios
        songId={song.id}
        followSemitones={shortestSemitones(song.original_key ?? baseKey, shownKey)}
        shownKey={shownKey}
      />

      {tab === 'cifra' && song.chords && !editing && (
        <>
          {/* Espaço para a barra fixa não cobrir o fim da cifra. */}
          <div aria-hidden="true" className="h-20 md:h-4" />
          <div
            role="toolbar"
            aria-label="Tom"
            className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t bg-card/95 px-3 py-2 backdrop-blur md:sticky md:bottom-4 md:mx-auto md:w-fit md:rounded-xl md:border md:shadow-md"
          >
            <KeyControls
              baseKey={baseKey}
              semitones={semitones}
              shownKey={shownKey}
              officialKey={song.official_key}
              isOfficial={Boolean(song.official_key) && semitones === officialSemitones}
              onChange={setSemitones}
              onOfficial={() => setSemitones(officialSemitones)}
            />
          </div>
        </>
      )}
    </>
  );
}

function KeyControls({
  baseKey,
  semitones,
  shownKey,
  officialKey,
  isOfficial,
  onChange,
  onOfficial,
}: {
  baseKey: string | null;
  semitones: number;
  shownKey: string | null;
  officialKey: string | null;
  isOfficial: boolean;
  onChange: (semitones: number) => void;
  onOfficial: () => void;
}) {
  const selectId = useId();
  return (
    <div className="mx-auto flex max-w-3xl items-center justify-center gap-1.5">
      <ToolButton label="Descer meio tom" onClick={() => onChange(semitones - 1)}>
        <Minus aria-hidden="true" className="size-5" />
      </ToolButton>

      {baseKey ? (
        <>
          <label htmlFor={selectId} className="sr-only">
            Tom
          </label>
          <select
            id={selectId}
            value={shownKey ?? ''}
            onChange={(e) => onChange(semitonesTo(baseKey, e.target.value))}
            className="h-12 min-w-16 rounded-lg border bg-background px-2 text-center text-lg font-bold text-chord focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {keyOptions(baseKey).map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </>
      ) : (
        <span
          className="flex h-12 min-w-16 items-center justify-center rounded-lg border px-2 text-sm font-bold"
          aria-live="polite"
        >
          <span className="sr-only">Transposição: </span>
          {formatSemitones(semitones)}
        </span>
      )}

      <ToolButton label="Subir meio tom" onClick={() => onChange(semitones + 1)}>
        <Plus aria-hidden="true" className="size-5" />
      </ToolButton>

      <Button
        type="button"
        variant={isOfficial ? 'secondary' : 'outline'}
        className="ml-1 h-12 px-3"
        onClick={onOfficial}
        disabled={!officialKey || isOfficial}
        title={officialKey ? `Voltar ao tom oficial (${officialKey})` : 'Sem tom oficial definido'}
      >
        <RotateCcw aria-hidden="true" />
        <span className="hidden sm:inline">Tom oficial</span>
        <span className="sm:hidden">Oficial</span>
      </Button>
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="size-12 p-0"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

function SizeButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    // Nome acessível = texto para leitor de tela (sem aria-label): "A−" visível não diverge do
    // nome "Diminuir letra" (WCAG 2.5.3, regra label-content-name-mismatch do axe).
    <Button
      type="button"
      variant="ghost"
      className="size-11 p-0 text-base font-bold"
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <span aria-hidden="true">{children}</span>
      <span className="sr-only">{label}</span>
    </Button>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-1">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

const TABS: { value: Tab; label: string }[] = [
  { value: 'cifra', label: 'Cifra' },
  { value: 'letra', label: 'Letra' },
];

/** Abas acessíveis (setas ←/→ trocam de aba, como no padrão WAI-ARIA). */
function SongTabs({
  tab,
  onChange,
  cifra,
  letra,
  extra,
}: {
  tab: Tab;
  onChange: (tab: Tab) => void;
  cifra: ReactNode;
  letra: ReactNode;
  /** Controles ao lado das abas (tamanho da letra). */
  extra?: ReactNode;
}) {
  const baseId = useId();
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ cifra: null, letra: null });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next: Tab = tab === 'cifra' ? 'letra' : 'cifra';
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div
          role="tablist"
          aria-label="Conteúdo da música"
          onKeyDown={onKeyDown}
          className="grid flex-1 grid-cols-2 rounded-lg bg-muted p-1"
        >
          {TABS.map(({ value, label }) => {
            const selected = tab === value;
            return (
              <button
                key={value}
                ref={(el) => {
                  refs.current[value] = el;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${value}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${value}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => onChange(value)}
                className={cn(
                  'min-h-11 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        {extra}
      </div>
      {TABS.map(({ value }) => (
        <div
          key={value}
          role="tabpanel"
          id={`${baseId}-panel-${value}`}
          aria-labelledby={`${baseId}-tab-${value}`}
          hidden={tab !== value}
          tabIndex={0}
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {value === 'cifra' ? cifra : letra}
        </div>
      ))}
    </div>
  );
}
