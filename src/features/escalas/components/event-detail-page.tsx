import { ArrowLeft, CalendarDays, Clock, MapPin } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/features/auth/session-context';
import { CancelledBadge, EventTypeBadge } from '@/features/agenda/event-type-badge';
import { formatDayLabel, formatTimeRange } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { EventDetail, EventSongItem } from '../api';
import { SongRow } from './song-row';
import { useEventDetail } from '../hooks';
import type { TeamGroup } from '../schedule-utils';

/** Detalhe do evento: dados, equipe agrupada por função e repertório na ordem. */
export function EventDetailPage() {
  const { eventId } = useParams();
  const query = useEventDetail(eventId);

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to="/escalas">
          <ArrowLeft aria-hidden="true" />
          Minhas escalas
        </Link>
      </Button>

      {query.isPending ? (
        <LoadingState label="Carregando evento…" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data === null ? (
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Evento não encontrado</h1>
          <p className="text-muted-foreground">
            Ele pode ter sido removido ou você não tem acesso a ele.
          </p>
        </div>
      ) : (
        <EventDetailView detail={query.data} />
      )}
    </section>
  );
}

function EventDetailView({ detail }: { detail: EventDetail }) {
  const { event, team, songs } = detail;
  const cancelled = event.status === 'cancelled';

  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <EventTypeBadge type={event.type} />
          {cancelled && <CancelledBadge />}
        </div>
        <h1 className={cn('text-2xl font-semibold', cancelled && 'line-through')}>{event.title}</h1>
        <dl className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <dt>
              <CalendarDays aria-hidden="true" className="size-4" />
              <span className="sr-only">Data</span>
            </dt>
            <dd>{formatDayLabel(event.starts_at)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt>
              <Clock aria-hidden="true" className="size-4" />
              <span className="sr-only">Horário</span>
            </dt>
            <dd>{formatTimeRange(event.starts_at, event.ends_at)}</dd>
          </div>
          {event.location && (
            <div className="flex items-center gap-2">
              <dt>
                <MapPin aria-hidden="true" className="size-4" />
                <span className="sr-only">Local</span>
              </dt>
              <dd>{event.location}</dd>
            </div>
          )}
        </dl>
        {event.notes && (
          <p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-line">{event.notes}</p>
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <TeamCard team={team} />
        <SongsCard songs={songs} />
      </div>
    </>
  );
}

function TeamCard({ team }: { team: TeamGroup[] }) {
  const { session } = useSession();
  const myId = session?.user.id;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipe</CardTitle>
      </CardHeader>
      <CardContent>
        {team.length === 0 ? (
          <EmptyState>Ninguém escalado ainda.</EmptyState>
        ) : (
          <dl className="flex flex-col gap-4">
            {team.map((group) => (
              <div key={group.function} className="flex flex-col gap-1">
                <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.function}
                </dt>
                {group.members.map((member) => (
                  <dd key={member.assignmentId} className="flex flex-col">
                    <span className={cn(member.userId === myId && 'font-semibold')}>
                      {member.name}
                      {member.userId === myId && (
                        <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
                          você
                        </span>
                      )}
                    </span>
                    {member.notes && (
                      <span className="text-sm text-muted-foreground">{member.notes}</span>
                    )}
                  </dd>
                ))}
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function SongsCard({ songs }: { songs: EventSongItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Repertório</CardTitle>
      </CardHeader>
      <CardContent>
        {songs.length === 0 ? (
          <EmptyState>Repertório ainda não definido.</EmptyState>
        ) : (
          <ol className="flex flex-col gap-2">
            {songs.map((song) => (
              <li key={song.id}>
                <SongRow song={song} />
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
