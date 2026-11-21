import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  History,
  KeyRound,
  Mic,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  SquarePen,
} from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ErrorState, LoadingState } from '@/components/common/states';
import { OverflowMenu, type OverflowMenuItem } from '@/components/layout/overflow-menu';
import { ScreenHeader } from '@/components/layout/screen-header';
import { ReferenceAudios, SongAudioBar, SongAudioProvider, useSongAudio } from '@/features/audio';
import { usePermission } from '@/features/auth';
import {
  setlistPosition,
  songInEventHref,
  swipeDirection,
  useEventDetail,
} from '@/features/escalas';
import { Button } from '@/components/ui/button';
import { useWakeLock } from '@/hooks/use-wake-lock';
import { shortestSemitones } from '@/lib/audio/semitones';
import {
  nextTextSize,
  readLastTab,
  readTextSize,
  saveLastTab,
  saveTextSize,
  TEXT_SIZES,
  type SongTab,
  type TextSizeIndex,
} from '@/lib/reading-prefs';
import { cn } from '@/lib/utils';
import { useSong, type SongDetail } from '../api';
import { chordProToLyrics } from '../editor-checks';
import {
  currentKey,
  formatSemitones,
  keyOptions,
  mediaHost,
  normalizeSemitones,
  safeMediaUrl,
  semitonesTo,
  sheetBaseKey,
  transposeLegend,
} from '../song-key';
import { ChordSheet } from './chord-sheet';
import { ArchiveSongDialog, SongDataEditor } from './song-data-editor';
import { ChordsEditor, LyricsEditor, OfficialKeyEditor } from './song-editors';
import { LABELS } from '@/lib/messages';

/** Tela da música ("modo tocar"). */
export function SongPage() {
  const { songId } = useParams();
  const query = useSong(songId);

  if (query.isPending || query.isError || query.data === null) {
    return (
      <>
        <ScreenHeader
          title={query.data === null ? 'Música não encontrada' : 'Música'}
          back="/repertorio"
        />
        {query.isPending ? (
          <LoadingState label="Carregando música…" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : (
          <p className="mx-auto max-w-[45rem] text-muted-foreground">
            Ela pode ter sido removida do repertório.
          </p>
        )}
      </>
    );
  }
  // key: trocar de música (modo culto) recomeça a tela e para o player da anterior.
  return <SongView key={query.data.id} song={query.data} />;
}

type Editing = 'letra' | 'cifra' | 'tom' | 'dados' | null;

const SAVED_MESSAGE: Record<Exclude<Editing, null>, string> = {
  letra: 'Letra salva.',
  cifra: 'Cifra salva.',
  tom: 'Tom oficial salvo.',
  dados: 'Dados da música salvos.',
};

function SongView({ song }: { song: SongDetail }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [size, setSizeState] = useState<TextSizeIndex>(() => readTextSize());
  const [editing, setEditing] = useState<Editing>(null);
  const [archiving, setArchiving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const canEditChords = usePermission('chords.edit_official');
  const canSetKey = usePermission('songs.set_official_key');
  const canManageSongs = usePermission('songs.manage');
  const canArchive = usePermission('songs.delete');
  // Vindo de uma escala: "Tom oficial G · Culto de domingo em A".
  const eventId = params.get('evento') ?? undefined;
  const event = useEventDetail(eventId);
  // Modo tocar: a tela não apaga enquanto a música está aberta (quando o aparelho deixa).
  useWakeLock(editing === null);

  const tabParam = params.get('aba');
  const tab: SongTab =
    tabParam === 'cifra' || tabParam === 'letra'
      ? tabParam
      : !song.chords
        ? 'letra'
        : (readLastTab() ?? 'cifra');

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

  const setTab = (value: SongTab) => {
    saveLastTab(value);
    update({ aba: value });
  };

  const cycleSize = () => {
    const next = nextTextSize(size);
    setSizeState(next);
    saveTextSize(next);
  };

  const startEditing = (what: Exclude<Editing, null>) => {
    setNotice(null);
    setEditing(what);
    if (what === 'letra' || what === 'cifra') update({ aba: what });
  };
  const finishEditing = (saved: boolean) => {
    if (saved && editing) setNotice(SAVED_MESSAGE[editing]);
    setEditing(null);
  };

  // Modo culto: "2 de 5 · Culto de domingo", com ‹ Anterior e Próxima › no tom do dia.
  const sequence = event.data && eventId ? setlistPosition(event.data.songs, song.id) : null;
  const neighborHref = (item: { songId: string; key: string | null } | null) =>
    item && eventId ? songInEventHref(item.songId, item.key, eventId) : null;
  const goTo = (href: string | null) => {
    if (href) void navigate(href, { replace: true });
  };
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const subtitle = sequence
    ? `${sequence.index + 1} de ${sequence.total} · ${event.data!.event.title}${tomParam ? ` em ${tomParam}` : ''}`
    : [
        song.official_key
          ? `${LABELS.officialKey} ${song.official_key}`
          : song.original_key
            ? `Tom original ${song.original_key}`
            : null,
        event.data && tomParam ? `${event.data.event.title} em ${tomParam}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

  const menu: OverflowMenuItem[] = [
    ...(canEditChords
      ? [
          {
            label: song.chords ? 'Editar cifra' : 'Adicionar cifra',
            icon: Pencil,
            onSelect: () => startEditing('cifra'),
          },
        ]
      : []),
    { label: 'Editar letra', icon: Pencil, onSelect: () => startEditing('letra') },
    ...(canManageSongs
      ? [{ label: 'Editar dados', icon: SquarePen, onSelect: () => startEditing('dados') }]
      : []),
    ...(canSetKey
      ? [{ label: 'Definir tom oficial', icon: KeyRound, onSelect: () => startEditing('tom') }]
      : []),
    {
      label: 'Histórico',
      icon: History,
      onSelect: () => void navigate(`/repertorio/${song.id}/historico`),
    },
    {
      label: 'Gravar áudio de referência',
      icon: Mic,
      onSelect: () => {
        const section = document.getElementById('audios-referencia');
        section?.scrollIntoView({ block: 'start' });
        section?.querySelector<HTMLButtonElement>('button[data-gravar]')?.focus();
      },
    },
    ...(canArchive
      ? [
          song.archived_at
            ? {
                label: 'Restaurar música',
                icon: ArchiveRestore,
                onSelect: () => setArchiving(true),
              }
            : {
                label: 'Excluir',
                icon: Archive,
                destructive: true,
                onSelect: () => setArchiving(true),
              },
        ]
      : []),
  ];

  const media = safeMediaUrl(song.media_url);
  const textSize = TEXT_SIZES[size];

  return (
    <SongAudioProvider
      songId={song.id}
      // O áudio de referência está no tom ORIGINAL: o player muda o tom pela diferença até o
      // tom que está na tela (caminho mais curto, −6 a +5).
      followSemitones={shortestSemitones(song.original_key ?? baseKey, shownKey)}
      shownKey={shownKey}
    >
      <ScreenHeader
        title={song.title}
        subtitle={subtitle || undefined}
        back="/repertorio"
        actions={<OverflowMenu items={menu} />}
      />
      <ArchiveSongDialog
        songId={song.id}
        title={song.title}
        archived={Boolean(song.archived_at)}
        open={archiving}
        onClose={() => setArchiving(false)}
      />

      {sequence && (
        <nav
          aria-label="Sequência do repertório"
          className="mx-auto mb-3 flex max-w-3xl items-center justify-between gap-2"
        >
          <Button
            type="button"
            variant="outline"
            disabled={!sequence.prev}
            onClick={() => goTo(neighborHref(sequence.prev))}
          >
            <ChevronLeft aria-hidden="true" />
            Anterior
          </Button>
          <span className="text-caption text-muted-foreground">
            {sequence.index + 1} de {sequence.total}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={!sequence.next}
            onClick={() => goTo(neighborHref(sequence.next))}
          >
            Próxima
            <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      )}

      <section
        className="mx-auto flex max-w-3xl flex-col gap-4"
        // Deslizar para os lados troca de música (só gesto horizontal claro; rolar continua normal).
        onTouchStart={(e) => {
          const t = e.touches[0];
          touchStart.current =
            sequence && editing === null && t ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          const t = e.changedTouches[0];
          touchStart.current = null;
          if (!start || !t || !sequence) return;
          const dir = swipeDirection(t.clientX - start.x, t.clientY - start.y);
          if (dir === 1) goTo(neighborHref(sequence.next));
          if (dir === -1) goTo(neighborHref(sequence.prev));
        }}
      >
        {song.archived_at && (
          <p role="status" className="rounded-lg border border-accent bg-accent p-3 text-sm">
            Esta música foi <strong>excluída</strong> e não aparece na lista do repertório.
          </p>
        )}
        <p
          role="status"
          aria-live="polite"
          className="text-sm font-semibold text-brand-text empty:hidden"
        >
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

        <SongTabs
          tab={tab}
          onChange={setTab}
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
                    className="rounded-lg bg-accent p-3 text-sm text-accent-foreground"
                  >
                    Cifra enviada por um integrante · <strong>{LABELS.pending}</strong>.
                  </p>
                )}
                <ChordSheet
                  content={song.chords}
                  semitones={semitones}
                  fromKey={baseKey}
                  style={{ fontSize: `${textSize.px}px` }}
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
              <p
                className="leading-[1.35] whitespace-pre-line"
                style={{ fontSize: `${textSize.px}px` }}
              >
                {song.lyrics}
              </p>
            ) : song.chords ? (
              // Sem letra cadastrada: mostra a letra da própria cifra, sem acordes.
              <ChordSheet
                content={song.chords}
                showChords={false}
                style={{ fontSize: `${textSize.px}px` }}
              />
            ) : (
              <p className="text-muted-foreground">Esta música ainda não tem letra.</p>
            )
          }
        />

        {(song.artist || song.category || song.notes || media) && (
          <section
            aria-label="Sobre a música"
            className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-sm"
          >
            <h2 className="section-label">Sobre a música</h2>
            {(song.artist || song.category) && (
              <p className="text-muted-foreground">
                {[song.artist, song.category].filter(Boolean).join(' · ')}
              </p>
            )}
            {song.notes && <p className="whitespace-pre-line">{song.notes}</p>}
            {media && (
              <a
                href={media}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg font-semibold text-brand-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ExternalLink aria-hidden="true" className="size-4" />
                Ouvir / assistir ({mediaHost(media)})
                <span className="sr-only">(abre em nova aba)</span>
              </a>
            )}
          </section>
        )}

        <ReferenceAudios
          songId={song.id}
          followSemitones={shortestSemitones(song.original_key ?? baseKey, shownKey)}
          shownKey={shownKey}
        />

        {/* Espaço para o dock fixo não cobrir o fim da página. */}
        {editing === null && <div aria-hidden="true" className="h-40" />}
      </section>

      {editing === null && (
        <PlayDock
          baseKey={baseKey}
          semitones={semitones}
          shownKey={shownKey}
          officialKey={song.official_key}
          officialSemitones={officialSemitones}
          onChange={setSemitones}
          size={size}
          onSize={cycleSize}
        />
      )}
    </SongAudioProvider>
  );
}

/**
 * Dock fixo embaixo do modo tocar: linha 1 com o áudio de referência (se houver) e linha 2 com
 * [−] [tom atual + legenda] [+] [Oficial] [Aa].
 */
function PlayDock({
  baseKey,
  semitones,
  shownKey,
  officialKey,
  officialSemitones,
  onChange,
  size,
  onSize,
}: {
  baseKey: string | null;
  semitones: number;
  shownKey: string | null;
  officialKey: string | null;
  officialSemitones: number;
  onChange: (semitones: number) => void;
  size: TextSizeIndex;
  onSize: () => void;
}) {
  const selectId = useId();
  const audio = useSongAudio();
  const isOfficial = Boolean(officialKey) && semitones === officialSemitones;
  const legend = transposeLegend(
    normalizeSemitones(semitones - officialSemitones),
    !audio?.selected ? 'none' : audio.follow ? 'follow' : 'manual',
  );

  return (
    <div
      role="region"
      aria-label="Controles da música"
      className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 border-t bg-card px-3 pt-2 pb-2 md:bottom-0 md:left-60 md:pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <SongAudioBar />
        <div role="toolbar" aria-label="Tom" className="flex items-center gap-1.5">
          <DockButton label="Descer meio tom" onClick={() => onChange(semitones - 1)}>
            <Minus aria-hidden="true" className="size-5" />
          </DockButton>

          <div className="flex min-w-0 flex-1 flex-col items-center leading-tight">
            {baseKey ? (
              <>
                <label htmlFor={selectId} className="sr-only">
                  Tom
                </label>
                <select
                  id={selectId}
                  value={shownKey ?? ''}
                  onChange={(e) => onChange(semitonesTo(baseKey, e.target.value))}
                  className="h-9 appearance-none rounded-lg bg-transparent px-2 text-center text-2xl font-extrabold text-chord focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {keyOptions(baseKey).map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <span className="text-2xl font-extrabold text-chord" aria-live="polite">
                <span className="sr-only">Transposição: </span>
                {formatSemitones(semitones)}
              </span>
            )}
            <span className="truncate text-caption text-muted-foreground">
              {officialKey ? legend : 'sem tom oficial definido'}
            </span>
          </div>

          <DockButton label="Subir meio tom" onClick={() => onChange(semitones + 1)}>
            <Plus aria-hidden="true" className="size-5" />
          </DockButton>
          <button
            type="button"
            onClick={() => onChange(officialSemitones)}
            disabled={!officialKey || isOfficial}
            title={
              officialKey ? `Voltar ao tom oficial (${officialKey})` : 'Sem tom oficial definido'
            }
            className="flex h-11 items-center gap-1 rounded-lg bg-chip px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            Oficial
          </button>
          <button
            type="button"
            onClick={onSize}
            title="Tamanho da letra"
            className="flex size-11 items-center justify-center rounded-lg bg-chip font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden="true">Aa</span>
            <span className="sr-only">Tamanho da letra: {TEXT_SIZES[size].label}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DockButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-card hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

const TABS: { value: SongTab; label: string }[] = [
  { value: 'cifra', label: 'Cifra' },
  { value: 'letra', label: 'Letra' },
];

/** Controle segmentado Cifra | Letra (abas acessíveis: setas ←/→ trocam de aba). */
function SongTabs({
  tab,
  onChange,
  cifra,
  letra,
}: {
  tab: SongTab;
  onChange: (tab: SongTab) => void;
  cifra: ReactNode;
  letra: ReactNode;
}) {
  const baseId = useId();
  const refs = useRef<Record<SongTab, HTMLButtonElement | null>>({ cifra: null, letra: null });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next: SongTab = tab === 'cifra' ? 'letra' : 'cifra';
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Conteúdo da música"
        onKeyDown={onKeyDown}
        className="grid grid-cols-2 rounded-xl bg-chip p-1"
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
                'min-h-11 rounded-lg text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      {TABS.map(({ value }) => (
        <div
          key={value}
          role="tabpanel"
          id={`${baseId}-panel-${value}`}
          aria-labelledby={`${baseId}-tab-${value}`}
          hidden={tab !== value}
          tabIndex={0}
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {tab === value && (value === 'cifra' ? cifra : letra)}
        </div>
      ))}
    </div>
  );
}
