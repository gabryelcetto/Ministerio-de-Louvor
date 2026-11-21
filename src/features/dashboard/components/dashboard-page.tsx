import { Bell, ChevronRight, Clock, MapPin, Megaphone } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EVENT_TYPE_STYLES } from '@/features/agenda/event-type';
import { CancelledBadge, EventTypeBadge } from '@/features/agenda/event-type-badge';
import { useMyProfile } from '@/features/auth/hooks/use-me';
import { InstallTip } from '@/features/instalar/components/install-tip';
import { unreadLabel } from '@/features/notificacoes/api';
import { SongRow } from '@/features/escalas/components/song-row';
import { brand } from '@/config/brand';
import { formatDayLabel, formatShortDate, formatTimeRange, greeting } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { Dashboard, EventRow } from '@/types/app.types';
import { groupDashboardAssignments, useDashboard, type DashboardScheduleItem } from '../api';

/** Tela inicial: tudo vem de uma única chamada a get_dashboard(). */
export function DashboardPage() {
  const { data: profile } = useMyProfile();
  const query = useDashboard();
  const name = profile?.display_name || profile?.full_name;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          {/* No celular, o nome da igreja fica acima da saudação (no computador já está na lateral). */}
          <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase md:hidden">
            {brand.churchName}
          </p>
          <h1 className="text-2xl font-semibold">
            {greeting()}
            {name ? `, ${name}` : ''}!
          </h1>
        </div>
        {query.data && <UnreadBadge count={query.data.unread_notifications} />}
      </header>

      <InstallTip />

      {query.isPending ? (
        <LoadingState label="Carregando o painel…" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <DashboardContent data={query.data} />
      )}
    </section>
  );
}

function UnreadBadge({ count }: { count: number }) {
  const label = unreadLabel(count);
  return (
    <Link
      to="/notificacoes"
      className={cn(
        'inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        count > 0 && 'border-transparent bg-accent text-accent-foreground hover:bg-accent/80',
      )}
    >
      <Bell aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}

function DashboardContent({ data }: { data: Dashboard }) {
  const schedules = groupDashboardAssignments(data.my_assignments);
  const myFunctionsIn = (eventId: string | undefined) =>
    schedules.find((s) => s.eventId === eventId)?.functions ?? [];

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <HighlightCard
          heading="Próximo culto"
          event={data.next_service}
          myFunctions={myFunctionsIn(data.next_service?.id)}
          emptyText="Nenhum culto agendado."
        />
        <HighlightCard
          heading="Próximo ensaio"
          event={data.next_rehearsal}
          myFunctions={myFunctionsIn(data.next_rehearsal?.id)}
          emptyText="Nenhum ensaio agendado."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section
          title="Repertório do próximo culto"
          action={
            data.next_service && <SeeAll to={`/escalas/${data.next_service.id}`}>Ver evento</SeeAll>
          }
        >
          {data.next_service_songs.length === 0 ? (
            <EmptyState>
              {data.next_service ? 'Repertório ainda não definido.' : 'Nenhum culto agendado.'}
            </EmptyState>
          ) : (
            <ol className="flex flex-col gap-1">
              {data.next_service_songs.map((song) => (
                <li key={`${song.position}-${song.song_id}`}>
                  <SongRow
                    song={{
                      position: song.position,
                      songId: song.song_id,
                      title: song.title,
                      artist: song.artist,
                      key: song.key,
                    }}
                  />
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title="Minhas escalas" action={<SeeAll to="/escalas">Ver todas</SeeAll>}>
          {schedules.length === 0 ? (
            <EmptyState>Você não está escalado(a) nos próximos eventos.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-1">
              {schedules.slice(0, 5).map((item) => (
                <li key={item.eventId}>
                  <ScheduleRow item={item} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Comunicados recentes" action={<SeeAll to="/comunicados">Ver todos</SeeAll>}>
        {data.recent_announcements.length === 0 ? (
          <EmptyState>Nenhum comunicado por enquanto.</EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {data.recent_announcements.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 rounded-lg border p-3">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Megaphone aria-hidden="true" className="size-3.5" />
                  <time dateTime={a.published_at}>{formatShortDate(a.published_at)}</time>
                </span>
                <span className="font-medium">{a.title}</span>
                {a.body && (
                  <p className="line-clamp-3 text-sm whitespace-pre-line text-muted-foreground">
                    {a.body}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function HighlightCard({
  heading,
  event,
  myFunctions,
  emptyText,
}: {
  heading: string;
  event: EventRow | null;
  myFunctions: string[];
  emptyText: string;
}) {
  if (!event) {
    return (
      <Card className="flex flex-col gap-2 p-5">
        <h2 className="text-sm font-semibold text-muted-foreground">{heading}</h2>
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </Card>
    );
  }

  return (
    <Link
      to={`/escalas/${event.id}`}
      className={cn(
        'group flex flex-col gap-3 rounded-xl border border-l-4 bg-card p-5 shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        EVENT_TYPE_STYLES[event.type].bar,
      )}
    >
      <div className="flex items-center justify-between gap-2 text-card-foreground">
        <h2 className="text-sm font-semibold text-muted-foreground">{heading}</h2>
        <span className="flex items-center gap-2">
          {event.status === 'cancelled' && <CancelledBadge />}
          <EventTypeBadge type={event.type} />
        </span>
      </div>
      <div className="flex flex-col gap-1 text-card-foreground">
        <span className="text-xl font-semibold">{event.title}</span>
        <span className="text-sm font-medium">{formatDayLabel(event.starts_at)}</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock aria-hidden="true" className="size-3.5" />
            {formatTimeRange(event.starts_at, event.ends_at)}
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden="true" className="size-3.5" />
              {event.location}
            </span>
          )}
        </span>
      </div>
      <p className="text-sm text-card-foreground">
        {myFunctions.length > 0 ? (
          <>
            Você está escalado(a): <strong>{myFunctions.join(', ')}</strong>
          </>
        ) : (
          <span className="text-muted-foreground">Você não está escalado(a) neste.</span>
        )}
      </p>
    </Link>
  );
}

function ScheduleRow({ item }: { item: DashboardScheduleItem }) {
  const { icon: Icon, text, label } = EVENT_TYPE_STYLES[item.type];
  return (
    <Link
      to={`/escalas/${item.eventId}`}
      className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={cn('flex size-8 shrink-0 items-center justify-center', text)}>
        <Icon aria-hidden="true" className="size-5" />
        <span className="sr-only">{label}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{item.title}</span>
        <span className="text-sm text-muted-foreground">
          {formatShortDate(item.startsAt)} · {item.functions.join(', ')}
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SeeAll({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </Link>
  );
}
