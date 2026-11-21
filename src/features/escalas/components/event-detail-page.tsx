import {
  Ban,
  CalendarCheck,
  CalendarPlus,
  Clock,
  Copy,
  MapPin,
  Navigation,
  Pencil,
  Share2,
  SquarePen,
} from 'lucide-react';
import { useId, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormError } from '@/components/common/form-error';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { OverflowMenu, type OverflowMenuItem } from '@/components/layout/overflow-menu';
import { ScreenHeader } from '@/components/layout/screen-header';
import { EVENT_TYPE_STYLES } from '@/features/agenda';
import { RehearsalRecordings } from '@/features/audio';
import { useSession, usePermission } from '@/features/auth';
import { useScrollToHash } from '@/hooks/use-scroll-to-hash';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { downloadBlob, shareText } from '@/lib/browser-share';
import { dateBlock, formatDayLabel, formatTimeRange, isoToZonedLocal } from '@/lib/dates';
import { icsFileName } from '@/lib/ics';
import { mapsSearchUrl } from '@/lib/share';
import { cn } from '@/lib/utils';
import type { EventDetail, EventSongItem } from '../api';
import { useEventDetail } from '../hooks';
import { useDuplicateEvent, useSetEventStatus } from '../manage';
import { eventIcs, eventShareText } from '../share-text';
import type { TeamSectionGroup } from '../schedule-utils';
import { SongRow } from './song-row';

/** Escala / detalhe do evento: data, equipe (Cantores e Instrumentistas) e repertório. */
export function EventDetailPage() {
  const { eventId } = useParams();
  const query = useEventDetail(eventId);
  useScrollToHash();

  if (query.isPending || query.isError || query.data === null) {
    return (
      <>
        <ScreenHeader
          title={query.data === null ? 'Evento não encontrado' : 'Evento'}
          back="/escalas"
        />
        {query.isPending ? (
          <LoadingState label="Carregando evento…" />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : (
          <p className="mx-auto max-w-[45rem] text-muted-foreground">
            Ele pode ter sido removido ou você não tem acesso a ele.
          </p>
        )}
      </>
    );
  }
  return <EventDetailView detail={query.data} />;
}

function EventDetailView({ detail }: { detail: EventDetail }) {
  const { event, teamBySection, songs } = detail;
  const navigate = useNavigate();
  const canSchedule = usePermission('schedules.manage');
  const canManageEvents = usePermission('events.manage');
  const status = useSetEventStatus();
  const duplicate = useDuplicateEvent(event.id);
  const [confirming, setConfirming] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [notice, setNotice] = useState('');
  const appUrl = window.location.origin;

  const share = async () => {
    const outcome = await shareText({ title: event.title, text: eventShareText(detail, appUrl) });
    setNotice(
      outcome === 'copied-whatsapp'
        ? 'Texto copiado. Se o WhatsApp não abrir, cole a mensagem.'
        : outcome === 'copied'
          ? 'Texto copiado. Cole onde quiser enviar.'
          : outcome === 'failed'
            ? 'Não foi possível compartilhar neste aparelho.'
            : '',
    );
  };
  const addToCalendar = () => {
    downloadBlob(
      new Blob([eventIcs(detail, appUrl)], { type: 'text/calendar;charset=utf-8' }),
      icsFileName(event.title, event.starts_at),
    );
    setNotice('Arquivo da agenda baixado. Abra-o para adicionar ao calendário.');
  };
  const cancelled = event.status === 'cancelled';
  const block = dateBlock(event.starts_at);
  const typeLabel = EVENT_TYPE_STYLES[event.type].label;

  const menu: OverflowMenuItem[] = [
    { label: 'Compartilhar', icon: Share2, onSelect: () => void share() },
    { label: 'Adicionar à agenda', icon: CalendarPlus, onSelect: addToCalendar },
    ...(canManageEvents
      ? [
          {
            label: 'Editar evento',
            icon: SquarePen,
            onSelect: () => void navigate(`/escalas/${event.id}/editar`),
          },
          { label: 'Duplicar evento', icon: Copy, onSelect: () => setDuplicating(true) },
        ]
      : []),
    ...(canSchedule
      ? [
          {
            label: 'Editar escala',
            icon: Pencil,
            onSelect: () => void navigate(`/escalas/montar?evento=${event.id}`),
          },
        ]
      : []),
    ...(canManageEvents
      ? [
          cancelled
            ? { label: 'Reativar evento', icon: CalendarCheck, onSelect: () => setConfirming(true) }
            : {
                label: 'Cancelar evento',
                icon: Ban,
                destructive: true,
                onSelect: () => setConfirming(true),
              },
        ]
      : []),
  ];

  return (
    <>
      <ScreenHeader
        title={event.title}
        subtitle={cancelled ? `${typeLabel} · Cancelado` : typeLabel}
        back="/escalas"
        actions={<OverflowMenu items={menu} />}
      />
      <section className="mx-auto flex max-w-[45rem] flex-col gap-6">
        <FormError error={status.error} />
        <p
          role="status"
          aria-live="polite"
          className="text-sm font-medium text-brand-text empty:hidden"
        >
          {notice}
        </p>
        <div className="flex gap-4 rounded-xl border bg-card p-4">
          <div
            aria-hidden="true"
            className="flex size-16 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-soft text-brand-text"
          >
            <span className="text-xs font-bold">{block.weekday}</span>
            <span className="text-2xl leading-none font-extrabold">{block.day}</span>
          </div>
          <dl className="flex min-w-0 flex-col gap-1 text-sm">
            <div>
              <dt className="sr-only">Data</dt>
              <dd className={cn('text-card-title', cancelled && 'line-through')}>
                {formatDayLabel(event.starts_at)}
              </dd>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <dt>
                <Clock aria-hidden="true" className="size-4" />
                <span className="sr-only">Horário</span>
              </dt>
              <dd>{formatTimeRange(event.starts_at, event.ends_at)}</dd>
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <dt>
                  <MapPin aria-hidden="true" className="size-4" />
                  <span className="sr-only">Local</span>
                </dt>
                <dd className="flex flex-wrap items-center gap-x-2">
                  {event.location}
                  <a
                    href={mapsSearchUrl(event.location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1 font-semibold text-brand-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Navigation aria-hidden="true" className="size-4" />
                    Como chegar
                    <span className="sr-only"> (abre o mapa em nova aba)</span>
                  </a>
                </dd>
              </div>
            )}
            {cancelled && (
              <div>
                <dt className="sr-only">Situação</dt>
                <dd className="font-semibold text-destructive">Evento cancelado</dd>
              </div>
            )}
          </dl>
        </div>
        {event.notes && (
          <p className="rounded-xl bg-chip p-4 text-sm whitespace-pre-line">{event.notes}</p>
        )}

        <Team groups={teamBySection} />
        <Songs songs={songs} eventId={event.id} />

        {event.type === 'ensaio' && <RehearsalRecordings eventId={event.id} />}
      </section>

      <ConfirmDialog
        open={confirming}
        title={cancelled ? 'Reativar este evento?' : 'Cancelar este evento?'}
        confirmLabel={cancelled ? 'Reativar' : 'Cancelar evento'}
        cancelLabel="Voltar"
        destructive={!cancelled}
        busy={status.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          status.mutate(
            { eventId: event.id, status: cancelled ? 'scheduled' : 'cancelled' },
            { onSettled: () => setConfirming(false) },
          )
        }
      >
        A equipe escalada recebe um aviso no app.
      </ConfirmDialog>
      <DuplicateDialog
        open={duplicating}
        defaultStartsAt={nextWeek(event.starts_at)}
        busy={duplicate.isPending}
        error={duplicate.error}
        onCancel={() => setDuplicating(false)}
        onConfirm={(startsAt) =>
          duplicate.mutate(startsAt, {
            onSuccess: (newId) => {
              setDuplicating(false);
              void navigate(`/escalas/${newId}`);
            },
          })
        }
      />
    </>
  );
}

function Team({ groups }: { groups: TeamSectionGroup[] }) {
  const { session } = useSession();
  const myId = session?.user.id;

  return (
    <section aria-labelledby="equipe-titulo" className="flex flex-col gap-3">
      <h2 id="equipe-titulo" className="section-label">
        Equipe
      </h2>
      {groups.length === 0 ? (
        <EmptyState>Ninguém escalado ainda.</EmptyState>
      ) : (
        groups.map((group) => (
          <div key={group.section} className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">{group.label}</h3>
            <ul aria-label={group.label} className="flex flex-wrap gap-2">
              {group.members.map((member) => {
                const me = member.userId === myId;
                return (
                  <li
                    key={member.userId}
                    className={cn(
                      'flex min-h-12 items-center gap-2 rounded-lg border py-1.5 pr-3 pl-1.5',
                      me ? 'border-brand bg-brand-soft' : 'bg-card',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold',
                        me ? 'bg-brand text-brand-ink' : 'bg-chip text-muted-foreground',
                      )}
                    >
                      {member.initials}
                    </span>
                    <span className="flex flex-col leading-tight">
                      <span className="text-sm font-semibold">
                        {member.name}
                        {me && ' (você)'}
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {member.functions.join(' · ')}
                      </span>
                      {member.notes.map((note) => (
                        <span key={note} className="text-caption text-muted-foreground">
                          {note}
                        </span>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function Songs({ songs, eventId }: { songs: EventSongItem[]; eventId: string }) {
  return (
    <section
      id="repertorio"
      aria-labelledby="repertorio-titulo"
      className="flex scroll-mt-20 flex-col gap-2"
    >
      <h2 id="repertorio-titulo" className="section-label">
        Repertório
      </h2>
      {songs.length === 0 ? (
        <EmptyState>Repertório ainda não definido.</EmptyState>
      ) : (
        <ol className="flex flex-col rounded-xl border bg-card p-1">
          {songs.map((song) => (
            <li key={song.id}>
              <SongRow song={song} eventId={eventId} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Mesma hora, uma semana depois (sugestão para "Duplicar evento"). */
function nextWeek(startsAt: string): string {
  return isoToZonedLocal(new Date(Date.parse(startsAt) + 7 * 86_400_000));
}

function DuplicateDialog({
  open,
  defaultStartsAt,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  defaultStartsAt: string;
  busy: boolean;
  error: unknown;
  onCancel: () => void;
  onConfirm: (startsAtLocal: string) => void;
}) {
  const id = useId();
  const [value, setValue] = useState(defaultStartsAt);
  return (
    <ConfirmDialog
      open={open}
      title="Duplicar evento"
      confirmLabel="Duplicar"
      busy={busy}
      onCancel={onCancel}
      onConfirm={() => value && onConfirm(value)}
    >
      <div className="flex flex-col gap-2">
        <p>A cópia leva a equipe e o repertório. Escolha a nova data.</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id}>Nova data e hora (horário de Brasília)</Label>
          <Input
            id={id}
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-11 text-base"
          />
        </div>
        {error ? <FormError error={error} fallback="Não foi possível duplicar." /> : null}
      </div>
    </ConfirmDialog>
  );
}
